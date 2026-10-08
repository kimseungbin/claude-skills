import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

import {
	conclude,
	failureSignature,
	formatCommand,
	judgeByExit,
	judgeEdited,
	matchesWhen,
	planChecks,
	resolveConfig,
	testVerdict,
	verdictAsResult,
	watchCommand,
	withinRoot,
	type Check,
	type CheckResult,
	type Location,
	type RunOutcome,
	type Trigger,
} from './core.ts'
import { parseOutput, type Diagnostic } from './parsers.ts'

const FORMAT = 'prettier --write'

const SANDBOX = mkdtempSync(`${tmpdir()}/lint-gate-quoting-`)

/**
 * The checkout root the planning cases resolve against.
 *
 * `/tmp` because every hostile-path fixture below is already rooted there, so
 * those cases stay about quoting rather than about bounding.
 */
const ROOT = '/tmp'

/** Somewhere Claude Code legitimately writes that no project command can check. */
const OUTSIDE = '/Users/someone/.claude/plans/refactor-the-gate.md'

/** A resolved check with every default filled, for tests that build checks directly. */
function check(overrides: Partial<Check> & Pick<Check, 'name' | 'scope'>): Check {
	return { when: null, cwd: '', report: 'all', timeoutSec: 180, ...overrides }
}

const BASE = { name: 'lint', command: 'eslint {files}', root: ROOT }

function fail(name: string, output: string, extra: Partial<CheckResult> = {}): CheckResult {
	return { name, command: `${name}-command`, root: ROOT, ok: false, output, ...extra }
}

function pass(name: string, output = '', extra: Partial<CheckResult> = {}): CheckResult {
	return { name, command: `${name}-command`, root: ROOT, ok: true, output, ...extra }
}

function concludeFor(
	results: CheckResult[],
	options: { trigger?: Trigger; alreadyBlocked?: string[]; alreadyNotified?: string[]; stopHookActive?: boolean; notes?: string[] } = {},
) {
	return conclude({
		trigger: options.trigger ?? 'Stop',
		results,
		alreadyBlocked: options.alreadyBlocked ?? [],
		alreadyNotified: options.alreadyNotified ?? [],
		stopHookActive: options.stopHookActive,
		notes: options.notes,
	})
}

function assertBlocked(conclusion: { block: string | null }, message?: string): string {
	assert.equal(typeof conclusion.block, 'string', message ?? 'expected a block, got none')
	assert.ok((conclusion.block as string).length > 0, 'a block reason must not be empty')
	return conclusion.block as string
}

/**
 * Runs a built command through a real shell and returns what it printed. Every
 * base here is `printf [%s]`, so a correctly quoted path yields exactly `[path]`
 * and a correctly quoted list of N paths yields `[a][b]…`: one argument each,
 * nothing split, nothing else executed. Style-agnostic — it checks the quoting
 * works, not which quoting was chosen.
 */
function runInShell(cmd: string): string {
	try {
		return execFileSync('/bin/sh', ['-c', cmd], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			// A quoting bug turns these paths into real commands; keep any fallout out of the repo.
			cwd: SANDBOX,
		})
	} catch (err) {
		assert.fail(`/bin/sh rejected the built command, so the path was not safely quoted:\n${cmd}\n${String(err)}`)
	}
}

/** What a shell sees for the one path a format command is built around. */
function shellSees(base: string, filePath: string): string {
	return runInShell(formatCommand(base, filePath))
}

/** What a shell sees for the file list a `files` check is planned with. Paths are given root-relative. */
function shellSeesPlanned(base: string, relativeFiles: string[]): string {
	const [planned] = planChecks([check({ name: 'lint', scope: 'files', command: base })], [
		{ root: ROOT, files: relativeFiles.map((file) => `${ROOT}/${file}`) },
	])
	assert.ok(planned, `planChecks dropped a check it was supposed to fill: ${base}`)
	return runInShell(planned.command)
}

function assertPathSurvivesShell(filePath: string, message?: string): void {
	assert.equal(shellSees('printf [%s]', filePath), `[${filePath}]`, message ?? `path mangled or unquoted: ${filePath}`)
}

/**
 * Three distinct ways a path can escape its quoting: word splitting, breaking the
 * quoting scheme itself, and outright execution.
 */
const REPRESENTATIVE_PATHS: Array<[string, string]> = [
	['a space', '/tmp/my file.ts'],
	['a single quote', "/tmp/it's.ts"],
	['command substitution', '/tmp/a$(echo pwned).ts'],
]

/**
 * A path is also a replacement string as far as `String.prototype.replace` is
 * concerned: with a replacement string rather than a callback, `$&` re-inserts the
 * token that was just consumed and `$1` inserts an empty string. Swept everywhere
 * a token is substituted, since that grammar only exists on those routes and no
 * amount of shell quoting protects against it.
 */
const REPLACEMENT_PATTERN_PATHS: Array<[string, string]> = [
	['a regex replacement pattern', '/tmp/a$&b.ts'],
	['a regex capture reference', '/tmp/a$1b.ts'],
	['every replacement pattern at once', "/tmp/a$&$1$`$'$$b.ts"],
]

