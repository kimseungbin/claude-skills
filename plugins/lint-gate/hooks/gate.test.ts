/**
 * End-to-end tests for the lint-gate runner.
 *
 * `core.test.ts` covers the pure decision layer. This file covers the part that
 * cannot be unit tested: gate.ts is a stdin-driven CLI, so every case here spawns
 * it for real and asserts on what it wrote to stdout and to its state file.
 *
 * Two isolations make that safe, and both are load-bearing:
 *   - `HOME` points at a temp dir, so state never touches the real
 *     `~/.claude/lint-gate/`. The first test asserts the redirection works at all,
 *     and `runRaw` refuses to spawn if it does not.
 *   - the payload's `cwd` is a temp project dir, so the commands the hook runs are
 *     cheap shell builtins from a fixture config — never a real linter.
 *
 * Commands under test therefore double as probes: `printf … > received.txt` records
 * the arguments a command was handed, and `printf ran > ran.txt` proves whether a
 * command that should have been skipped ran anyway.
 */

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GATE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gate.ts')

const ROOT = mkdtempSync(path.join(tmpdir(), 'lint-gate-hook-'))
const REAL_HOME = homedir()

after(() => rmSync(ROOT, { recursive: true, force: true }))

/** The scope key gate.ts uses when no teammate is named. */
const LEAD = '__lead__'

/** Fixture commands. Shell builtins only, and each one leaves evidence it ran. */
const LINT_ECHOING_FILES = String.raw`printf '%s\n' {files} > received.txt`
const LINT_ECHOING_FILES_THEN_FAILING = String.raw`printf '%s\n' {files} > received.txt; exit 1`
const LINT_MARKING = 'printf ran > ran.txt'
const LINT_MARKING_THEN_FAILING = 'printf ran > ran.txt; exit 1'
const FORMAT_ECHOING_FILE = String.raw`printf '%s\n' {file} >> formatted.txt`
const FORMAT_ECHOING_FILES = String.raw`printf '%s\n' {files} >> formatted.txt`
const MISSING_COMMAND = 'lint-gate-no-such-command-92f1'

const RAN = 'ran.txt'
const RECEIVED = 'received.txt'
const FORMATTED = 'formatted.txt'

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------

interface Project {
	/** Payload `cwd`: the project the hook is told it is running in. */
	cwd: string
	/** Redirected `HOME`, so `os.homedir()` inside the hook lands here. */
	home: string
	session: string
}

interface HookRun {
	stdout: string
	stderr: string
	status: number | null
}

/**
 * gate.ts locates its state with `os.homedir()`. On POSIX that reads `HOME`, but
 * if it ever does not, every test below would write into the developer's real
 * `~/.claude` — so this is checked once, up front, in a child process.
 */
function homedirFollowsHome(): boolean {
	const probe = mkdtempSync(path.join(ROOT, 'homedir-probe-'))
	const seen = spawnSync(process.execPath, ['-p', 'require("node:os").homedir()'], {
		env: { ...process.env, HOME: probe },
		encoding: 'utf8',
	})
	return seen.stdout.trim() === probe
}

const HOME_IS_REDIRECTABLE = homedirFollowsHome()

let projects = 0

/**
 * A fresh project and a fresh HOME per case, so nothing leaks between tests.
 * `config` is written as JSON; a raw string is written verbatim, which is how the
 * unparseable-config cases are expressed. Omit it for "no config file at all".
 */
function makeProject(config?: unknown, options: { session?: string } = {}): Project {
	const project: Project = {
		cwd: mkdtempSync(path.join(ROOT, 'project-')),
		home: mkdtempSync(path.join(ROOT, 'home-')),
		session: options.session ?? `session-${++projects}`,
	}
	if (config !== undefined) writeConfig(project, config)
	return project
}

function writeConfig(project: Project, config: unknown): void {
	const dir = path.join(project.cwd, '.claude', 'config')
	mkdirSync(dir, { recursive: true })
	writeFileSync(path.join(dir, 'lint-gate.json'), typeof config === 'string' ? config : JSON.stringify(config))
}

/** Node's own warnings are not a hook failure; a stack trace is. */
const WARNING = /^\(node:\d+\)|Warning:|--trace-warnings/

function crashNoise(stderr: string): string {
	return stderr
		.split('\n')
		.filter((line) => line.trim() !== '' && !WARNING.test(line))
		.join('\n')
}

/**
 * Spawn the hook with `stdin` verbatim.
 *
 * The two invariants that hold for every single invocation are asserted here
 * rather than per case: the hook exits 0, and it reports nothing on stderr. A
 * gate that crashes the hook is the one failure mode the plugin promises cannot
 * happen.
 */
