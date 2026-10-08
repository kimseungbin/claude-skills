// Reads the permission settings Claude Code loads for a session started in one
// directory, plus every settings file above it that never loads, and reports
// what is redundant, what conflicts, which rule families are safe to promote,
// and which committed rules are personal preferences rather than project policy.
//
// This script only ever reads. Every change it suggests is applied by the
// skill, after the user has seen it.
//
//   node audit.ts [--cwd <dir>] [--home <dir>] [--json]

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import {
	analyze,
	classifyInert,
	defaultConfig,
	extendConfig,
	families,
	projectRuleVerdicts,
	rulesFrom,
	sortRules,
	SCOPES,
} from './core.ts'
import type {
	Config,
	Family,
	Findings,
	InertRule,
	ProjectContext,
	ProjectRuleVerdict,
	Rule,
	Scope,
} from './core.ts'

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

/** A settings file Claude Code loads for the session. */
export interface SourceFile {
	scope: Scope
	path: string
	/** A settings.local.json in the working directory, read alongside the
	 *  git root's. Claude Code writes new local rules to the git root's. */
	legacy?: boolean
	exists: boolean
	ruleCount: number
	/** Set when the file exists but could not be parsed — this silently
	 *  disables every setting in it, so it outranks any other finding. */
	error?: string
}

/** A settings file above the project that no session started here loads. */
export interface InertFile {
	path: string
	/** The directory a session has to be rooted at for this file to load. */
	loadsFor: string
	error?: string
	rules: InertRule[]
}

// ---------------------------------------------------------------- arguments

export function parseArgs(argv: string[]): { cwd: string; home: string; json: boolean } {
	let cwd = process.cwd()
	let home = homedir()
	let json = false
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--cwd' && argv[i + 1]) cwd = resolve(argv[++i]!)
		else if (argv[i] === '--home' && argv[i + 1]) home = resolve(argv[++i]!)
		else if (argv[i] === '--json') json = true
	}
	return { cwd, home, json }
}

// ------------------------------------------------------- where files live

/** The nearest directory at or above `dir` holding a `.git` entry. */
export function gitRootOf(dir: string): string | null {
	for (let d = dir; ; d = dirname(d)) {
		if (existsSync(join(d, '.git'))) return d
		if (dirname(d) === d) return null
	}
}

function ownedByCurrentUser(path: string): boolean {
	if (!process.getuid || !existsSync(path)) return true
	return statSync(path).uid === process.getuid()
}

/**
 * Where Claude Code reads settings.local.json for a session started in `cwd`:
 * the git root, except on Windows, when the git root is the home directory,
 * and when the root, its `.git` or its `.claude` is owned by another user —
 * then the working directory.
 */
export function localSettingsDir(
	cwd: string,
	home: string,
	platform: NodeJS.Platform = process.platform,
): string {
	const root = gitRootOf(cwd)
	if (!root || platform === 'win32' || root === home) return cwd
	const owned = [root, join(root, '.git'), join(root, '.claude')].every(ownedByCurrentUser)
	return owned ? root : cwd
}

/**
 * The settings files Claude Code loads for a session started in `cwd`: user
 * settings, shared settings from the working directory (there is no
 * parent-directory fallback), local settings per `localSettingsDir`, and a
 * leftover local file in the working directory when that differs.
 */
export function loadChain(
	cwd: string,
	home: string,
	platform: NodeJS.Platform = process.platform,
): SourceFile[] {
	const file = (scope: Scope, path: string, legacy = false): SourceFile => ({
		scope,
		path,
		exists: false,
		ruleCount: 0,
		...(legacy ? { legacy } : {}),
	})
	const user = join(home, '.claude', 'settings.json')
	const shared = join(cwd, '.claude', 'settings.json')
	const localDir = localSettingsDir(cwd, home, platform)
	const legacyLocal = join(cwd, '.claude', 'settings.local.json')

	const chain = [file('user', user)]
	if (shared !== user) chain.push(file('project', shared))
	chain.push(file('local', join(localDir, '.claude', 'settings.local.json')))
	if (localDir !== cwd && existsSync(legacyLocal)) chain.push(file('local', legacyLocal, true))
	return chain
}

/** `cwd` and each directory above it, up to the home directory when `cwd`
 *  is inside it, otherwise up to the filesystem root. */
export function ancestorDirs(cwd: string, home: string): string[] {
	const stop = cwd === home || cwd.startsWith(home + sep) ? home : null
	const dirs: string[] = []
	for (let d = cwd; ; d = dirname(d)) {
		dirs.push(d)
		if (d === stop || dirname(d) === d) return dirs
	}
}

/** Every settings file from the working directory up to home that is not in
 *  the load chain. */