/** Every path a tool payload can legitimately carry that also means something to a shell. */
const HOSTILE_PATHS: Array<[string, string]> = [
	...REPRESENTATIVE_PATHS,
	['a double quote', '/tmp/a"b.ts'],
	['a semicolon', '/tmp/a;echo pwned;.ts'],
	['a command separator', '/tmp/a && echo pwned.ts'],
	['a pipe', '/tmp/a | echo pwned.ts'],
	['backticks', '/tmp/a`echo pwned`.ts'],
	['a variable reference', '/tmp/$HOME.ts'],
	['a glob', '/tmp/*'],
	['a tilde', '~/a.ts'],
	['a newline', '/tmp/a\nb.ts'],
	['a tab', '/tmp/a\tb.ts'],
	['a backslash', '/tmp/a\\b.ts'],
	['a redirect', '/tmp/a > pwned.ts'],
	['a subshell', '/tmp/(a).ts'],
	['a dash in the name', '/tmp/-rf.ts'],
	['every trick at once', `/tmp/a'"\`$(echo x) ;&|>*.ts`],
	...REPLACEMENT_PATTERN_PATHS,
]

/** The representatives plus the paths that only a substituted token can mangle. */
const SUBSTITUTED_PATHS: Array<[string, string]> = [...REPRESENTATIVE_PATHS, ...REPLACEMENT_PATTERN_PATHS]