function runRaw(project: Project, stdin: string): HookRun {
	assert.ok(
		HOME_IS_REDIRECTABLE,
		'refusing to spawn gate.ts: os.homedir() ignores HOME here, so its state would be written to the real ~/.claude',
	)

	const child = spawnSync(process.execPath, [GATE], {
		input: stdin,
		encoding: 'utf8',
		env: { ...process.env, HOME: project.home },
		// Deliberately not the project dir: the real hook's working directory is
		// not the project's, so anything cwd-relative has to come from the payload.
		cwd: ROOT,
	})

	assert.equal(child.error, undefined, `could not spawn the hook: ${String(child.error)}`)
	assert.equal(child.status, 0, `the hook must always exit 0, got ${child.status}\nstderr:\n${child.stderr}`)
	assert.equal(crashNoise(child.stderr), '', `the hook must not report an error:\n${child.stderr}`)

	return { stdout: child.stdout, stderr: child.stderr, status: child.status }
}

/** Session and cwd default to the project's; pass `cwd: undefined` to drop it. */
function run(project: Project, payload: Record<string, unknown>): HookRun {
	return runRaw(project, JSON.stringify({ session_id: project.session, cwd: project.cwd, ...payload }))
}

function edit(project: Project, file: string | undefined, extra: Record<string, unknown> = {}): HookRun {
	return run(project, { hook_event_name: 'PostToolUse', tool_input: { file_path: file }, ...extra })
}

function settle(project: Project, trigger: 'Stop' | 'TeammateIdle' = 'Stop', extra: Record<string, unknown> = {}): HookRun {
	return run(project, { hook_event_name: trigger, ...extra })
}

function assertPassed(result: HookRun, message?: string): void {
	assert.equal(result.stdout, '', message ?? `expected no block, got: ${result.stdout}`)
}

function assertBlocked(result: HookRun, message?: string): string {
	assert.notEqual(result.stdout.trim(), '', message ?? 'expected a block, the hook wrote nothing')

	let parsed: { decision?: unknown; reason?: unknown }
	try {
		parsed = JSON.parse(result.stdout) as { decision?: unknown; reason?: unknown }
	} catch {
		return assert.fail(`a block must be valid JSON, got: ${result.stdout}`)
	}

	assert.equal(parsed.decision, 'block', `expected a block decision, got: ${result.stdout}`)
	assert.equal(typeof parsed.reason, 'string', 'a block must carry a string reason')
	const reason = parsed.reason as string
	assert.ok(reason.length > 0, 'a block reason must not be empty')
	return reason
}

// state -------------------------------------------------------------------

interface ScopeState {
	blocked?: string[]
	edited?: string[]
}

function statePath(project: Project, session = project.session): string {
	return path.join(project.home, '.claude', 'lint-gate', `${session}.json`)
}

