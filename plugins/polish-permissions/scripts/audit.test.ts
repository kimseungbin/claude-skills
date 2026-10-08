// End-to-end tests for the command-line side: finding the settings files
// Claude Code loads and the ones above the project it never loads, surviving a
// broken one, and emitting the JSON the skill consumes.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ancestorDirs, loadChain } from './audit.ts'

const AUDIT = fileURLToPath(new URL('./audit.ts', import.meta.url))

interface Fixture {
	/** Stands in for the home directory, so the walk up stops here. */
	home: string
	/** A git repository inside `home`, where the session starts. */
	project: string
}

/** Writes a value verbatim, so a test can pass malformed JSON on purpose. */
function write(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true })
	writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

/** Lays down a throwaway home directory holding one git repository, with
 *  whichever scopes the test needs. */
function fixture(files: { user?: unknown; project?: unknown; local?: unknown }): Fixture {
	const home = realpathSync(mkdtempSync(join(tmpdir(), 'polish-permissions-')))
	const project = join(home, 'repos', 'app')
	mkdirSync(join(project, '.git'), { recursive: true })

	if (files.user !== undefined) write(join(home, '.claude', 'settings.json'), files.user)
	if (files.project !== undefined) write(join(project, '.claude', 'settings.json'), files.project)
	if (files.local !== undefined) write(join(project, '.claude', 'settings.local.json'), files.local)

	return { home, project }
}

function run(fx: Fixture, ...extra: string[]): string {
	return runAt(fx.project, fx, ...extra)
}

function runAt(cwd: string, fx: Fixture, ...extra: string[]): string {
	return execFileSync(process.execPath, [AUDIT, '--cwd', cwd, '--home', fx.home, ...extra], {
		encoding: 'utf8',
	})
}

function runJson(fx: Fixture, cwd = fx.project): any {
	return JSON.parse(runAt(cwd, fx, '--json'))
}

const allow = (...rules: string[]) => ({ permissions: { allow: rules } })

// ---------------------------------------------------------------------------

describe('locating the three scopes', () => {
	it('reports a scope whose file does not exist as missing rather than failing', () => {
		const out = run(fixture({ local: allow('Read') }))
		assert.match(out, /user\s+missing/)
		assert.match(out, /project\s+missing/)
		assert.match(out, /local\s+1 rules/)
	})

	it('runs against a project with no settings files at all', () => {
		const out = run(fixture({}))
		assert.match(out, /local\s+missing/)
		assert.doesNotMatch(out, /PARSE ERROR/)
	})
})

describe('a settings file that does not parse', () => {
	// This matters more than any other finding: Claude Code silently ignores a
	// malformed settings file, so every rule in it stops applying with no error.
	it('is called out loudly instead of being treated as empty', () => {
		const out = run(fixture({ project: '{ "permissions": { "allow": [ }', local: allow('Read') }))
		assert.match(out, /project\s+PARSE ERROR/)
		assert.match(out, /disables every setting in it, silently/)
	})

	it('does not stop the other scopes from being analysed', () => {
		const json = runJson(fixture({ project: '{ broken', local: allow('Read') }))
		assert.deepEqual(json.rules.map((r: any) => r.raw), ['Read'])
	})

	it('records the parse error against the file it came from', () => {
		const json = runJson(fixture({ local: '{ broken' }))
		const local = json.files.find((f: any) => f.scope === 'local')
		assert.equal(local.exists, true)
		assert.ok(local.error)
	})
})

describe('the JSON the skill consumes', () => {
	it('carries the plugin version so a stale script can be detected', () => {
		const json = runJson(fixture({ local: allow('Read') }))
		assert.match(json.pluginVersion, /^\d+\.\d+\.\d+$/)
	})

	it('reports the version the manifest declares, not a copy of it', () => {
		// The pre-commit hook bumps plugin.json and propagates only into
		// config/**/*.yaml and bundles/**/*.sh. This plugin has neither, so a
		// version literal restated in these files would never be corrected.
		// Deriving it cannot drift; this test fails if anyone restates it.
		const manifest = JSON.parse(
			readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'),
		)
		const json = runJson(fixture({ local: allow('Read') }))
		assert.equal(json.pluginVersion, manifest.version)
	})

	it('exposes findings, families and the tidied lists', () => {
		const json = runJson(fixture({ user: allow('Bash(git *)'), local: allow('Bash(git status)') }))
		assert.ok(json.findings.subsumed.length >= 1)
		assert.ok(json.families.some((f: any) => f.name === 'Bash:git'))
		assert.deepEqual(json.sorted.local.allow, ['Bash(git status)'])
	})

	it('reports every rule with the scope it was found in', () => {
		const json = runJson(fixture({ user: allow('WebSearch'), local: allow('Read') }))
		assert.deepEqual(json.rules.map((r: any) => [r.scope, r.raw]).sort(), [
				['local', 'Read'],
				['user', 'WebSearch'],
			])
	})
})