/** Root-relative form of a `/tmp/…` fixture path, as a `files` check receives it. */
function underRoot(filePath: string): string {
	return filePath.replace(/^\/tmp\//, '')
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

describe('resolveConfig', () => {
	const files = { name: 'lint', scope: 'files', command: 'eslint {files}' }
	const program = { name: 'typecheck', scope: 'program', command: 'tsc --noEmit' }
	const unit = { name: 'test', scope: 'unit', command: 'npm test' }

	it('keeps format and a list of checks, filling the defaults', () => {
		const { config, problems } = resolveConfig({ format: FORMAT, checks: [files, program, unit] })
		assert.deepEqual(problems, [])
		assert.equal(config.format, FORMAT)
		assert.deepEqual(config.checks, [
			{ name: 'lint', scope: 'files', command: 'eslint {files}', when: null, cwd: '', report: 'all', timeoutSec: 180 },
			{ name: 'typecheck', scope: 'program', command: 'tsc --noEmit', when: null, cwd: '', report: 'all', timeoutSec: 180 },
			{ name: 'test', scope: 'unit', command: 'npm test', when: null, cwd: '', report: 'all', timeoutSec: 180 },
		])
	})

	it('keeps every optional field it was given', () => {
		const { config, problems } = resolveConfig({
			checks: [
				{
					name: 'typecheck:api',
					scope: 'program',
					command: 'npx tsc --noEmit --pretty false -p .',
					when: ['workspaces/{api,shared}/**', 'package-lock.json'],
					cwd: 'workspaces/api/',
					report: 'edited',
					parse: 'tsc',
					timeoutSec: 300,
				},
			],
		})
		assert.deepEqual(problems, [])
		assert.deepEqual(config.checks[0], {
			name: 'typecheck:api',
			scope: 'program',
			command: 'npx tsc --noEmit --pretty false -p .',
			when: ['workspaces/{api,shared}/**', 'package-lock.json'],
			cwd: 'workspaces/api',
			report: 'edited',
			parse: 'tsc',
			timeoutSec: 300,
		})
	})

	it('reads a single when glob as a one-element list', () => {
		assert.deepEqual(resolveConfig({ checks: [{ ...files, when: 'src/**' }] }).config.checks[0].when, ['src/**'])
	})

	it('keeps a watch command on a unit check', () => {
		const watch = 'npx vitest --watch --reporter=json --outputFile={status}'
		const { config, problems } = resolveConfig({ checks: [{ name: 'test', scope: 'unit', watch }] })
		assert.deepEqual(problems, [])
		assert.equal(config.checks[0].watch, watch)
		assert.equal(config.checks[0].command, undefined)
	})

	it('accepts an absent format and checks as "nothing configured"', () => {
		assert.deepEqual(resolveConfig({}), { config: { checks: [] }, problems: [] })
	})

	it('accepts the shipped sample config without a single problem', () => {
		const sample = JSON.parse(readFileSync(new URL('../config/samples/lint-gate.json', import.meta.url), 'utf8')) as unknown
		const { config, problems } = resolveConfig(sample)
		assert.deepEqual(problems, [])
		assert.ok(config.checks.length > 0)
	})

	it('allows a $comment key, which the shipped sample uses', () => {
		assert.deepEqual(resolveConfig({ $comment: ['notes'], checks: [] }).problems, [])
	})

	describe('reports what it ignores, and ignores it whole', () => {
		const dropped: Array<[string, unknown, RegExp]> = [
			['a files check without {files}', { ...files, command: 'eslint .' }, /no \{files\}/],
			['a program check with {files}', { ...program, command: 'tsc {files}' }, /runs whole/],
			['a unit check with {files}', { ...unit, command: 'vitest related {files}' }, /runs whole/],
			['a check using {file}', { ...files, command: 'eslint {file} {files}' }, /belongs to `format`/],
			['an unknown scope', { ...files, scope: 'lint' }, /scope/],
			['a missing scope', { name: 'x', command: 'x {files}' }, /scope/],
			['a missing name', { scope: 'unit', command: 'x' }, /no name/],
			['a blank name', { ...unit, name: '  ' }, /no name/],
			['both command and watch', { ...unit, watch: 'x {status}' }, /exactly one/],
			['neither command nor watch', { name: 'x', scope: 'unit' }, /exactly one/],
			['a blank command', { ...unit, command: '  ' }, /blank/],
			['a watch on a program check', { name: 'x', scope: 'program', watch: 'x {status}' }, /only a "unit"/],
			['a watch without {status}', { name: 'x', scope: 'unit', watch: 'vitest --watch' }, /\{status\}/],
			['{status} in a command', { ...unit, command: 'x > {status}' }, /\{status\}/],
			['an empty when list', { ...files, when: [] }, /when/],
			['a non-string when', { ...files, when: 7 }, /when/],
			['a blank when entry', { ...files, when: ['src/**', ' '] }, /when/],
			['an absolute cwd', { ...unit, cwd: '/etc' }, /cwd/],
			['a cwd escaping the checkout', { ...unit, cwd: 'a/../../b' }, /cwd/],
			['an unknown report', { ...program, report: 'new' }, /report/],
			['report edited on a files check', { ...files, report: 'edited', parse: 'tsc' }, /only a "program"/],
			['report edited without parse', { ...program, report: 'edited' }, /parse/],
			['report edited with an unknown parser', { ...program, report: 'edited', parse: 'eslint' }, /parse/],
			['parse without report edited', { ...program, parse: 'tsc' }, /without `report: "edited"`/],
			['a zero timeout', { ...unit, timeoutSec: 0 }, /timeoutSec/],
			['a string timeout', { ...unit, timeoutSec: '60' }, /timeoutSec/],
			['an unknown field', { ...unit, always: true }, /unknown field `always`/],
			['a string entry', 'eslint .', /not an object/],
			['a null entry', null, /not an object/],
		]

		for (const [label, entry, reason] of dropped) {
			it(`drops ${label}`, () => {
				const { config, problems } = resolveConfig({ checks: [entry, unit] })
				assert.deepEqual(
					config.checks.map((kept) => kept.name),
					['test'],
					'the malformed check must be dropped and its valid sibling kept',
				)
				assert.equal(problems.length, 1, `expected one problem, got ${JSON.stringify(problems)}`)
				assert.match(problems[0], reason)
			})
		}
	})

	it('drops a second check with the same name, keeping the first', () => {
		const { config, problems } = resolveConfig({ checks: [unit, { ...unit, command: 'npm run other' }] })
		assert.deepEqual(config.checks.map((kept) => kept.command), ['npm test'])
		assert.match(problems[0], /repeats the name "test"/)
	})

	it('names each retired key and how to migrate it', () => {
		const { config, problems } = resolveConfig({ lint: 'npm run lint', typecheck: 'tsc', test: { watch: 'x {status}' } })
		assert.deepEqual(config.checks, [])
		assert.equal(problems.length, 3)
		for (const [index, key] of ['lint', 'typecheck', 'test'].entries()) {
			assert.match(problems[index], new RegExp(`\`${key}\` is no longer a lint-gate key`))
			assert.match(problems[index], /\/lint-setup/)
		}
	})

	it('names an unknown key without dropping the rest', () => {
		const { config, problems } = resolveConfig({ checks: [unit], extra: true })
		assert.equal(config.checks.length, 1)
		assert.deepEqual(problems, ['`extra` is not a lint-gate key and is ignored'])
	})

	it('reports a non-list checks', () => {
		assert.match(resolveConfig({ checks: { lint: 'x' } }).problems[0], /must be a list/)
	})

	it('reports a blank format and runs no formatter', () => {
		const { config, problems } = resolveConfig({ format: '  ' })
		assert.equal(config.format, undefined)
		assert.match(problems[0], /format/)
	})

	describe('fails open — junk degrades to "run nothing", never a throw', () => {
		for (const [label, raw] of [
			['null', null],
			['undefined', undefined],
			['a string', 'eslint .'],
			['a number', 42],
			['an array', [{ name: 'x' }]],
		] as Array<[string, unknown]>) {
			it(`yields no checks for ${label}`, () => {
				const { config } = resolveConfig(raw)
				assert.deepEqual(config, { checks: [] })
			})
		}
	})
})

// ---------------------------------------------------------------------------
// paths and planning
// ---------------------------------------------------------------------------

describe('withinRoot', () => {
	it('keeps a path inside the root', () => assert.equal(withinRoot('/repo', '/repo/src/a.ts'), true))
	it('keeps a relative path resolved against the root', () => assert.equal(withinRoot('/repo', 'src/a.ts'), true))
	it('drops the root itself', () => assert.equal(withinRoot('/repo', '/repo'), false))
	it('drops a path escaping through ..', () => assert.equal(withinRoot('/repo', '/repo/../etc/passwd'), false))
	it('keeps a file whose name merely begins with ..', () => assert.equal(withinRoot('/repo', '/repo/..rc.ts'), true))
	it('drops a sibling sharing the root prefix', () => assert.equal(withinRoot('/repo', '/repo-other/a.ts'), false))
	it('drops everything against a junk root', () => {
		assert.equal(withinRoot('', '/repo/a.ts'), false)
		assert.equal(withinRoot(null as never, '/repo/a.ts'), false)
	})
})

describe('matchesWhen', () => {
	it('matches every path when no when was configured', () => {
		assert.equal(matchesWhen('.github/workflows/ci.yml', null), true)
		assert.equal(matchesWhen('src/a.ts', null), true)
	})

	it('matches any glob in the list', () => {
		const when = ['workspaces/{api,shared}/**', 'tsconfig.base.json']
		assert.equal(matchesWhen('workspaces/shared/x.ts', when), true)
		assert.equal(matchesWhen('tsconfig.base.json', when), true)
		assert.equal(matchesWhen('workspaces/admin/x.ts', when), false)
	})

	it('uses standard glob semantics, so ** does not reach a dotfile unless the glob names the dot', () => {
		assert.equal(matchesWhen('.eslintrc.js', ['**/*.js']), false)
		assert.equal(matchesWhen('.eslintrc.js', ['.eslintrc.js']), true)
	})
})

describe('planChecks', () => {
	const lint = check({ name: 'lint', scope: 'files', command: String.raw`printf '[%s]' {files}` })
	const typecheck = check({ name: 'typecheck', scope: 'program', command: 'tsc --noEmit' })
	const tests = check({ name: 'test', scope: 'unit', command: 'npm test' })

	it('owes nothing when nothing was edited, whatever the scope', () => {
		assert.deepEqual(planChecks([lint, typecheck, tests], []), [])
		assert.deepEqual(planChecks([lint, typecheck, tests], [{ root: '/repo', files: [] }]), [])
	})

	it('owes every check without a when once anything in the checkout was edited', () => {
		const planned = planChecks([lint, typecheck, tests], [{ root: '/repo', files: ['/repo/README.md'] }])
		assert.deepEqual(planned.map((plan) => plan.check.name), ['lint', 'typecheck', 'test'])
	})

	it('owes a check only when an edited path matches its when', () => {
		const scoped = check({ ...typecheck, when: ['packages/api/**'] })
		assert.deepEqual(planChecks([scoped], [{ root: '/repo', files: ['/repo/packages/admin/a.ts'] }]), [])
		assert.equal(planChecks([scoped], [{ root: '/repo', files: ['/repo/packages/api/a.ts'] }]).length, 1)
	})

	it('hands a files check only its matched paths, relative to its run directory', () => {
		const admin = check({ ...lint, when: ['packages/admin/**'], cwd: 'packages/admin' })
		const [plan] = planChecks([admin], [{ root: '/repo', files: ['/repo/packages/api/a.ts', '/repo/packages/admin/src/b.css'] }])
		assert.equal(plan.runDir, '/repo/packages/admin')
		assert.deepEqual(plan.matched, ['/repo/packages/admin/src/b.css'])
		assert.equal(plan.command, String.raw`printf '[%s]' 'src/b.css'`)
	})

	it('leaves program and unit commands exactly as written', () => {
		const planned = planChecks([typecheck, tests], [{ root: '/repo', files: ['/repo/a.ts'] }])
		assert.deepEqual(planned.map((plan) => plan.command), ['tsc --noEmit', 'npm test'])
	})

	it('plans each checkout separately, against its own root', () => {
		const planned = planChecks([lint], [
			{ root: '/repo', files: ['/repo/a.ts'] },
			{ root: '/repo/.claude/worktrees/x', files: ['/repo/.claude/worktrees/x/b.ts'] },
		])
		assert.deepEqual(
			planned.map((plan) => [plan.root, plan.command]),
			[
				['/repo', String.raw`printf '[%s]' 'a.ts'`],
				['/repo/.claude/worktrees/x', String.raw`printf '[%s]' 'b.ts'`],
			],
		)
	})

	it('never hands a check a path outside its root', () => {
		const [plan] = planChecks([lint], [{ root: '/repo', files: ['/repo/a.ts', OUTSIDE, '/repo/../etc/passwd'] }])
		assert.deepEqual(plan.matched, ['/repo/a.ts'])
	})

	it('dedupes a path edited many times, keeping first-seen order', () => {
		const [plan] = planChecks([lint], [{ root: '/repo', files: ['/repo/b.ts', '/repo/a.ts', '/repo/b.ts'] }])
		assert.deepEqual(plan.matched, ['/repo/b.ts', '/repo/a.ts'])
	})

	it('keeps list order', () => {
		const planned = planChecks([tests, lint, typecheck], [{ root: '/repo', files: ['/repo/a.ts'] }])
		assert.deepEqual(planned.map((plan) => plan.check.name), ['test', 'lint', 'typecheck'])
	})

	it('skips junk groups rather than throwing', () => {
		assert.deepEqual(planChecks([lint], [null as never, { root: '', files: ['/a.ts'] }, { root: '/repo', files: null as never }]), [])
		assert.deepEqual(planChecks(null as never, null as never), [])
	})

	describe('shell quoting the list — a mistake here is a shell injection', () => {
		for (const [label, filePath] of SUBSTITUTED_PATHS) {
			it(`survives ${label} as the only edited file`, () => {
				const relative = underRoot(filePath)
				assert.equal(shellSeesPlanned('printf [%s] {files}', [relative]), `[${relative}]`, `path mangled: ${filePath}`)
			})
		}

		for (const [label, filePath] of REPRESENTATIVE_PATHS) {
			it(`survives ${label} beside ordinary paths`, () => {
				const relative = underRoot(filePath)
				assert.equal(shellSeesPlanned('printf [%s] {files}', ['src/a.ts', relative, 'src/b.ts']), `[src/a.ts][${relative}][src/b.ts]`)
			})
		}

		it('does not execute a command injected from anywhere in the list', () => {
			const out = shellSeesPlanned('printf [%s] {files}', ['src/a.ts', 'x; echo pwned', 'src/b.ts'])
			assert.doesNotMatch(out, /pwned$/m, 'the injected echo must never run')
			assert.equal(out, '[src/a.ts][x; echo pwned][src/b.ts]')
		})

		it('does not treat a token inside a path as a placeholder', () => {
			assert.equal(shellSeesPlanned('printf [%s] {files}', ['{file}/a.ts', '{files}/b.ts']), '[{file}/a.ts][{files}/b.ts]')
		})
	})
})

describe('formatCommand', () => {
	describe('placeholder substitution', () => {
		it('substitutes {file} in the middle of the base', () => {
			const cmd = formatCommand('prettier --write {file} --log-level warn', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{file\}/, 'the placeholder must be consumed')
			assert.match(cmd, /^prettier --write /)
			assert.match(cmd, / --log-level warn$/, 'the tail of the base must survive')
			assert.match(cmd, /src\/a\.ts/)
		})

		it('substitutes every occurrence', () => {
			const cmd = formatCommand('cmp -s {file} {file}', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{file\}/)
			assert.equal(cmd.split('src/a.ts').length - 1, 2, 'both placeholders must be filled')
		})

		it('passes exactly one argument through a shell when the placeholder is used', () => {
			assert.equal(shellSees('printf [%s] {file}', 'src/a.ts'), '[src/a.ts]')
		})

		it('does not also append the path when the placeholder is present', () => {
			const cmd = formatCommand('prettier --write {file}', 'src/a.ts')
			assert.equal(cmd.split('src/a.ts').length - 1, 1, 'the path must appear once, not substituted and appended')
		})
	})

	/**
	 * A format command written with `{files}` is honored rather than corrected: it
	 * runs once per edit, so the list it asks for is the one file being formatted.
	 */
	describe('a base written with the plural {files}', () => {
		it('substitutes the one path being formatted', () => {
			assert.equal(shellSees('printf [%s] {files}', 'src/a.ts'), '[src/a.ts]')
		})

		/**
		 * Whole tokens only: matching `{file}` inside `{files}` would consume the
		 * plural's head and leave its `s}` tail behind as a stray shell argument.
		 */
		it('leaves no token and no stray tail behind', () => {
			const cmd = formatCommand('prettier --write {files}', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{files?\}/, 'the placeholder must be consumed')
			assert.doesNotMatch(cmd, /s\}/, 'no fragment of the plural token may survive as a stray argument')
			assert.equal(cmd.split('src/a.ts').length - 1, 1, 'the path must appear once, not substituted and appended')
		})

		it('keeps the text on both sides of the placeholder', () => {
			const cmd = formatCommand('prettier --write {files} --log-level warn', 'src/a.ts')
			assert.match(cmd, /^prettier --write /)
			assert.match(cmd, / --log-level warn$/, 'the tail of the base must survive')
		})

		it('substitutes every occurrence', () => {
			assert.equal(shellSees('printf [%s] {files} {files}', 'src/a.ts'), '[src/a.ts][src/a.ts]')
		})

		it('fills both tokens when a base uses each', () => {
			const cmd = formatCommand('cmp -s {file} {files}', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{files?\}/)
			assert.doesNotMatch(cmd, /s\}/)
			assert.equal(cmd.split('src/a.ts').length - 1, 2, 'both placeholders must be filled')
			assert.equal(shellSees('printf [%s] {file} {files}', 'src/a.ts'), '[src/a.ts][src/a.ts]')
		})

		/**
		 * Regression — the tokens were once filled in two passes, and an edited path
		 * may itself contain the literal `{file}`. The second pass read that as a
		 * placeholder and substituted into the middle of the quoted string the first
		 * pass had just inserted, closing the quotes and leaving the remainder of the
		 * path as live shell text: an injection, not merely a wrong path. What protects
		 * against it is that a replacement is never rescanned — one pass over the
		 * original base. `scopeCommands` never rescanned and was never affected.
		 */
		it('does not re-fill a {file} that arrived inside the path', () => {
			assertPathSurvivesShell('/tmp/{file}/a.ts')
			assert.equal(shellSees('printf [%s] {files}', '/tmp/{file}/a.ts'), '[/tmp/{file}/a.ts]')
			assert.equal(shellSees('printf [%s] {file}', '/tmp/{file}/a.ts'), '[/tmp/{file}/a.ts]', 'the {file} base is fine')
		})

		it('does not re-fill a {files} that arrived inside the path', () => {
			assert.equal(shellSees('printf [%s] {file}', '/tmp/{files}/a.ts'), '[/tmp/{files}/a.ts]')
			assert.equal(shellSees('printf [%s] {files}', '/tmp/{files}/a.ts'), '[/tmp/{files}/a.ts]')
		})

		it('does not execute a command hidden behind a {file} in the path', () => {
			// A marker file, because the injected command's own output would be
			// indistinguishable from the path text printf echoes back.
			const marker = `${SANDBOX}/injected-through-files-token`
			const filePath = `/tmp/a{file};touch ${marker}`
			const out = shellSees('printf [%s] {files}', filePath)
			assert.equal(existsSync(marker), false, 'the injected command must never run')
			assert.equal(out, `[${filePath}]`)
		})
	})

	describe('appending when there is no placeholder', () => {
		it('keeps the base intact at the front', () => {
			const cmd = formatCommand('prettier --write', 'src/a.ts')
			assert.equal(cmd.startsWith('prettier --write'), true)
			assert.match(cmd, /src\/a\.ts/)
		})

		it('separates the base from the path', () => {
			const cmd = formatCommand('prettier --write', 'src/a.ts')
			assert.doesNotMatch(cmd, /--writesrc/, 'the path must not be glued onto the last flag')
		})

		it('passes exactly one argument through a shell', () => {
			assert.equal(shellSees('printf [%s]', 'src/a.ts'), '[src/a.ts]')
		})
	})

	describe('shell quoting — a mistake here is a shell injection', () => {
		for (const [label, filePath] of HOSTILE_PATHS) {
			it(`survives ${label} when appended`, () => {
				assertPathSurvivesShell(filePath)
			})
		}

		for (const [label, filePath] of SUBSTITUTED_PATHS) {
			it(`survives ${label} when substituted into {file}`, () => {
				assert.equal(shellSees('printf [%s] {file}', filePath), `[${filePath}]`, `path mangled: ${filePath}`)
			})
		}

		for (const [label, filePath] of SUBSTITUTED_PATHS) {
			it(`survives ${label} when substituted into {files}`, () => {
				assert.equal(shellSees('printf [%s] {files}', filePath), `[${filePath}]`, `path mangled: ${filePath}`)
			})
		}

		it('does not execute an injected command', () => {
			const out = shellSees('printf [%s]', '/tmp/x; echo pwned')
			assert.doesNotMatch(out, /pwned$/m, 'the injected echo must never run')
			assert.equal(out, '[/tmp/x; echo pwned]')
		})

		it('leaves the raw path unquoted nowhere in the command', () => {
			const cmd = formatCommand('prettier --write', '/tmp/my file.ts')
			assert.doesNotMatch(cmd, /(^|\s)\/tmp\/my file\.ts(\s|$)/, 'a bare path with a space is two arguments')
		})
	})

	describe('edge cases', () => {
		it('handles an empty base', () => {
			assert.match(formatCommand('', 'src/a.ts'), /src\/a\.ts/)
		})

		it('handles a base that is only the placeholder', () => {
			assert.equal(shellSees('{file}', 'true'), '')
		})

		it('does not treat {file} inside the path as a placeholder', () => {
			assertPathSurvivesShell('/tmp/{file}/a.ts')
		})

		it('is pure — the same inputs give the same command', () => {
			assert.equal(formatCommand(FORMAT, 'src/a.ts'), formatCommand(FORMAT, 'src/a.ts'))
		})

		/**
		 * Repeated rather than merely compared twice: a module-level `/g` regex carries
		 * `lastIndex` across calls if it is ever driven by `.test()` or `.exec()`, which
		 * makes every other call resume mid-string and miss the token — a bug that hides
		 * from any single call and from any pair of calls on different bases.
		 */
		it('answers the same for a token base however many times it is called', () => {
			for (const base of ['prettier --write {file}', 'prettier --write {files}', 'cmp -s {file} {files}']) {
				const first = formatCommand(base, 'src/a.ts')
				assert.doesNotMatch(first, /\{files?\}/, `the placeholder must be consumed: ${base}`)
				for (let call = 2; call <= 5; call++) {
					assert.equal(formatCommand(base, 'src/a.ts'), first, `call ${call} of ${base} differed from the first`)
				}
			}
		})
	})
})