function rawState(project: Project, session?: string): string | null {
	const file = statePath(project, session)
	return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function writeRawState(project: Project, contents: string): void {
	const file = statePath(project)
	mkdirSync(path.dirname(file), { recursive: true })
	writeFileSync(file, contents)
}

function stateOf(project: Project): Record<string, ScopeState> {
	const raw = rawState(project)
	return raw === null ? {} : (JSON.parse(raw) as Record<string, ScopeState>)
}

function editedIn(project: Project, scope = LEAD): string[] {
	return stateOf(project)[scope]?.edited ?? []
}

function blockedIn(project: Project, scope = LEAD): string[] {
	return stateOf(project)[scope]?.blocked ?? []
}

// project files -----------------------------------------------------------

function touch(project: Project, relative: string, contents = 'x\n'): string {
	const file = path.join(project.cwd, relative)
	mkdirSync(path.dirname(file), { recursive: true })
	writeFileSync(file, contents)
	return file
}

function remove(project: Project, relative: string): void {
	rmSync(path.join(project.cwd, relative), { force: true })
}

function evidence(project: Project, name: string): string | null {
	const file = path.join(project.cwd, name)
	return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function assertDidNotRun(project: Project, name = RAN, message?: string): void {
	assert.equal(evidence(project, name), null, message ?? `a command ran that should have been skipped (left ${name})`)
}

/** The argument list a probe command was handed, one path per line. */
function pathsSeenBy(project: Project, name = RECEIVED): string[] {
	const written = evidence(project, name)
	assert.notEqual(written, null, `the command never ran, so it saw no paths (no ${name})`)
	return (written as string).split('\n').filter((line) => line !== '')
}

// ---------------------------------------------------------------------------
// isolation
// ---------------------------------------------------------------------------

describe('test isolation', () => {
	it('redirects os.homedir() inside the hook with HOME', () => {
		assert.ok(
			HOME_IS_REDIRECTABLE,
			'os.homedir() does not follow HOME on this platform, so gate.ts state cannot be isolated from the real ~/.claude',
		)
	})

	it('writes session state under the temp HOME and never under the real one', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		touch(project, 'a.ts')

		edit(project, 'a.ts')

		assert.notEqual(rawState(project), null, 'expected state under the temp HOME')
		assert.equal(
			existsSync(path.join(REAL_HOME, '.claude', 'lint-gate', `${project.session}.json`)),
			false,
			'the hook wrote into the real home directory',
		)
	})
})

// ---------------------------------------------------------------------------
// PostToolUse
// ---------------------------------------------------------------------------

describe('PostToolUse — recording the edited path', () => {
	it('records file_path when a Stop-time lint uses {files}', () => {
		const project = makeProject({ format: 'true', lint: LINT_ECHOING_FILES })

		assertPassed(edit(project, '/abs/src/a.ts'))

		assert.deepEqual(editedIn(project), ['/abs/src/a.ts'])
	})

	/**
	 * The issue #33 regression: recording used to sit behind the "nothing to run"
	 * early return, so a project with a {files} lint and no format command would
	 * accumulate nothing and lint an empty list forever.
	 */
	it('records even when format is not configured at all', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		assertPassed(edit(project, 'src/a.ts'))

		assert.deepEqual(editedIn(project), ['src/a.ts'])
		assertDidNotRun(project, FORMATTED, 'no format command is configured, so nothing may run')
	})

	it('records when only typecheck uses {files}', () => {
		const project = makeProject({ lint: 'true', typecheck: 'tsc {files}' })

		edit(project, 'a.ts')

		assert.deepEqual(editedIn(project), ['a.ts'])
	})

	it('records notebook_path when there is no file_path', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		run(project, { hook_event_name: 'PostToolUse', tool_input: { notebook_path: 'analysis.ipynb' } })

		assert.deepEqual(editedIn(project), ['analysis.ipynb'])
	})

	it('prefers file_path over notebook_path when both are present', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		run(project, { hook_event_name: 'PostToolUse', tool_input: { file_path: 'a.ts', notebook_path: 'b.ipynb' } })

		assert.deepEqual(editedIn(project), ['a.ts'])
	})

	it('does not record when no Stop-time command uses {files}', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE, lint: 'eslint .', typecheck: 'tsc --noEmit' })

		edit(project, 'a.ts')

		assert.deepEqual(editedIn(project), [], 'nothing consumes the list, so nothing should be accumulated')
	})

	it('does not record when only the format command uses {files}', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILES, lint: 'eslint .' })

		edit(project, 'a.ts')

		assert.deepEqual(editedIn(project), [], 'format runs per edit, so its {files} is not a session list')
		assert.deepEqual(pathsSeenBy(project, FORMATTED), ['a.ts'], 'the one file being formatted is the whole list')
	})

	it('does not record when there is no config file', () => {
		const project = makeProject()

		edit(project, 'a.ts')

		assert.equal(rawState(project), null, 'an unconfigured project should not accumulate state')
	})

	it('dedupes repeated edits of the same path', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		edit(project, 'src/a.ts')
		edit(project, 'src/a.ts')
		edit(project, 'src/a.ts')

		assert.deepEqual(editedIn(project), ['src/a.ts'])
	})

	it('accumulates distinct paths across edits', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		edit(project, 'a.ts')
		edit(project, 'b.ts')
		edit(project, 'a.ts')
		edit(project, 'c.ts')

		assert.deepEqual(editedIn(project), ['a.ts', 'b.ts', 'c.ts'])
	})

	it('does nothing when tool_input carries no path', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		assertPassed(edit(project, undefined))
		assertPassed(run(project, { hook_event_name: 'PostToolUse' }))
		assertPassed(run(project, { hook_event_name: 'PostToolUse', tool_input: {} }))

		assert.equal(rawState(project), null)
	})
})

