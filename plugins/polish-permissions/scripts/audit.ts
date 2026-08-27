// Reads the three permission scopes for one project and reports what is
// redundant, what conflicts, and which rule families are safe to promote.
//
// This script only ever reads. Every change it suggests is applied by the
// skill, after the user has seen it.
//
//   node audit.ts [--root <dir>] [--user-settings <file>] [--json]

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
	analyze,
	defaultConfig,
	extendConfig,
	families,
	rulesFrom,
	sortRules,
	SCOPES,
} from './core.ts'
import type { Config, Family, Findings, Rule, Scope } from './core.ts'

/**
 * Read from the manifest rather than restated here. A literal in this file
 * drifts the moment the version is bumped — the pre-commit hook propagates
 * only into `config/**\/*.yaml` and `bundles/**\/*.sh`, neither of which this
 * plugin has, so nothing would ever correct it.
 */
const PLUGIN_VERSION: string = (() => {
	try {
		const manifest = new URL('../.claude-plugin/plugin.json', import.meta.url)
		return JSON.parse(readFileSync(manifest, 'utf8')).version ?? 'unknown'
	} catch {
		return 'unknown'
	}
})()

export interface SourceFile {
	scope: Scope
	path: string
	exists: boolean
	/** Set when the file exists but could not be parsed — this silently
	 *  disables every setting in it, so it outranks any other finding. */
	error?: string
}

// ---------------------------------------------------------------- arguments

export function parseArgs(argv: string[]): { root: string; json: boolean; userSettings: string } {
	let root = process.cwd()
	let json = false
	let userSettings = join(homedir(), '.claude', 'settings.json')
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--root' && argv[i + 1]) root = resolve(argv[++i]!)
		else if (argv[i] === '--user-settings' && argv[i + 1]) userSettings = resolve(argv[++i]!)
		else if (argv[i] === '--json') json = true
	}
	return { root, json, userSettings }
}

// ------------------------------------------------------------------ loading

export function loadConfig(root: string): Config {
	const path = join(root, '.claude', 'config', 'polish-permissions.json')
	if (!existsSync(path)) return defaultConfig()
	try {
		return extendConfig(defaultConfig(), JSON.parse(readFileSync(path, 'utf8')))
	} catch (err) {
		process.stderr.write(`warning: ignoring unreadable ${path}: ${(err as Error).message}\n`)
		return defaultConfig()
	}
}

export function sourceFiles(root: string, userSettings: string): SourceFile[] {
	return [
		{ scope: 'user', path: userSettings, exists: false },
		{ scope: 'project', path: join(root, '.claude', 'settings.json'), exists: false },
		{ scope: 'local', path: join(root, '.claude', 'settings.local.json'), exists: false },
	]
}

export function collect(files: SourceFile[], cfg: Config): Rule[] {
	const rules: Rule[] = []
	for (const file of files) {
		if (!existsSync(file.path)) continue
		file.exists = true
		try {
			rules.push(...rulesFrom(JSON.parse(readFileSync(file.path, 'utf8')), file.scope, cfg))
		} catch (err) {
			file.error = (err as Error).message
		}
	}
	return rules
}

// ------------------------------------------------------------- reporting

export function humanReport(
	files: SourceFile[],
	rules: Rule[],
	f: Findings,
	fams: Family[],
): string {
	const lines: string[] = []
	const push = (s = '') => lines.push(s)

	push('Permission scopes')
	for (const file of files) {
		const count = rules.filter((r) => r.scope === file.scope).length
		const state = file.error ? 'PARSE ERROR' : file.exists ? `${count} rules` : 'missing'
		push(`  ${file.scope.padEnd(8)} ${state.padEnd(14)} ${file.path}`)
		if (file.error) push(`           ${file.error}`)
	}

	if (files.some((x) => x.error)) {
		push()
		push('!! A settings file that does not parse disables every setting in it, silently.')
		push('!! Fix these before anything else — the findings below are computed without them.')
	}

	const section = (title: string, rows: string[]) => {
		push()
		push(`${title} (${rows.length})`)
		if (!rows.length) push('  none')
		else for (const row of rows) push(`  ${row}`)
	}

	section(
		'Duplicated inside one file',
		f.duplicatesInScope.map((d) => `${d.scope}/${d.list}: ${d.rule} ×${d.count}`),
	)

	section(
		'Present in more than one scope',
		f.crossScopeRedundant.map(
			(c) =>
				`${c.list}: ${c.rule}  [${c.scopes.join(' + ')}]  ` +
				(c.safeToRemove ? `→ drop the ${c.safeToRemove} copy` : '→ decide manually'),
		),
	)

	section(
		'Already covered by a broader rule',
		f.subsumed.map(
			(s) =>
				`${s.scope}/${s.list}: ${s.rule}  ⊂  ${s.coveredBy} (${s.byScope})  ` +
				(s.safeToRemove ? '→ redundant, drop it' : '→ keep: the broader rule does not reach as far'),
		),
	)

	section(
		'Wildcard does NOT cover the bare command (folding would lose access)',
		f.nearMissWildcard.map((n) => `${n.scope}: ${n.rule}  vs  ${n.wildcard} (${n.byScope})`),
	)

	section(
		'allow / deny overlap — deny wins, review manually',
		f.allowDenyConflicts.map(
			(c) => `allow ${c.allow} (${c.allowScope})  ×  deny ${c.deny} (${c.denyScope})`,
		),
	)

	section(
		'Safelisted wildcards that would replace several rules',
		f.wildcardSuggestions.map(
			(w) => `${w.wildcard}  replaces ${w.replaces.map((r) => `${r.rule} (${r.scope})`).join(', ')}`,
		),
	)

	push()
	push('Families')
	const mark = { 'promote-to-user': '↑', keep: '·', ask: '?' } as const
	for (const fam of fams) {
		push(
			`  ${mark[fam.recommendation]} ${fam.name.padEnd(28)} ` +
				`${fam.rules.length} rule(s)  [${fam.scopes.join('+')}]  ${fam.readonly}` +
				(fam.sensitive ? '  SENSITIVE — reads credentials' : ''),
		)
	}
	push()
	push('  ↑ promote to user scope   · keep where it is   ? ask before deciding')

	return lines.join('\n')
}

// ------------------------------------------------------------------ main

function main(): void {
	const { root, json, userSettings } = parseArgs(process.argv.slice(2))
	const cfg = loadConfig(root)
	const files = sourceFiles(root, userSettings)
	const rules = collect(files, cfg)
	const findings = analyze(rules, cfg)
	const fams = families(rules)

	if (json) {
		process.stdout.write(
			JSON.stringify(
				{
					pluginVersion: PLUGIN_VERSION,
					root,
					scopes: SCOPES,
					files,
					rules,
					findings,
					families: fams,
					sorted: sortRules(rules),
				},
				null,
				2,
			) + '\n',
		)
	} else {
		process.stdout.write(humanReport(files, rules, findings, fams) + '\n')
	}
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) main()