// ---------------------------------------------------------------------------
// judging a result
// ---------------------------------------------------------------------------

function ran(exitCode: number, stdout = '', stderr = ''): RunOutcome {
	return { ran: true, exitCode, stdout, stderr }
}

describe('judgeByExit', () => {
	it('passes on exit 0', () => assert.equal(judgeByExit(BASE, ran(0, 'fine')).ok, true))

	it('fails on a non-zero exit, showing the output', () => {
		const result = judgeByExit(BASE, ran(1, 'src/a.ts:1:1 no-unused-vars', 'warning on stderr'))
		assert.equal(result.ok, false)
		assert.match(result.output, /no-unused-vars/)
		assert.match(result.output, /warning on stderr/)
	})

	it('still explains a silent failure', () => {
		assert.match(judgeByExit(BASE, ran(3)).output, /exited 3 with no output/)
	})

	/** A check that cannot run is a check that did not pass. */
	it('fails a command the shell could not find', () => {
		const result = judgeByExit(BASE, ran(127, '', 'sh: eslint: command not found'))
		assert.equal(result.ok, false)
		assert.match(result.output, /could not be found/)
	})

	it('fails a check that did not run, saying why', () => {
		const result = judgeByExit(BASE, { ran: false, why: 'timed out after 180 s', stdout: 'partial', stderr: '' })
		assert.equal(result.ok, false)
		assert.match(result.output, /timed out after 180 s/)
		assert.match(result.output, /partial/)
	})
})