describe('PostToolUse — running the format command', () => {
	it('hands the format command the edited file', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })

		edit(project, '/tmp/src/a.ts')

		assert.deepEqual(pathsSeenBy(project, FORMATTED), ['/tmp/src/a.ts'])
	})

	it('runs the format command once per edit', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })

		edit(project, 'a.ts')
		edit(project, 'b.ts')

		assert.deepEqual(pathsSeenBy(project, FORMATTED), ['a.ts', 'b.ts'])
	})

	it('shell-quotes a path with spaces and a quote', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		const nasty = `weird name's file.ts`

		edit(project, nasty)

		assert.deepEqual(pathsSeenBy(project, FORMATTED), [nasty], 'the path reached the shell mangled or split')
	})

	it('passes a path containing a {file} token through untouched', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		const tokenish = 'src/a{file}b.ts'

		edit(project, tokenish)

		assert.deepEqual(pathsSeenBy(project, FORMATTED), [tokenish], 'a token inside the path is data, not a placeholder')
	})

	/**
	 * Regression: a path arrives from a tool payload, so its quoting is the one
	 * place in this plugin where a mistake becomes command execution rather than a
	 * wrong answer.
	 *
	 * `formatCommand` once filled `{files}` and then `{file}` in two passes, and the
	 * second pass rescanned the path the first had just inserted — so a path
	 * containing `{file}` was substituted again, outside the quotes meant to contain
	 * it, and its shell metacharacters ran. Both tokens are now consumed in one
	 * pass, which is what keeps an inserted path inert. Asserted here through the
	 * real hook, not only through the pure function, because that is the path a
	 * payload actually travels.
	 */
	it('does not let a {file} token in the path break out of a {files} format command', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILES })
		const injecting = 'a{file};touch OWNED'

		edit(project, injecting)

		assert.deepEqual(
			readdirSync(project.cwd).filter((entry) => entry.includes('OWNED')),
			[],
			'the path was executed as shell syntax instead of passed as one argument',
		)
		assert.deepEqual(pathsSeenBy(project, FORMATTED), [injecting])
	})

	/**
	 * Regression: filling the token with `String.replace` makes `$&`, `` $` ``, `$'`
	 * and `$1` meaningful in the *replacement*, so a path containing one would be
	 * rewritten with a piece of the command it was being substituted into. Only the
	 * callback form is inert.
	 */
	it('passes a path containing regex replacement patterns through untouched', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		// Double-quoted so the backtick and the apostrophe are both literal here.
		const patterns = "src/a$&b$'c$`d$1.ts"

		edit(project, patterns)

		assert.deepEqual(pathsSeenBy(project, FORMATTED), [patterns])
	})

	it('does not run lint or typecheck on an edit', () => {
		const project = makeProject({ format: 'true', lint: LINT_MARKING_THEN_FAILING, typecheck: LINT_MARKING_THEN_FAILING })

		assertPassed(edit(project, 'a.ts'))

		assertDidNotRun(project, RAN, 'semantic checks belong to Stop, not to every edit')
	})

	describe('never blocks, whatever the formatter does', () => {
		const formatters: Array<[string, string]> = [
			['exits non-zero', 'exit 1'],
			['exits non-zero with output', String.raw`printf 'style errors\n'; printf 'to stderr\n' >&2; exit 2`],
			['cannot be spawned', `${MISSING_COMMAND} {file}`],
			['is killed by a signal', 'kill -TERM $$'],
			['prints a lot and fails', 'i=0; while [ $i -lt 500 ]; do printf "line %s\\n" $i; i=$((i+1)); done; exit 1'],
		]

		for (const [label, command] of formatters) {
			it(`stays silent when the formatter ${label}`, () => {
				const project = makeProject({ format: command, lint: LINT_ECHOING_FILES })

				assertPassed(edit(project, 'a.ts'))

				assert.deepEqual(editedIn(project), ['a.ts'], 'the path is recorded before the formatter runs')
			})
		}
	})
})

// ---------------------------------------------------------------------------
// Stop / TeammateIdle
// ---------------------------------------------------------------------------