export function inertPaths(cwd: string, home: string, chain: SourceFile[]): string[] {
	const loaded = new Set(chain.map((f) => f.path))
	const out: string[] = []
	for (const dir of ancestorDirs(cwd, home)) {
		for (const name of ['settings.json', 'settings.local.json']) {
			const path = join(dir, '.claude', name)
			if (!loaded.has(path) && existsSync(path)) out.push(path)
		}
	}
	return out
}

// ------------------------------------------------------------------ loading

export function loadConfig(projectRoot: string): Config {
	const path = join(projectRoot, '.claude', 'config', 'polish-permissions.json')
	if (!existsSync(path)) return defaultConfig()
	try {
		return extendConfig(defaultConfig(), JSON.parse(readFileSync(path, 'utf8')))
	} catch (err) {
		process.stderr.write(`warning: ignoring unreadable ${path}: ${(err as Error).message}\n`)
		return defaultConfig()
	}
}

export function collect(files: SourceFile[], cfg: Config): Rule[] {
	const rules: Rule[] = []
	for (const file of files) {
		if (!existsSync(file.path)) continue
		file.exists = true
		try {
			const own = rulesFrom(JSON.parse(readFileSync(file.path, 'utf8')), file.scope, cfg)
			file.ruleCount = own.length
			rules.push(...own)
		} catch (err) {
			file.error = (err as Error).message
		}
	}
	return rules
}

/** Reads each file that never loads. Returns the verdicts for the report
 *  alongside the parsed rules, which the committed-rule check compares against. */
export function collectInert(
	paths: string[],
	userRules: Rule[],
	cfg: Config,
): { files: InertFile[]; parsed: { where: string; rules: Rule[] }[] } {
	const files: InertFile[] = []
	const parsed: { where: string; rules: Rule[] }[] = []
	for (const path of paths) {
		const loadsFor = dirname(dirname(path))
		try {
			const scope: Scope = path.endsWith('settings.local.json') ? 'local' : 'project'
			const rules = rulesFrom(JSON.parse(readFileSync(path, 'utf8')), scope, cfg)
			files.push({ path, loadsFor, rules: classifyInert(rules, userRules) })
			parsed.push({ where: path, rules })
		} catch (err) {
			files.push({ path, loadsFor, error: (err as Error).message, rules: [] })
		}
	}
	return { files, parsed }
}

function readJson(path: string): any {
	try {
		return JSON.parse(readFileSync(path, 'utf8'))
	} catch {
		return undefined
	}
}

/** Directories named by npm/yarn `workspaces` and `pnpm-workspace.yaml`,
 *  expanding a trailing `/*` one level. */
export function workspaceDirs(root: string): string[] {
	const pkg = readJson(join(root, 'package.json'))
	const patterns: string[] = Array.isArray(pkg?.workspaces)
		? pkg.workspaces
		: Array.isArray(pkg?.workspaces?.packages)
			? pkg.workspaces.packages
			: []
	try {
		const yaml = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
		for (const m of yaml.matchAll(/^\s*-\s*['"]?([^'"\s#]+)['"]?/gm)) patterns.push(m[1]!)
	} catch {}

	const dirs: string[] = []
	for (const pattern of patterns) {
		if (typeof pattern !== 'string' || pattern.startsWith('!')) continue
		if (!pattern.endsWith('/*')) {
			dirs.push(join(root, pattern))
			continue
		}
		const parent = join(root, pattern.slice(0, -2))
		try {
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (entry.isDirectory()) dirs.push(join(parent, entry.name))
			}
		} catch {}
	}
	return dirs
}

/** What the repository owns, read from package.json and .mcp.json in the
 *  working directory, the project root and its workspace packages. */
export function projectContext(cwd: string, projectRoot: string): ProjectContext {
	const roots = [...new Set([cwd, projectRoot])]
	const dirs = [...new Set([...roots, ...workspaceDirs(projectRoot)])]
	const scripts = new Set<string>()
	const packages = new Set<string>()
	const mcpServers = new Set<string>()
	for (const dir of dirs) {
		const pkg = readJson(join(dir, 'package.json'))
		for (const name of Object.keys(pkg?.scripts ?? {})) scripts.add(name)
		for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
			for (const name of Object.keys(pkg?.[field] ?? {})) packages.add(name)
		}
		if (typeof pkg?.bin === 'string' && pkg.name) packages.add(pkg.name)
		for (const name of Object.keys(typeof pkg?.bin === 'object' ? pkg.bin : {})) packages.add(name)
		for (const name of Object.keys(readJson(join(dir, '.mcp.json'))?.mcpServers ?? {})) mcpServers.add(name)
	}
	return {
		root: projectRoot,
		scripts,
		packages,
		mcpServers,
		pathExists: (relative) => dirs.some((dir) => existsSync(join(dir, relative))),
	}
}