describe('judgeEdited — never fake a pass', () => {
	const TSC_RUN = [
		'src/a.ts(1,40): error TS2322: Type \'number\' is not assignable to type \'string\'.',
		'src/c.ts(5,3): error TS2345: Argument of type \'{ x: { y: string; }; }\' is not assignable to parameter of type \'{ x: { y: number; }; }\'.',
		"  The types of 'x.y' are incompatible between these types.",
		"    Type 'string' is not assignable to type 'number'.",
	].join('\n')

	/** Locates by file name: anything in `edited` is edited, a null file is global, the rest is elsewhere. */
	function judge(outcome: RunOutcome, edited: string[], locateOverride?: (d: Diagnostic) => Location) {
		const parsed = outcome.ran ? parseOutput('tsc', outcome.stdout, outcome.stderr, outcome.exitCode) : null
		const locate = locateOverride ?? ((d: Diagnostic): Location => (d.file === null ? 'global' : edited.includes(d.file) ? 'edited' : 'other'))
		return judgeEdited({ name: 'typecheck', command: 'tsc --noEmit --pretty false', root: ROOT }, outcome, parsed, locate)
	}

	it('fails a check that did not run, before parsing anything', () => {
		const result = judge({ ran: false, why: 'was killed by SIGKILL', stdout: '', stderr: '' }, [])
		assert.equal(result.ok, false)
		assert.match(result.output, /SIGKILL/)
	})

	it('passes on exit 0 without parsing, whatever was printed', () => {
		assert.equal(judge(ran(0, 'not a diagnostic at all'), []).ok, true)
	})

	it('fails a missing command rather than parsing the shell error', () => {
		assert.match(judge(ran(127, '', 'sh: tsc: not found'), []).output, /could not be found/)
	})

	it('fails unfiltered on a line the parser cannot account for', () => {
		const result = judge(ran(1, `${TSC_RUN}\nnpm ERR! lifecycle script failed`), [])
		assert.equal(result.ok, false)
		assert.match(result.output, /could not parse/)
		assert.match(result.output, /npm ERR!/)
		assert.match(result.output, /src\/a\.ts/, 'unfiltered means every diagnostic is shown, including ones elsewhere')
	})

	it('fails unfiltered when the output says the run did not complete', () => {
		const result = judge(ran(1, "tsconfig.json(1,24): error TS5023: Unknown compiler option 'bogus'."), [])
		assert.equal(result.ok, false)
		assert.match(result.output, /did not complete/)
	})

	it('fails unfiltered when a non-zero exit has no error to explain it', () => {
		const result = judge(ran(2, ''), [])
		assert.equal(result.ok, false)
		assert.match(result.output, /reported no error/)
	})

	it('fails unfiltered when the error count disagrees with the summary', () => {
		const result = judge(ran(1, `${TSC_RUN}\nFound 5 errors in 2 files.`), [])
		assert.equal(result.ok, false)
		assert.match(result.output, /reported 5 errors but 2 were parsed/)
	})

	it('fails on an error located in an edited file, showing only the attributed ones', () => {
		const result = judge(ran(1, TSC_RUN), ['src/c.ts'])
		assert.equal(result.ok, false)
		assert.match(result.output, /src\/c\.ts\(5,3\)/)
		assert.match(result.output, /The types of 'x\.y' are incompatible/, 'continuation lines travel with their diagnostic')
		assert.doesNotMatch(result.output, /src\/a\.ts/, 'an error elsewhere is not the session’s')
		assert.match(result.output, /1 error located in files this session did not edit was not counted/)
	})

	it('passes with a notice when every error is in a file the session did not edit', () => {
		const result = judge(ran(1, TSC_RUN), ['src/b.ts'])
		assert.equal(result.ok, true)
		assert.match(result.notice?.text ?? '', /2 errors located in files this session did not edit were not counted/)
	})

	it('always keeps an error with no file', () => {
		const result = judge(ran(1, "error TS2318: Cannot find global type 'Array'."), [])
		assert.equal(result.ok, false)
		assert.match(result.output, /TS2318/)
		assert.match(result.output, /no file in this checkout/)
	})

	it('keeps whatever the runner locates as global', () => {
		const result = judge(ran(1, TSC_RUN), [], () => 'global')
		assert.equal(result.ok, false)
	})

	it('keys a failure by its diagnostics, so a line shift is not a new failure', () => {
		const before = judge(ran(1, "src/c.ts(5,3): error TS2554: Expected 0 arguments, but got 1."), ['src/c.ts'])
		const after = judge(ran(1, "src/c.ts(9,3): error TS2554: Expected 0 arguments, but got 1."), ['src/c.ts'])
		assert.equal(failureSignature([before]), failureSignature([after]))
	})

	it('only attributes errors; a warning never blocks on its own', () => {
		const result = judge(ran(1, "src/a.ts(1,1): warning TS6133: 'x' is declared but its value is never read."), ['src/a.ts'])
		assert.equal(result.ok, false)
		assert.match(result.output, /reported no error/, 'a non-zero exit explained only by a warning is shown unfiltered')
	})
})