for (const trigger of ['Stop', 'TeammateIdle'] as const) {
	describe(`${trigger} — scoping checks to the edited files`, () => {
		it('runs a {files} lint against exactly the recorded paths', () => {
			const project = makeProject({ lint: LINT_ECHOING_FILES })
			touch(project, 'a.ts')
			touch(project, 'src/b.ts')
			edit(project, 'a.ts')
			edit(project, 'src/b.ts')

			assertPassed(settle(project, trigger))

			assert.deepEqual(pathsSeenBy(project), ['a.ts', 'src/b.ts'])
		})

		it('is skipped entirely when nothing was recorded', () => {
			const project = makeProject({ lint: String.raw`printf '%s\n' {files} > ran.txt; exit 1` })

			assertPassed(settle(project, trigger), 'nothing was edited, so nothing is owed')

			assertDidNotRun(project, RAN, 'a {files} command must not run bare on an empty list')
		})

		it('is skipped when only unrelated scopes recorded files', () => {
			const project = makeProject({ lint: String.raw`printf '%s\n' {files} > ran.txt; exit 1` })
			touch(project, 'a.ts')
			edit(project, 'a.ts', { teammate_name: 'alice' })

			assertPassed(settle(project, trigger))

			assertDidNotRun(project)
		})

		it('blocks when the scoped lint fails, naming the files it ran on', () => {
			const project = makeProject({ lint: LINT_ECHOING_FILES_THEN_FAILING })
			touch(project, 'a.ts')
			edit(project, 'a.ts')

			const reason = assertBlocked(settle(project, trigger))

			assert.match(reason, /lint/)
			assert.deepEqual(pathsSeenBy(project), ['a.ts'])
		})

		it('runs a project-wide command with no placeholder even with nothing recorded', () => {
			const project = makeProject({ lint: LINT_MARKING })

			assertPassed(settle(project, trigger))

			assert.equal(evidence(project, RAN), 'ran', 'a project that never asked for scoping keeps project-wide behavior')
		})

		it('blocks on a project-wide failure with nothing recorded', () => {
			const project = makeProject({ lint: 'printf "3 problems\n" >&2; exit 1' })

			const reason = assertBlocked(settle(project, trigger))

			assert.match(reason, /3 problems/)
		})

		it('mixes a scoped lint with a project-wide typecheck', () => {
			const project = makeProject({ lint: LINT_ECHOING_FILES, typecheck: LINT_MARKING })
			touch(project, 'a.ts')
			edit(project, 'a.ts')

			assertPassed(settle(project, trigger))

			assert.deepEqual(pathsSeenBy(project), ['a.ts'])
			assert.equal(evidence(project, RAN), 'ran')
		})

		it('drops the scoped lint but keeps the project-wide typecheck when nothing was recorded', () => {
			const project = makeProject({ lint: String.raw`printf '%s\n' {files} > received.txt; exit 1`, typecheck: LINT_MARKING })

			assertPassed(settle(project, trigger))

			assertDidNotRun(project, RECEIVED)
			assert.equal(evidence(project, RAN), 'ran')
		})
	})

	describe(`${trigger} — repeating itself`, () => {
		it('does not block twice for the same failure', () => {
			const project = makeProject({ lint: 'printf "same\n"; exit 1' })

			assertBlocked(settle(project, trigger))
			assert.equal(blockedIn(project).length, 1, 'the failure signature should be remembered')

			assertPassed(settle(project, trigger), 'the agent has already been told about this failure')
		})

		it('blocks again when the failure changes', () => {
			const project = makeProject({ lint: 'printf "first\n"; exit 1' })
			assertBlocked(settle(project, trigger))

			writeConfig(project, { lint: 'printf "second\n"; exit 1' })

			assertBlocked(settle(project, trigger), 'a different failure has not been reported yet')
			assert.equal(blockedIn(project).length, 2)
		})

		it('does not block when stop_hook_active is set', () => {
			const project = makeProject({ lint: 'exit 1' })

			assertPassed(settle(project, trigger, { stop_hook_active: true }))

			assert.deepEqual(blockedIn(project), [], 'nothing was reported, so nothing should be remembered')
		})

		it('stays silent when every check passes', () => {
			const project = makeProject({ lint: 'true', typecheck: 'true' })

			assertPassed(settle(project, trigger))

			assert.equal(rawState(project), null)
		})
	})
}

describe('stale recorded paths', () => {
	it('filters out a path that has since been deleted', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		touch(project, 'a.ts')
		touch(project, 'gone.ts')
		edit(project, 'a.ts')
		edit(project, 'gone.ts')
		remove(project, 'gone.ts')

		assertPassed(settle(project))

		assert.deepEqual(pathsSeenBy(project), ['a.ts'], 'a linter handed a missing path fails on something the agent cannot fix')
	})

	it('skips the command when every recorded path is gone', () => {
		const project = makeProject({ lint: String.raw`printf '%s\n' {files} > ran.txt; exit 1` })
		touch(project, 'gone.ts')
		edit(project, 'gone.ts')
		remove(project, 'gone.ts')

		assertPassed(settle(project))

		assertDidNotRun(project, RAN, 'an empty list after filtering must drop the command, not run it bare')
	})

	it('resolves a relative recorded path against the payload cwd', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		touch(project, 'src/deep/a.ts')
		edit(project, 'src/deep/a.ts')

		assertPassed(settle(project))

		assert.deepEqual(pathsSeenBy(project), ['src/deep/a.ts'], 'the hook cwd is not the project, so a relative path must resolve against the payload cwd')
	})

	it('keeps an absolute recorded path that still exists', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		const absolute = touch(project, 'src/a.ts')
		edit(project, absolute)

		assertPassed(settle(project))

		assert.deepEqual(pathsSeenBy(project), [absolute])
	})

	it('drops a relative path that does not exist under the payload cwd', () => {
		const project = makeProject({ lint: String.raw`printf '%s\n' {files} > ran.txt; exit 1` })
		edit(project, 'never-written.ts')

		assertPassed(settle(project))

		assertDidNotRun(project, RAN)
	})
})