// ------------------------------------------------------------- reporting

export interface Report {
	home: string
	files: SourceFile[]
	rules: Rule[]
	findings: Findings
	families: Family[]
	inert: InertFile[]
	projectRules: ProjectRuleVerdict[]
}

export function humanReport(r: Report): string {
	const lines: string[] = []
	const push = (s = '') => lines.push(s)
	const tilde = (path: string) =>
		path === r.home || path.startsWith(r.home + sep) ? '~' + path.slice(r.home.length) : path

	push('Permission scopes')
	for (const file of r.files) {
		const label = file.legacy ? `${file.scope}*` : file.scope
		const state = file.error ? 'PARSE ERROR' : file.exists ? `${file.ruleCount} rules` : 'missing'
		push(`  ${label.padEnd(8)} ${state.padEnd(14)} ${tilde(file.path)}`)
		if (file.error) push(`           ${file.error}`)
	}
	if (r.files.some((x) => x.legacy)) {
		push('  * a local file in the working directory, still read alongside the git root\'s.')
		push('    New local rules are written to the git root\'s file.')
	}

	if (r.files.some((x) => x.error)) {
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

	const f = r.findings
	section(
		'Duplicated inside one scope',
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
			(w) => `${w.wildcard}  replaces ${w.replaces.map((x) => `${x.rule} (${x.scope})`).join(', ')}`,
		),
	)

	push()
	push('Families')
	const mark = { 'promote-to-user': '↑', keep: '·', ask: '?', 'already-granted': '=' } as const
	for (const fam of r.families) {
		push(
			`  ${mark[fam.recommendation]} ${fam.name.padEnd(28)} ` +
				`${fam.rules.length} rule(s)  [${fam.scopes.join('+')}]  ${fam.readonly}` +
				(fam.sensitive ? '  SENSITIVE — reads credentials' : ''),
		)
	}
	push()
	push('  ↑ promote to user scope   · keep where it is   ? ask before deciding')

	push()
	push(`Settings files above this project that never load here (${r.inert.length})`)
	if (!r.inert.length) push('  none')
	for (const file of r.inert) {
		const state = file.error ? 'PARSE ERROR' : `${file.rules.length} rules`
		push(`  ${tilde(file.path)}  ${state}  — loads only for sessions rooted at ${tilde(file.loadsFor)}`)
		if (file.error) push(`      ${file.error}`)
		for (const rule of file.rules) {
			const list = rule.list === 'allow' ? '' : `${rule.list}: `
			const why = rule.coveredBy ? `  (granted by ${rule.coveredBy} at user scope)` : ''
			const sensitive = rule.sensitive ? '  SENSITIVE — reads credentials' : ''
			push(`    ${mark[rule.recommendation]} ${list}${rule.raw}${why}${sensitive}`)
		}
	}
	if (r.inert.length) {
		push()
		push('  ↑ promote to user scope   · keep where it is   ? ask before deciding   = already granted')
	}

	section(
		'Committed allow rules: project policy or personal preference',
		r.projectRules.map((p) =>
			p.verdict === 'project-policy'
				? `project    ${p.rule}  — names ${p.reference}`
				: `personal?  ${p.rule}  — names nothing in this repository` +
					(p.evidence.length ? `; ${p.evidence.map(tilde).join('; ')}` : ''),
		),
	)

	return lines.join('\n')
}

// ------------------------------------------------------------------ main

export function audit(cwd: string, home: string): Report & { cwd: string; projectRoot: string } {
	const projectRoot = gitRootOf(cwd) ?? cwd
	const cfg = loadConfig(projectRoot)
	const files = loadChain(cwd, home)
	const rules = collect(files, cfg)
	const userRules = rules.filter((x) => x.scope === 'user')
	const inert = collectInert(inertPaths(cwd, home, files), userRules, cfg)
	const projectRules = projectRuleVerdicts(
		rules,
		[{ where: 'user scope', rules: userRules }, ...inert.parsed],
		projectContext(cwd, projectRoot),
	)

	return {
		cwd,
		projectRoot,
		home,
		files,
		rules,
		findings: analyze(rules, cfg),
		families: families(rules),
		inert: inert.files,
		projectRules,
	}
}

function main(): void {
	const { cwd, home, json } = parseArgs(process.argv.slice(2))
	const report = audit(cwd, home)

	if (json) {
		process.stdout.write(
			JSON.stringify(
				{ pluginVersion: PLUGIN_VERSION, scopes: SCOPES, ...report, sorted: sortRules(report.rules) },
				null,
				2,
			) + '\n',
		)
	} else {
		process.stdout.write(humanReport(report) + '\n')
	}
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) main()