// ---------------------------------------------------------------------------
// watched tests
// ---------------------------------------------------------------------------

const WATCH = 'npx vitest --watch --reporter=json --outputFile={status}'

/** A verdict input with everything fresh and passing; tests override one field. */
function verdictInput(overrides: Partial<Parameters<typeof testVerdict>[0]> = {}) {
	return testVerdict({
		status: { success: true },
		statusMtime: 2_000,
		lastEditAt: 1_000,
		watcherAlive: true,
		...overrides,
	})
}

describe('filling a watcher command', () => {
	it('fills the placeholder with a shell-quoted path', () => {
		const filled = watchCommand(WATCH, "/tmp/a b/it's.json")
		assert.ok(filled.includes(`'/tmp/a b/it'\\''s.json'`), filled)
		assert.ok(!filled.includes('{status}'))
	})
})

describe('reading a watcher verdict', () => {
	// The failure modes all look like "passing" if only the verdict is checked,
	// so freshness is settled first and anything unresolved is unknown.
	it('passes when the report is fresh and successful', () => {
		assert.deepEqual(verdictInput(), { state: 'pass' })
	})

	it('does not pass when there is no report at all', () => {
		assert.equal(verdictInput({ status: null, statusMtime: null }).state, 'unknown')
	})

	it('does not pass when the report predates the last edit', () => {
		const v = verdictInput({ statusMtime: 500, lastEditAt: 1_000 })
		assert.equal(v.state, 'unknown')
		assert.match((v as { reason: string }).reason, /predates the most recent edit/)
	})

	it('says the watcher died when a stale report has no live watcher behind it', () => {
		const v = verdictInput({ statusMtime: 500, lastEditAt: 1_000, watcherAlive: false })
		assert.match((v as { reason: string }).reason, /no longer running/)
	})

	it('still trusts a fresh report from a watcher that has since died', () => {
		assert.deepEqual(verdictInput({ watcherAlive: false }), { state: 'pass' })
	})

	it('does not pass when the report is present but unreadable', () => {
		assert.equal(verdictInput({ status: null }).state, 'unknown')
		assert.equal(verdictInput({ status: 'not json' }).state, 'unknown')
	})

	it('does not pass when the report carries no success field', () => {
		assert.equal(verdictInput({ status: { numTotalTests: 9 } }).state, 'unknown')
	})

	it('treats a missing lastEditAt as no freshness constraint', () => {
		assert.deepEqual(verdictInput({ lastEditAt: null, statusMtime: 1 }), { state: 'pass' })
	})

	it('fails with a count when tests are failing', () => {
		const v = verdictInput({ status: { success: false, numFailedTests: 2, numTotalTests: 9 } })
		assert.equal(v.state, 'fail')
		assert.equal((v as { detail: string }).detail, '2 of 9 tests failing.')
	})

	it('reports a failure it cannot count without inventing one', () => {
		assert.equal((verdictInput({ status: { success: false } }) as { detail: string }).detail, 'Tests are failing.')
	})
})