describe('teammate scoping', () => {
	it('keeps each scope\'s edited paths to itself', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		touch(project, 'alice.ts')
		touch(project, 'lead.ts')

		edit(project, 'alice.ts', { teammate_name: 'alice' })
		edit(project, 'lead.ts')

		assert.deepEqual(editedIn(project, 'alice'), ['alice.ts'])
		assert.deepEqual(editedIn(project, LEAD), ['lead.ts'])

		assertPassed(settle(project, 'TeammateIdle', { teammate_name: 'alice' }))
		assert.deepEqual(pathsSeenBy(project), ['alice.ts'], 'one agent must not lint another agent\'s files')

		assertPassed(settle(project, 'Stop'))
		assert.deepEqual(pathsSeenBy(project), ['lead.ts'])
	})

	it('does not let one scope silence another scope\'s failure', () => {
		const project = makeProject({ lint: 'printf "shared failure\n"; exit 1' })

		assertBlocked(settle(project, 'TeammateIdle', { teammate_name: 'alice' }))
		assertPassed(settle(project, 'TeammateIdle', { teammate_name: 'alice' }), 'alice was already told')

		assertBlocked(settle(project, 'TeammateIdle', { teammate_name: 'bob' }), 'bob has not been told yet')
		assertBlocked(settle(project, 'Stop'), 'the lead has not been told yet')

		assert.deepEqual(Object.keys(stateOf(project)).sort(), ['__lead__', 'alice', 'bob'])
		for (const scope of ['alice', 'bob', LEAD]) assert.equal(blockedIn(project, scope).length, 1)
	})

	it('separates two sessions of the same teammate', () => {
		const first = makeProject({ lint: 'exit 1' })
		const second: Project = { ...first, session: `${first.session}-other` }

		assertBlocked(settle(first))
		assertBlocked(settle(second), 'a new session starts with no memory')
	})
})

describe('session state', () => {
	it('lets blocked and edited coexist under one scope', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES_THEN_FAILING })
		touch(project, 'a.ts')
		touch(project, 'b.ts')

		edit(project, 'a.ts')
		assert.deepEqual(editedIn(project), ['a.ts'])

		assertBlocked(settle(project))
		const signature = blockedIn(project)
		assert.equal(signature.length, 1)
		assert.deepEqual(editedIn(project), ['a.ts'], 'remembering a block must not drop the edited list')

		edit(project, 'b.ts')
		assert.deepEqual(editedIn(project), ['a.ts', 'b.ts'])
		assert.deepEqual(blockedIn(project), signature, 'recording an edit must not drop the blocked list')

		// A fourth invocation reads both memories at once: the grown edited list
		// scopes the command, and the wider list makes it a check the agent has not
		// been told about, so the remembered signature does not silence it.
		assertBlocked(settle(project))
		assert.deepEqual(pathsSeenBy(project), ['a.ts', 'b.ts'])
		assert.equal(blockedIn(project).length, 2, 'both signatures should be kept')
		assert.deepEqual(editedIn(project), ['a.ts', 'b.ts'], 'the edited list must survive a second block')
	})

	it('names the state file after the session', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES }, { session: 'abc-123' })

		edit(project, 'a.ts')

		assert.notEqual(rawState(project, 'abc-123'), null)
	})

	it('falls back to a fixed name when the payload has no session_id', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		run(project, { hook_event_name: 'PostToolUse', session_id: undefined, tool_input: { file_path: 'a.ts' } })

		assert.notEqual(rawState(project, 'unknown-session'), null, 'a missing session id must not lose the recording')
	})

	it('reads a legacy bare-array state as absent rather than migrating it', () => {
		const project = makeProject({ lint: 'printf "same\n"; exit 1' })

		assertBlocked(settle(project))
		const [signature] = blockedIn(project)
		assert.equal(typeof signature, 'string')

		writeRawState(project, JSON.stringify({ [LEAD]: [signature] }))

		assertBlocked(settle(project), 'a legacy signature list must not silence a block, only cost one repeat')
	})

	it('ignores a legacy bare-array state when scoping to edited files', () => {
		const project = makeProject({ lint: String.raw`printf '%s\n' {files} > ran.txt; exit 1` })
		touch(project, 'a.ts')
		writeRawState(project, JSON.stringify({ [LEAD]: ['a.ts'] }))

		assertPassed(settle(project))

		assertDidNotRun(project, RAN, 'legacy state is absent, so there is nothing to lint')
	})

	it('rewrites a legacy state file into the current shape without throwing', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		touch(project, 'a.ts')
		writeRawState(project, JSON.stringify({ [LEAD]: ['old-signature'] }))

		assertPassed(edit(project, 'a.ts'))

		assert.deepEqual(editedIn(project), ['a.ts'])
		assertPassed(settle(project))
		assert.deepEqual(pathsSeenBy(project), ['a.ts'])
	})

	it('ignores non-string entries in a recorded list', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		touch(project, 'real.ts')
		writeRawState(project, JSON.stringify({ [LEAD]: { edited: [123, null, { file: 'x' }, 'real.ts'] } }))

		assertPassed(settle(project))

		assert.deepEqual(pathsSeenBy(project), ['real.ts'])
	})

	describe('degrades safely on an unreadable state file', () => {
		const junk: Array<[string, string]> = [
			['unparseable', 'not json {'],
			['truncated', '{"__lead__": {"blocked": ['],
			['a top-level array', '[]'],
			['null', 'null'],
			['a string', '"__lead__"'],
			['a number', '42'],
			['empty', ''],
		]

		for (const [label, contents] of junk) {
			it(`still blocks and rewrites valid state when the file is ${label}`, () => {
				const project = makeProject({ lint: 'exit 1' })
				writeRawState(project, contents)

				assertBlocked(settle(project))

				assert.equal(blockedIn(project).length, 1, `state was not repaired: ${rawState(project)}`)
			})
		}
	})

	it('degrades safely when the state path cannot be written', () => {
		const project = makeProject({ lint: LINT_MARKING_THEN_FAILING })
		// A file where the state directory belongs: mkdir and write both fail.
		mkdirSync(path.join(project.home, '.claude'), { recursive: true })
		writeFileSync(path.join(project.home, '.claude', 'lint-gate'), 'not a directory\n')

		assertBlocked(settle(project), 'an unwritable memory must not cost the block itself')
		assertBlocked(settle(project), 'with no memory the gate simply repeats itself')
	})

	it('records nothing and blocks nothing on an edit when state cannot be written', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })
		mkdirSync(path.join(project.home, '.claude'), { recursive: true })
		writeFileSync(path.join(project.home, '.claude', 'lint-gate'), 'not a directory\n')

		assertPassed(edit(project, 'a.ts'))
	})
})

