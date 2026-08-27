// plugin_version: 0.1.0
//
// End-to-end tests for the command-line side: finding the three settings
// files, surviving a broken one, and emitting the JSON the skill consumes.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AUDIT = fileURLToPath(new URL('./audit.ts', import.meta.url))

interface Fixture {
	root: string
	userSettings: string
}

/** Lays down a throwaway project with whichever scopes the test needs.
 *  Values are written verbatim, so a test can pass malformed JSON on purpose. */
function fixture(files: { user?: unknown; project?: unknown; local?: unknown }): Fixture {
	const root = mkdtempSync(join(tmpdir(), 'polish-permissions-'))
	mkdirSync(join(root, '.claude'), { recursive: true })
	const userSettings = join(root, 'user-settings.json')

	const write = (path: string, value: unknown) =>
		writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2))

	if (files.user !== undefined) write(userSettings, files.user)
	if (files.project !== undefined) write(join(root, '.claude', 'settings.json'), files.project)
	if (files.local !== undefined) write(join(root, '.claude', 'settings.local.json'), files.local)

	return { root, userSettings }
}

function run(fx: Fixture, ...extra: string[]): string {
	return execFileSync(
		process.execPath,
		[AUDIT, '--root', fx.root, '--user-settings', fx.userSettings, ...extra],
		{ encoding: 'utf8' },
	)
}

function runJson(fx: Fixture): any {
	return JSON.parse(run(fx, '--json'))
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
		mkdirSync(join(fx.root, '.claude', 'config'), { recursive: true })
		writeFileSync(
			join(fx.root, '.claude', 'config', 'polish-permissions.json'),
			JSON.stringify({ readonlyBash: ['mycli show *'] }),
		)
		const json = runJson(fx)
		assert.equal(json.rules[0].readonly, 'yes')
	})

	it('falls back to the built-in safelist when the config is unreadable', () => {
		const fx = fixture({ local: allow('Bash(git status)') })
		mkdirSync(join(fx.root, '.claude', 'config'), { recursive: true })
		writeFileSync(join(fx.root, '.claude', 'config', 'polish-permissions.json'), '{ not json')
		const json = runJson(fx)
		assert.equal(json.rules[0].readonly, 'yes')
	})
})

describe('the human-readable report', () => {
	it('names every finding section even when a section is empty', () => {
		const out = run(fixture({ local: allow('Read') }))
		for (const heading of [
			'Duplicated inside one file',
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