describe('folding a verdict into a result', () => {
	const base = { name: 'test', command: WATCH, root: ROOT }

	it('passes when the tests pass', () => {
		assert.equal(verdictAsResult({ state: 'pass' }, base).ok, true)
	})

	it('fails on a failing verdict, naming the watcher as the command', () => {
		const result = verdictAsResult({ state: 'fail', detail: '1 of 3 tests failing.' }, base)
		assert.equal(result.ok, false)
		assert.equal(result.command, WATCH)
	})

	it('fails on an unknown verdict too, since it is not permission to finish', () => {
		const result = verdictAsResult({ state: 'unknown', reason: 'the watcher is not running' }, base)
		assert.equal(result.ok, false)
		assert.match(result.output, /No usable verdict/)
	})
})

// ---------------------------------------------------------------------------
// deciding
// ---------------------------------------------------------------------------

describe('failureSignature', () => {
	it('is independent of array order and of passing siblings', () => {
		const a = fail('lint', 'x')
		const b = fail('typecheck', 'y')
		assert.equal(failureSignature([a, b]), failureSignature([pass('test'), b, a]))
	})

	it('changes when the output, the command or the checkout changes', () => {
		const original = failureSignature([fail('lint', 'x')])
		assert.notEqual(failureSignature([fail('lint', 'y')]), original)
		assert.notEqual(failureSignature([fail('lint', 'x', { command: 'other' })]), original)
		assert.notEqual(failureSignature([fail('lint', 'x', { root: '/elsewhere' })]), original)
	})

	it('prefers an identity over raw output', () => {
		assert.equal(
			failureSignature([fail('typecheck', 'line 3', { identity: 'same' })]),
			failureSignature([fail('typecheck', 'line 9', { identity: 'same' })]),
		)
	})
})