// ---------------------------------------------------------------------------
// fails open
// ---------------------------------------------------------------------------

/**
 * The central promise: whatever it is handed, the hook exits 0, says nothing on
 * stderr (both asserted in `runRaw`) and does not block. Every project here is
 * configured with a check that would block loudly and leave a marker if the hook
 * ever got as far as running it.
 */
describe('fails open', () => {
	function loudProject(): Project {
		return makeProject({ format: LINT_MARKING_THEN_FAILING, lint: LINT_MARKING_THEN_FAILING, typecheck: LINT_MARKING_THEN_FAILING })
	}

	describe('on bad stdin', () => {
		const inputs: Array<[string, string]> = [
			['empty', ''],
			['whitespace only', '   \n\t\n'],
			['not JSON', 'not json at all'],
			['truncated JSON', '{"hook_event_name": "Stop"'],
			['a bare string', '"Stop"'],
			['a number', '42'],
			['a boolean', 'true'],
			['null', 'null'],
			['an array', '[{"hook_event_name":"Stop"}]'],
			['a JSON fragment repeated', '{"hook_event_name":"Stop"}{"hook_event_name":"Stop"}'],
			['NUL bytes', '\u0000\u0000'],
		]

		for (const [label, stdin] of inputs) {
			it(`ignores stdin that is ${label}`, () => {
				const project = loudProject()

				assertPassed(runRaw(project, stdin))

				assertDidNotRun(project)
				assert.equal(rawState(project), null)
			})
		}
	})

	describe('on an unrecognized trigger', () => {
		const events = ['PreToolUse', 'SessionStart', 'UserPromptSubmit', 'SubagentStop', 'stop', 'STOP', 'Stop ', ' Stop', '', 'PostToolUse2']

		for (const event of events) {
			it(`ignores hook_event_name ${JSON.stringify(event)}`, () => {
				const project = loudProject()

				assertPassed(run(project, { hook_event_name: event, tool_input: { file_path: 'a.ts' } }))

				assertDidNotRun(project)
				assert.equal(rawState(project), null)
			})
		}

		it('ignores a payload with no hook_event_name', () => {
			const project = loudProject()

			assertPassed(run(project, { tool_input: { file_path: 'a.ts' } }))

			assertDidNotRun(project)
		})

		it('ignores a non-string hook_event_name', () => {
			const project = loudProject()

			assertPassed(run(project, { hook_event_name: 42 }))
			assertPassed(run(project, { hook_event_name: ['Stop'] }))
			assertPassed(run(project, { hook_event_name: null }))

			assertDidNotRun(project)
		})
	})

	describe('on a bad cwd', () => {
		it('ignores a payload with no cwd', () => {
			const project = loudProject()

			assertPassed(run(project, { hook_event_name: 'Stop', cwd: undefined }))
			assertPassed(run(project, { hook_event_name: 'PostToolUse', cwd: undefined, tool_input: { file_path: 'a.ts' } }))

			assertDidNotRun(project)
			assert.equal(rawState(project), null)
		})

		it('ignores an empty cwd', () => {
			const project = loudProject()

			assertPassed(run(project, { hook_event_name: 'Stop', cwd: '' }))

			assertDidNotRun(project)
		})

		it('runs nothing when cwd does not exist', () => {
			const project = loudProject()
			const missing = path.join(ROOT, 'no-such-project-dir')

			assertPassed(run(project, { hook_event_name: 'Stop', cwd: missing }))
			assertPassed(run(project, { hook_event_name: 'PostToolUse', cwd: missing, tool_input: { file_path: 'a.ts' } }))

			assertDidNotRun(project)
		})

		it('runs nothing when cwd is a file', () => {
			const project = loudProject()
			const file = path.join(ROOT, 'cwd-is-a-file')
			writeFileSync(file, 'x')

			assertPassed(run(project, { hook_event_name: 'Stop', cwd: file }))

			assertDidNotRun(project)
		})

		it('runs nothing when cwd is not a string', () => {
			const project = loudProject()

			assertPassed(run(project, { hook_event_name: 'Stop', cwd: 42 }))
			assertPassed(run(project, { hook_event_name: 'Stop', cwd: { path: project.cwd } }))

			assertDidNotRun(project)
		})
	})

	describe('on a bad config', () => {
		const configs: Array<[string, unknown]> = [
			['unparseable', '{ "lint": '],
			['not JSON at all', 'lint: eslint .'],
			['empty', ''],
			['a JSON array', '["eslint ."]'],
			['a JSON string', '"eslint ."'],
			['JSON null', 'null'],
			['a number', '7'],
			['an object of non-strings', { lint: 42, typecheck: ['tsc'], format: null }],
			['blank commands', { lint: '   ', typecheck: '', format: '\t' }],
			['only unknown keys', { test: 'exit 1', check: 'exit 1' }],
			['an empty object', {}],
		]

		for (const [label, config] of configs) {
			it(`runs nothing for a config that is ${label}`, () => {
				const project = makeProject(config)

				assertPassed(settle(project))
				assertPassed(settle(project, 'TeammateIdle'))
				assertPassed(edit(project, 'a.ts'))

				assert.equal(rawState(project), null)
			})
		}

		it('runs nothing when the config file is missing', () => {
			const project = makeProject()

			assertPassed(settle(project))
			assertPassed(edit(project, 'a.ts'))
		})

		it('runs nothing when the config path is a directory', () => {
			const project = makeProject()
			mkdirSync(path.join(project.cwd, '.claude', 'config', 'lint-gate.json'), { recursive: true })

			assertPassed(settle(project))
			assertPassed(edit(project, 'a.ts'))
		})

		it('keeps the valid half of a partly invalid config', () => {
			const project = makeProject({ lint: 42, typecheck: LINT_MARKING })

			assertPassed(settle(project))

			assert.equal(evidence(project, RAN), 'ran', 'a bad sibling key must not disable a good one')
		})
	})

	describe('on a command that cannot run', () => {
		it('stays silent when the formatter cannot be spawned', () => {
			const project = makeProject({ format: MISSING_COMMAND })

			assertPassed(edit(project, 'a.ts'))
		})

		/**
		 * Not fail-open by design: at Stop a check that cannot run is a check that
		 * did not pass, and `run()` turns the shell's 127 into a failure like any
		 * other. Pinned so the choice is visible rather than accidental.
		 */
		it('reports an unspawnable Stop-time check as a failure', () => {
			const project = makeProject({ lint: MISSING_COMMAND })

			const reason = assertBlocked(settle(project))

			assert.match(reason, new RegExp(MISSING_COMMAND))
		})

		it('reports a check killed by a signal as a failure rather than throwing', () => {
			const project = makeProject({ lint: 'kill -TERM $$' })

			assertBlocked(settle(project))
		})
	})

	it('survives an enormous payload', () => {
		const project = makeProject({ lint: LINT_ECHOING_FILES })

		assertPassed(edit(project, 'a.ts', { note: 'x'.repeat(200_000) }))

		assert.deepEqual(editedIn(project), ['a.ts'])
	})

	it('survives a deeply nested payload', () => {
		const project = makeProject({ lint: 'true' })
		let nested: unknown = 'deep'
		for (let depth = 0; depth < 200; depth += 1) nested = { nested }

		assertPassed(run(project, { hook_event_name: 'Stop', extra: nested }))
	})
})