describe('project config that extends the safelist', () => {
	it('is picked up from .claude/config/polish-permissions.json', () => {
		const fx = fixture({ local: allow('Bash(mycli show users)') })
		write(join(fx.project, '.claude', 'config', 'polish-permissions.json'), { readonlyBash: ['mycli show *'] })
		const json = runJson(fx)
		assert.equal(json.rules[0].readonly, 'yes')
	})

	it('falls back to the built-in safelist when the config is unreadable', () => {
		const fx = fixture({ local: allow('Bash(git status)') })
		write(join(fx.project, '.claude', 'config', 'polish-permissions.json'), '{ not json')
		const json = runJson(fx)
		assert.equal(json.rules[0].readonly, 'yes')
	})
})

describe('the human-readable report', () => {
	it('names every finding section even when a section is empty', () => {
		const out = run(fixture({ local: allow('Read') }))
		for (const heading of [
			'Duplicated inside one scope',
			'Settings files above this project that never load here',
			'Committed allow rules',
			'Present in more than one scope',
			'Already covered by a broader rule',
			'allow / deny overlap',
			'Safelisted wildcards',
			'Families',
		]) {
			assert.ok(out.includes(heading), `missing section: ${heading}`)
		}
	})

	it('marks a promotable family with an arrow and a mutating one with a dot', () => {
		const out = run(
			fixture({ local: allow('Bash(gh issue view *)', 'Bash(gh pr list *)', 'Bash(terraform apply)') }),
		)
		assert.match(out, /↑ Bash:gh/)
		assert.match(out, /· Bash:terraform/)
	})
})

describe('which files Claude Code loads for the session', () => {
	const paths = (fx: Fixture, cwd: string, platform?: NodeJS.Platform) =>
		loadChain(cwd, fx.home, platform).map((f) => [f.scope, f.path.slice(fx.home.length), !!f.legacy])

	it('reads shared settings from the working directory and local settings from the git root', () => {
		const fx = fixture({})
		const sub = join(fx.project, 'packages', 'api')
		mkdirSync(sub, { recursive: true })
		assert.deepEqual(paths(fx, sub), [
			['user', '/.claude/settings.json', false],
			['project', '/repos/app/packages/api/.claude/settings.json', false],
			['local', '/repos/app/.claude/settings.local.json', false],
		])
	})

	it('also reads a leftover local file in the working directory', () => {
		const fx = fixture({})
		const sub = join(fx.project, 'packages', 'api')
		write(join(sub, '.claude', 'settings.local.json'), allow('Read'))
		assert.deepEqual(paths(fx, sub).at(-1), ['local', '/repos/app/packages/api/.claude/settings.local.json', true])
	})

	it('reads local settings from the working directory outside a git repository', () => {
		const fx = fixture({})
		const plain = join(fx.home, 'notes')
		mkdirSync(plain)
		assert.deepEqual(paths(fx, plain).at(-1), ['local', '/notes/.claude/settings.local.json', false])
	})

	it('reads local settings from the working directory when the git root is home', () => {
		const fx = fixture({})
		mkdirSync(join(fx.home, '.git'))
		const plain = join(fx.home, 'notes')
		mkdirSync(plain)
		assert.deepEqual(paths(fx, plain).at(-1), ['local', '/notes/.claude/settings.local.json', false])
	})

	it('reads local settings from the working directory on Windows', () => {
		const fx = fixture({})
		const sub = join(fx.project, 'packages', 'api')
		mkdirSync(sub, { recursive: true })
		assert.deepEqual(paths(fx, sub, 'win32').at(-1), [
			'local',
			'/repos/app/packages/api/.claude/settings.local.json',
			false,
		])
	})

	it('counts the user settings file once when the session starts in home', () => {
		const fx = fixture({})
		assert.equal(paths(fx, fx.home).filter(([, p]) => p === '/.claude/settings.json').length, 1)
	})
})