describe('conclude', () => {
	it('stays silent when every check passes', () => {
		assert.deepEqual(concludeFor([pass('lint'), pass('typecheck')]), { block: null, systemMessage: null, blocked: null, notified: [] })
	})

	it('blocks on a failure, naming the check, its command and its output', () => {
		const conclusion = concludeFor([pass('lint', 'NOISE'), fail('typecheck', 'src/b.ts(3,5): error TS2345')])
		const reason = assertBlocked(conclusion)
		assert.match(reason, /typecheck — `typecheck-command`/)
		assert.match(reason, /TS2345/)
		assert.doesNotMatch(reason, /NOISE/, 'a passing check’s output is noise')
		assert.equal(conclusion.blocked, failureSignature([fail('typecheck', 'src/b.ts(3,5): error TS2345')]))
	})

	it('covers every failure, not just the first', () => {
		const reason = assertBlocked(concludeFor([fail('lint', 'L'), fail('test', 'T')]))
		assert.match(reason, /2 checks failed/)
		assert.match(reason, /lint/)
		assert.match(reason, /test/)
	})

	it('says a failure is reported by location, not cause', () => {
		assert.match(assertBlocked(concludeFor([fail('lint', 'x')])), /not by who caused it/)
	})

	it('appends notes to the block', () => {
		assert.match(assertBlocked(concludeFor([fail('lint', 'x')], { notes: ['Note: no node_modules'] })), /no node_modules/)
	})

	it('does not ask the agent twice about the same failure, and tells the user once instead', () => {
		const results = [fail('lint', 'same')]
		const first = concludeFor(results)
		const second = concludeFor(results, { alreadyBlocked: [first.blocked as string] })
		assert.equal(second.block, null)
		assert.match(second.systemMessage ?? '', /already told/)
		const third = concludeFor(results, { alreadyBlocked: [first.blocked as string], alreadyNotified: second.notified })
		assert.deepEqual(third, { block: null, systemMessage: null, blocked: null, notified: [] })
	})

	it('does not block while a stop hook is already continuing the turn, and tells the user', () => {
		const conclusion = concludeFor([fail('lint', 'x')], { stopHookActive: true })
		assert.equal(conclusion.block, null)
		assert.equal(conclusion.blocked, null)
		assert.match(conclusion.systemMessage ?? '', /stop hook/)
	})

	it('blocks again when the failure changes', () => {
		const first = concludeFor([fail('lint', 'first')])
		assertBlocked(concludeFor([fail('lint', 'second')], { alreadyBlocked: [first.blocked as string] }))
	})

	it('shows a passing check’s notice once', () => {
		const noticed = pass('typecheck', '', { notice: { key: 'n1', text: 'typecheck found no errors in files this session edited' } })
		const first = concludeFor([noticed])
		assert.equal(first.block, null)
		assert.match(first.systemMessage ?? '', /found no errors/)
		assert.deepEqual(first.notified, ['n1'])
		assert.equal(concludeFor([noticed], { alreadyNotified: ['n1'] }).systemMessage, null)
	})

	it('never blocks outside Stop and TeammateIdle', () => {
		for (const trigger of ['PostToolUse', 'SessionEnd', 'Stopped', ''] as Trigger[]) {
			assert.equal(concludeFor([fail('lint', 'x')], { trigger }).block, null, `blocked on ${trigger}`)
		}
	})

	it('decides the same way for Stop and TeammateIdle', () => {
		assert.equal(concludeFor([fail('lint', 'x')], { trigger: 'Stop' }).block, concludeFor([fail('lint', 'x')], { trigger: 'TeammateIdle' }).block)
	})

	it('tolerates junk inputs', () => {
		assert.equal(conclude({ trigger: 'Stop', results: null as never, alreadyBlocked: null as never, alreadyNotified: null as never }).block, null)
	})
})