describe('settings files above the project', () => {
	it('walks up to home and no further', () => {
		const fx = fixture({})
		assert.deepEqual(ancestorDirs(fx.project, fx.home), [fx.project, join(fx.home, 'repos'), fx.home])
	})

	it('lists a parent directory’s settings file, which applies to nothing below it', () => {
		const fx = fixture({})
		write(join(fx.home, 'repos', '.claude', 'settings.local.json'), allow('Bash(gh repo list *)'))
		const json = runJson(fx)
		assert.deepEqual(
			json.inert.map((f: any) => [f.path.slice(fx.home.length), f.loadsFor.slice(fx.home.length)]),
			[['/repos/.claude/settings.local.json', '/repos']],
		)
	})

	it('lists the local file in home, which is not user scope', () => {
		const fx = fixture({})
		write(join(fx.home, '.claude', 'settings.local.json'), allow('WebSearch'))
		const json = runJson(fx)
		assert.deepEqual(json.inert.map((f: any) => f.path.slice(fx.home.length)), ['/.claude/settings.local.json'])
	})

	it('lists the git root’s shared settings when the session starts in a subdirectory', () => {
		const fx = fixture({ project: allow('Read') })
		const sub = join(fx.project, 'packages', 'api')
		mkdirSync(sub, { recursive: true })
		const json = runJson(fx, sub)
		assert.deepEqual(json.inert.map((f: any) => f.path.slice(fx.home.length)), ['/repos/app/.claude/settings.json'])
	})

	it('leaves out every file the session loads', () => {
		const fx = fixture({ user: allow('Read'), project: allow('Read'), local: allow('Read') })
		assert.deepEqual(runJson(fx).inert, [])
	})

	it('marks each rule for promotion, keeping, asking, or as already granted', () => {
		const fx = fixture({ user: allow('WebSearch') })
		write(
			join(fx.home, 'repos', '.claude', 'settings.local.json'),
			allow('WebSearch', 'Bash(gh issue view *)', 'Bash(terraform apply)', 'mcp__linear__list_issues'),
		)
		const [file] = runJson(fx).inert
		assert.deepEqual(
			file.rules.map((r: any) => [r.raw, r.recommendation]),
			[
				['WebSearch', 'already-granted'],
				['Bash(gh issue view *)', 'promote-to-user'],
				['Bash(terraform apply)', 'keep'],
				['mcp__linear__list_issues', 'ask'],
			],
		)
	})

	it('reports a file above the project that does not parse', () => {
		const fx = fixture({})
		write(join(fx.home, 'repos', '.claude', 'settings.local.json'), '{ broken')
		const out = run(fx)
		assert.match(out, /settings\.local\.json\s+PARSE ERROR/)
	})
})

describe('committed rules: project policy or personal preference', () => {
	it('calls a rule that names a package.json script project policy', () => {
		const fx = fixture({ project: allow('Bash(npm run lint *)') })
		write(join(fx.project, 'package.json'), { scripts: { lint: 'eslint .' } })
		const [verdict] = runJson(fx).projectRules
		assert.equal(verdict.verdict, 'project-policy')
		assert.match(verdict.reference, /script "lint"/)
	})

	it('finds scripts in workspace packages', () => {
		const fx = fixture({ project: allow('Bash(npm run type-check:*)') })
		write(join(fx.project, 'package.json'), { workspaces: ['packages/*'] })
		write(join(fx.project, 'packages', 'web', 'package.json'), { scripts: { 'type-check': 'tsc' } })
		assert.equal(runJson(fx).projectRules[0].verdict, 'project-policy')
	})

	it('calls a rule for one of the repository’s MCP servers project policy', () => {
		const fx = fixture({ project: allow('mcp__cdk__*') })
		write(join(fx.project, '.mcp.json'), { mcpServers: { cdk: { command: 'cdk-mcp' } } })
		assert.equal(runJson(fx).projectRules[0].verdict, 'project-policy')
	})

	it('calls a rule that names a path in the repository project policy', () => {
		const fx = fixture({ project: allow('Bash(./scripts/deploy.sh *)') })
		write(join(fx.project, 'scripts', 'deploy.sh'), '#!/bin/sh')
		assert.equal(runJson(fx).projectRules[0].verdict, 'project-policy')
	})

	it('flags a generic rule as a likely personal preference, with where else it is granted', () => {
		const fx = fixture({ user: allow('WebSearch'), project: allow('WebSearch', 'Bash(git log *)') })
		write(join(fx.home, '.claude', 'settings.local.json'), allow('Bash(git *)'))
		const verdicts = runJson(fx).projectRules
		assert.deepEqual(
			verdicts.map((v: any) => [v.rule, v.verdict, v.evidence.map((e: string) => e.replace(fx.home, '~'))]),
			[
				['WebSearch', 'likely-personal', ['also in user scope']],
				['Bash(git log *)', 'likely-personal', ['covered in ~/.claude/settings.local.json by Bash(git *)']],
			],
		)
	})

	it('leaves committed deny rules out, since a team commits those on purpose', () => {
		const fx = fixture({ project: { permissions: { deny: ['Bash(rm -rf *)'] } } })
		assert.deepEqual(runJson(fx).projectRules, [])
	})
})
