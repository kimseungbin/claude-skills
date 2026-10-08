/**
 * End-to-end tests for the lint-gate runner.
 *
 * `core.test.ts` and `parsers.test.ts` cover the pure layers. This file covers
 * the part that cannot be unit tested: gate.ts is a stdin-driven CLI, so every
 * case here spawns it for real and asserts on what it wrote to stdout and to its
 * state files.
 *
 * Two isolations make that safe, and both are load-bearing:
 *   - `HOME` points at a temp dir, so state never touches the real
 *     `~/.claude/lint-gate/`. The first test asserts the redirection works at all,
 *     and `runRaw` refuses to spawn if it does not.
 *   - the payload's `cwd` is a temp project dir, so the commands the hook runs are
 *     cheap shell builtins from a fixture config — never a real linter.
 *
 * Commands under test therefore double as probes: `printf … > received.txt` records
 * the arguments a check was handed, and `printf ran > ran.txt` proves whether a
 * check that should have been skipped ran anyway.
 */

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOKS = path.dirname(fileURLToPath(import.meta.url))
const GATE = path.join(HOOKS, 'gate.ts')

const ROOT = realpathSync(mkdtempSync(path.join(tmpdir(), 'lint-gate-hook-')))
const REAL_HOME = homedir()

after(() => rmSync(ROOT, { recursive: true, force: true }))

/** The scope key gate.ts uses when no teammate is named. */
const LEAD = '__lead__'

/** Fixture commands. Shell builtins only, and each one leaves evidence it ran. */
const FILES_ECHOING = String.raw`printf '%s\n' {files} > received.txt`
const FILES_ECHOING_THEN_FAILING = String.raw`printf '%s\n' {files} > received.txt; exit 1`
const MARKING = 'printf ran > ran.txt'
const MARKING_THEN_FAILING = 'printf ran > ran.txt; exit 1'
const FORMAT_ECHOING_FILE = String.raw`printf '%s\n' {file} >> formatted.txt`
const FORMAT_ECHOING_FILES = String.raw`printf '%s\n' {files} >> formatted.txt`
const MISSING_COMMAND = 'lint-gate-no-such-command-92f1'

const RAN = 'ran.txt'
const RECEIVED = 'received.txt'
const FORMATTED = 'formatted.txt'

function filesCheck(command = FILES_ECHOING, extra: Record<string, unknown> = {}) {
	return { name: 'lint', scope: 'files', command, ...extra }
}

function programCheck(command = MARKING, extra: Record<string, unknown> = {}) {
	return { name: 'typecheck', scope: 'program', command, ...extra }
}

function unitCheck(command = MARKING, extra: Record<string, unknown> = {}) {
	return { name: 'test', scope: 'unit', command, ...extra }
}

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
}

interface HookOutput {
	decision?: string
	reason?: string
	systemMessage?: string
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
function makeProject(config?: unknown, options: { session?: string; cwd?: string } = {}): Project {
	const project: Project = {
		cwd: options.cwd ?? mkdtempSync(path.join(ROOT, 'project-')),
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

function hookEnv(project: Project): NodeJS.ProcessEnv {
	assert.ok(
		HOME_IS_REDIRECTABLE,
		'refusing to spawn gate.ts: os.homedir() ignores HOME here, so its state would be written to the real ~/.claude',
	)
	return { ...process.env, HOME: project.home }
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
	const child = spawnSync(process.execPath, [GATE], {
		input: stdin,
		encoding: 'utf8',
		env: hookEnv(project),
		// Deliberately not the project dir: the real hook's working directory is
		// not the project's, so anything cwd-relative has to come from the payload.
		cwd: ROOT,
	})

	assert.equal(child.error, undefined, `could not spawn the hook: ${String(child.error)}`)
	assert.equal(child.status, 0, `the hook must always exit 0, got ${child.status}\nstderr:\n${child.stderr}`)
	assert.equal(crashNoise(child.stderr), '', `the hook must not report an error:\n${child.stderr}`)

	return { stdout: child.stdout, stderr: child.stderr }
}

/** Session and cwd default to the project's; pass `cwd: undefined` to drop it. */
function run(project: Project, payload: Record<string, unknown>): HookRun {
	return runRaw(project, JSON.stringify({ session_id: project.session, cwd: project.cwd, ...payload }))
}

function editPayload(file: string | undefined, extra: Record<string, unknown> = {}): Record<string, unknown> {
	return { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: file }, ...extra }
}

function edit(project: Project, file: string | undefined, extra: Record<string, unknown> = {}): HookRun {
	return run(project, editPayload(file, extra))
}

function bashEdit(project: Project, changedFiles: unknown, extra: Record<string, unknown> = {}): HookRun {
	return run(project, {
		hook_event_name: 'PostToolUse',
		tool_name: 'Bash',
		tool_input: { command: 'sed -i …' },
		tool_response: { stdout: '', bashEditDiff: { changedFiles } },
		...extra,
	})
}

function settle(project: Project, trigger: 'Stop' | 'TeammateIdle' = 'Stop', extra: Record<string, unknown> = {}): HookRun {
	return run(project, { hook_event_name: trigger, ...extra })
}

function outputOf(result: HookRun): HookOutput {
	if (result.stdout.trim() === '') return {}
	try {
		return JSON.parse(result.stdout) as HookOutput
	} catch {
		return assert.fail(`hook output must be valid JSON, got: ${result.stdout}`)
	}
}

/** Nothing at all: no block, and nothing for the user either. */
function assertSilent(result: HookRun, message?: string): void {
	assert.equal(result.stdout, '', message ?? `expected no output, got: ${result.stdout}`)
}

/** No block, whatever the user was told. */
function assertNotBlocked(result: HookRun, message?: string): void {
	assert.equal(outputOf(result).decision, undefined, message ?? `expected no block, got: ${result.stdout}`)
}

function assertBlocked(result: HookRun, message?: string): string {
	const output = outputOf(result)
	assert.equal(output.decision, 'block', message ?? `expected a block, got: ${result.stdout || '(nothing)'}`)
	assert.equal(typeof output.reason, 'string', 'a block must carry a string reason')
	assert.ok((output.reason as string).length > 0, 'a block reason must not be empty')
	return output.reason as string
}

function systemMessageOf(result: HookRun): string {
	const message = outputOf(result).systemMessage
	assert.equal(typeof message, 'string', `expected a message for the user, got: ${result.stdout || '(nothing)'}`)
	return message as string
}

// state -------------------------------------------------------------------

interface ScopeState {
	blocked?: string[]
	notified?: string[]
	watchers?: Record<string, number>
}

function stateDir(project: Project): string {
	return path.join(project.home, '.claude', 'lint-gate')
}

function statePath(project: Project, session = project.session): string {
	return path.join(stateDir(project), `${session}.json`)
}

function rawState(project: Project, session?: string): string | null {
	const file = statePath(project, session)
	return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function writeRawState(project: Project, contents: string): void {
	mkdirSync(stateDir(project), { recursive: true })
	writeFileSync(statePath(project), contents)
}

function stateOf(project: Project): Record<string, ScopeState> {
	const raw = rawState(project)
	return raw === null ? {} : (JSON.parse(raw) as Record<string, ScopeState>)
}

function blockedIn(project: Project, scope = LEAD): string[] {
	return stateOf(project)[scope]?.blocked ?? []
}

function editLog(project: Project, scope = LEAD, session = project.session): string {
	return path.join(stateDir(project), `${session}-${scope.replace(/[^A-Za-z0-9_-]/g, '_')}.edits`)
}

/** Recorded paths, in log order, with repeats. */
function editedIn(project: Project, scope = LEAD): string[] {
	const file = editLog(project, scope)
	if (!existsSync(file)) return []
	return readFileSync(file, 'utf8')
		.split('\n')
		.filter((line) => line !== '')
		.map((line) => (JSON.parse(line) as [string, number])[0])
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

/**
 * Write a file Claude Code owns rather than the project — what plan mode and
 * memory do. Under the project's HOME, so it is outside `cwd` while still really
 * existing.
 */
function touchOutside(project: Project, relative: string): string {
	const file = path.join(project.home, '.claude', relative)
	mkdirSync(path.dirname(file), { recursive: true })
	writeFileSync(file, 'x\n')
	return file
}

function evidence(project: Project, name: string, dir = project.cwd): string | null {
	const file = path.join(dir, name)
	return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function assertDidNotRun(project: Project, name = RAN, message?: string): void {
	assert.equal(evidence(project, name), null, message ?? `a command ran that should have been skipped (left ${name})`)
}

/** The argument list a probe command was handed, one path per line. */
function pathsSeenBy(project: Project, name = RECEIVED, dir = project.cwd): string[] {
	const written = evidence(project, name, dir)
	assert.notEqual(written, null, `the command never ran, so it saw no paths (no ${name})`)
	return (written as string).split('\n').filter((line) => line !== '')
}

function git(cwd: string, ...args: string[]): void {
	const child = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' })
	assert.equal(child.status, 0, `git ${args.join(' ')} failed: ${child.stderr}`)
}

/** A git repository with one commit, so worktrees can be added to it. */
function makeRepo(config: unknown): Project {
	const cwd = mkdtempSync(path.join(ROOT, 'repo-'))
	git(cwd, 'init', '-q')
	writeFileSync(path.join(cwd, 'README.md'), 'x\n')
	git(cwd, 'add', '-A')
	git(cwd, 'commit', '-qm', 'init')
	return makeProject(config, { cwd })
}

// ---------------------------------------------------------------------------
// isolation
// ---------------------------------------------------------------------------

describe('test isolation', () => {
	it('redirects os.homedir() inside the hook with HOME', () => {
		assert.ok(HOME_IS_REDIRECTABLE, 'os.homedir() does not follow HOME on this platform, so gate.ts state cannot be isolated')
	})

	it('writes session state under the temp HOME and never under the real one', () => {
		const project = makeProject({ checks: [filesCheck()] })
		touch(project, 'a.ts')

		edit(project, 'a.ts')

		assert.ok(existsSync(editLog(project)), 'expected an edit log under the temp HOME')
		assert.equal(existsSync(path.join(REAL_HOME, '.claude', 'lint-gate', `${project.session}-${LEAD}.edits`)), false)
	})
})

describe('hooks.json', () => {
	const hooks = JSON.parse(readFileSync(path.join(HOOKS, 'hooks.json'), 'utf8')) as {
		hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ timeout: number }> }>>
	}

	it('records edits made through Bash as well as the file tools', () => {
		const matcher = new RegExp(hooks.hooks.PostToolUse[0].matcher as string)
		for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash']) assert.ok(matcher.test(tool), tool)
		assert.equal(matcher.test('Read'), false)
	})

	/** The gate's own deadline (570 s) has to sit inside the hook's, or a slow check list is killed with no verdict. */
	it('gives Stop and TeammateIdle the full command-hook timeout', () => {
		for (const event of ['Stop', 'TeammateIdle']) assert.equal(hooks.hooks[event][0].hooks[0].timeout, 600, event)
	})
})

// ---------------------------------------------------------------------------
// PostToolUse — recording
// ---------------------------------------------------------------------------

describe('PostToolUse — recording what the session changed', () => {
	it('records the edited path, resolved against the payload cwd', () => {
		const project = makeProject({ checks: [programCheck()] })

		assertSilent(edit(project, 'src/a.ts'))

		assert.deepEqual(editedIn(project), [path.join(project.cwd, 'src/a.ts')])
	})

	it('records whatever the checks are, not only for {files}', () => {
		const project = makeProject({ checks: [unitCheck()] })
		edit(project, '/abs/src/a.ts')
		assert.deepEqual(editedIn(project), ['/abs/src/a.ts'])
	})

	it('records even when format is not configured at all', () => {
		const project = makeProject({ checks: [filesCheck()] })
		edit(project, 'a.ts')
		assert.equal(editedIn(project).length, 1)
		assertDidNotRun(project, FORMATTED)
	})

	it('records notebook_path when there is no file_path, and prefers file_path when both are present', () => {
		const project = makeProject({ checks: [filesCheck()] })
		run(project, { hook_event_name: 'PostToolUse', tool_name: 'NotebookEdit', tool_input: { notebook_path: 'n.ipynb' } })
		run(project, { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'a.ts', notebook_path: 'b.ipynb' } })
		assert.deepEqual(editedIn(project), [path.join(project.cwd, 'n.ipynb'), path.join(project.cwd, 'a.ts')])
	})

	it('records every file a Bash command changed', () => {
		const project = makeProject({ checks: [filesCheck()] })
		const a = touch(project, 'a.ts')
		const b = touch(project, 'src/b.ts')

		assertSilent(bashEdit(project, [a, b, 7, null, '']))

		assert.deepEqual(editedIn(project), [a, b], 'only string paths are records')
	})

	it('does nothing for a Bash command that changed nothing', () => {
		const project = makeProject({ checks: [filesCheck()] })
		assertSilent(run(project, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_response: { stdout: 'hi' } }))
		assertSilent(bashEdit(project, []))
		assert.equal(existsSync(stateDir(project)), false)
	})

	it('does not record when no checks are configured', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assert.equal(existsSync(editLog(project)), false, 'nothing consumes the record, so nothing should be kept')
	})

	it('does not record when there is no config file', () => {
		const project = makeProject()
		edit(project, 'a.ts')
		assert.equal(existsSync(stateDir(project)), false)
	})

	it('does nothing when tool_input carries no path', () => {
		const project = makeProject({ checks: [filesCheck()] })
		assertSilent(edit(project, undefined))
		assertSilent(run(project, { hook_event_name: 'PostToolUse' }))
		assertSilent(run(project, { hook_event_name: 'PostToolUse', tool_input: {} }))
		assert.equal(existsSync(stateDir(project)), false)
	})

	/**
	 * Parallel tool calls fire their PostToolUse hooks at the same time. Whether a
	 * check runs at all depends on this record, so a lost write would be a
	 * silently skipped check.
	 */
	it('keeps every edit when many hooks record at once', async () => {
		const project = makeProject({ checks: [filesCheck()] })
		const count = 12
		await Promise.all(
			Array.from({ length: count }, (_, index) =>
				new Promise<void>((resolve, reject) => {
					const child = spawn(process.execPath, [GATE], { env: hookEnv(project), cwd: ROOT, stdio: ['pipe', 'ignore', 'ignore'] })
					child.on('error', reject)
					child.on('exit', () => resolve())
					child.stdin.end(JSON.stringify({ session_id: project.session, cwd: project.cwd, ...editPayload(`f${index}.ts`) }))
				}),
			),
		)
		assert.equal(new Set(editedIn(project)).size, count)
	})
})

// ---------------------------------------------------------------------------
// PostToolUse — format
// ---------------------------------------------------------------------------

describe('PostToolUse — running the format command', () => {
	it('hands the formatter the edited file, relative to the project it runs in', () => {
		const project = makeProject({ format: String.raw`printf '%s %s\n' "$(pwd)" {file} >> formatted.txt` })
		touch(project, 'src/a.ts')

		edit(project, path.join(project.cwd, 'src/a.ts'))

		assert.deepEqual(pathsSeenBy(project, FORMATTED), [`${project.cwd} src/a.ts`])
	})

	it('runs once per edit', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		edit(project, 'a.ts')
		edit(project, 'b.ts')
		assert.deepEqual(pathsSeenBy(project, FORMATTED), ['a.ts', 'b.ts'])
	})

	it('does not format a file outside the project', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		edit(project, touchOutside(project, 'plans/p.md'))
		assertDidNotRun(project, FORMATTED, 'a plan file is not the project’s to reformat')
	})

	it('does not format files a Bash command changed', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE, checks: [filesCheck()] })
		bashEdit(project, [touch(project, 'gen.ts')])
		assertDidNotRun(project, FORMATTED)
	})

	it('shell-quotes a path with spaces and a quote', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		const nasty = `weird name's file.ts`
		edit(project, nasty)
		assert.deepEqual(pathsSeenBy(project, FORMATTED), [nasty])
	})

	/**
	 * Regression: a path arrives from a tool payload, so its quoting is where a
	 * mistake becomes command execution rather than a wrong answer. Asserted through
	 * the real hook because that is the path a payload actually travels.
	 */
	it('does not let a {file} token in the path break out of a {files} format command', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILES })
		const injecting = 'a{file};touch OWNED'

		edit(project, injecting)

		assert.deepEqual(readdirSync(project.cwd).filter((entry) => entry.includes('OWNED')), [])
		assert.deepEqual(pathsSeenBy(project, FORMATTED), [injecting])
	})

	it('passes a path containing regex replacement patterns through untouched', () => {
		const project = makeProject({ format: FORMAT_ECHOING_FILE })
		const patterns = "src/a$&b$'c$`d$1.ts"
		edit(project, patterns)
		assert.deepEqual(pathsSeenBy(project, FORMATTED), [patterns])
	})

	it('never runs a check on an edit', () => {
		const project = makeProject({ format: 'true', checks: [filesCheck(MARKING_THEN_FAILING + ' {files}'), programCheck(MARKING_THEN_FAILING)] })
		assertSilent(edit(project, 'a.ts'))
		assertDidNotRun(project, RAN, 'checks belong to Stop, not to every edit')
	})

	describe('never blocks, whatever the formatter does', () => {
		const formatters: Array<[string, string]> = [
			['exits non-zero', 'exit 1'],
			['exits non-zero with output', String.raw`printf 'style errors\n'; printf 'to stderr\n' >&2; exit 2`],
			['cannot be spawned', `${MISSING_COMMAND} {file}`],
			['is killed by a signal', 'kill -TERM $$'],
		]

		for (const [label, command] of formatters) {
			it(`stays silent when the formatter ${label}`, () => {
				const project = makeProject({ format: command, checks: [filesCheck()] })
				assertSilent(edit(project, 'a.ts'))
				assert.equal(editedIn(project).length, 1, 'the path is recorded before the formatter runs')
			})
		}
	})
})

// ---------------------------------------------------------------------------
// Stop / TeammateIdle
// ---------------------------------------------------------------------------

for (const trigger of ['Stop', 'TeammateIdle'] as const) {
	describe(`${trigger} — which checks the session owes`, () => {
		it('runs a files check against exactly the recorded paths', () => {
			const project = makeProject({ checks: [filesCheck()] })
			touch(project, 'a.ts')
			touch(project, 'src/b.ts')
			edit(project, 'a.ts')
			edit(project, path.join(project.cwd, 'src/b.ts'))
			edit(project, 'a.ts')

			assertSilent(settle(project, trigger))

			assert.deepEqual(pathsSeenBy(project), ['a.ts', 'src/b.ts'])
		})

		/** Issue #36: a read-only session was blocked by someone else's uncommitted error. */
		it('runs no check of any scope when nothing was edited', () => {
			const project = makeProject({ checks: [filesCheck(FILES_ECHOING_THEN_FAILING), programCheck(MARKING_THEN_FAILING), unitCheck(MARKING_THEN_FAILING)] })

			assertSilent(settle(project, trigger), 'nothing was edited, so nothing is owed')

			assertDidNotRun(project, RAN)
			assertDidNotRun(project, RECEIVED)
		})

		it('runs a program check once anything in the project was edited', () => {
			const project = makeProject({ checks: [programCheck('printf "3 problems\n" >&2; exit 1')] })
			touch(project, 'README.md')
			edit(project, 'README.md')

			assert.match(assertBlocked(settle(project, trigger)), /3 problems/)
		})

		it('runs a check only when an edit matches its when', () => {
			const project = makeProject({ checks: [unitCheck(MARKING, { when: ['packages/cdk/**', 'package-lock.json'] })] })
			touch(project, 'packages/api/a.ts')
			edit(project, 'packages/api/a.ts')
			assertSilent(settle(project, trigger))
			assertDidNotRun(project)

			touch(project, 'package-lock.json')
			edit(project, 'package-lock.json')
			settle(project, trigger)
			assert.equal(evidence(project, RAN), 'ran')
		})

		it('blocks when a files check fails, with its output', () => {
			const project = makeProject({ checks: [filesCheck(String.raw`printf 'a.ts:1 bad\n'; exit 1; {files}`)] })
			touch(project, 'a.ts')
			edit(project, 'a.ts')
			assert.match(assertBlocked(settle(project, trigger)), /a\.ts:1 bad/)
		})

		it('is skipped when only another scope recorded edits', () => {
			const project = makeProject({ checks: [programCheck(MARKING_THEN_FAILING)] })
			touch(project, 'a.ts')
			edit(project, 'a.ts', { teammate_name: 'alice' })
			assertSilent(settle(project, trigger))
			assertDidNotRun(project)
		})

		describe('paths outside the project', () => {
			it('keeps an out-of-project path out of a files check', () => {
				const project = makeProject({ checks: [filesCheck()] })
				touch(project, 'a.ts')
				edit(project, 'a.ts')
				edit(project, touchOutside(project, 'plans/refactor-the-gate.md'))

				assertSilent(settle(project, trigger))

				assert.deepEqual(pathsSeenBy(project), ['a.ts'])
			})

			it('owes nothing when every edit was outside the project', () => {
				const project = makeProject({ checks: [filesCheck(FILES_ECHOING_THEN_FAILING), programCheck(MARKING_THEN_FAILING)] })
				edit(project, touchOutside(project, 'plans/refactor-the-gate.md'))

				assertSilent(settle(project, trigger))

				assertDidNotRun(project)
				assertDidNotRun(project, RECEIVED)
			})
		})
	})
}

describe('running a check', () => {
	it('runs from its cwd, handing a files check paths relative to it', () => {
		const project = makeProject()
		const received = path.join(project.cwd, RECEIVED)
		writeConfig(project, {
			checks: [filesCheck(String.raw`printf '%s\n' "$(pwd)" {files} > ` + `'${received}'`, { cwd: 'packages/admin', when: 'packages/admin/**' })],
		})
		touch(project, 'packages/admin/src/a.css')
		edit(project, 'packages/admin/src/a.css')

		settle(project)

		assert.deepEqual(pathsSeenBy(project), [path.join(project.cwd, 'packages/admin'), 'src/a.css'])
	})

	it('blocks when its cwd does not exist', () => {
		const project = makeProject({ checks: [programCheck('true', { cwd: 'missing/dir' })] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assert.match(assertBlocked(settle(project)), /does not exist/)
	})

	it('blocks when it outlives its timeout', () => {
		const project = makeProject({ checks: [unitCheck('sleep 5', { timeoutSec: 1 })] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assert.match(assertBlocked(settle(project)), /timed out after 1 s/)
	})

	/** Not fail-open by design: at Stop a check that cannot run is a check that did not pass. */
	it('reports an unspawnable check as a failure', () => {
		const project = makeProject({ checks: [programCheck(MISSING_COMMAND)] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assert.match(assertBlocked(settle(project)), /could not be found/)
	})

	it('reports a check killed by a signal as a failure rather than throwing', () => {
		const project = makeProject({ checks: [programCheck('kill -TERM $$')] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assert.match(assertBlocked(settle(project)), /killed by SIGTERM/)
	})

	it('reports every failing check rather than stopping at the first', () => {
		const project = makeProject({
			checks: [
				{ name: 'typecheck:api', scope: 'program', command: 'printf api >> ran.txt; exit 1', when: 'packages/api/**' },
				{ name: 'typecheck:admin', scope: 'program', command: 'printf admin >> ran.txt; exit 1', when: 'packages/admin/**' },
			],
		})
		touch(project, 'packages/admin/App.svelte')
		touch(project, 'packages/api/a.ts')
		edit(project, 'packages/admin/App.svelte')
		edit(project, 'packages/api/a.ts')

		const reason = assertBlocked(settle(project))

		assert.equal(evidence(project, RAN), 'apiadmin', 'list order is run order')
		assert.match(reason, /2 checks failed/)
	})

	it('notes a project whose dependencies are not installed', () => {
		const project = makeProject({ checks: [programCheck('exit 1')] })
		touch(project, 'package.json', '{}')
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assert.match(assertBlocked(settle(project)), /no node_modules/)
	})
})

describe('report: "edited"', () => {
	/** Prints tsc-shaped output naming a.ts and b.ts, then fails as tsc does. */
	const TSC = String.raw`printf '%s\n' "a.ts(1,1): error TS2322: Type 'number' is not assignable to type 'string'." "b.ts(2,2): error TS2554: Expected 0 arguments, but got 1."; exit 1`

	function editedProject(command = TSC) {
		const project = makeProject({ checks: [programCheck(command, { report: 'edited', parse: 'tsc' })] })
		touch(project, 'a.ts')
		touch(project, 'b.ts')
		return project
	}

	it('blocks on errors in edited files, and only shows those', () => {
		const project = editedProject()
		edit(project, 'a.ts')

		const reason = assertBlocked(settle(project))

		assert.match(reason, /^a\.ts\(1,1\)/m)
		assert.doesNotMatch(reason, /^b\.ts\(2,2\)/m)
		assert.match(reason, /1 error located in files this session did not edit was not counted/)
	})

	it('passes, telling the user what it did not count, when no error is in an edited file', () => {
		const project = editedProject()
		touch(project, 'c.ts')
		edit(project, 'c.ts')

		const result = settle(project)

		assertNotBlocked(result)
		assert.match(systemMessageOf(result), /2 errors located in files this session did not edit were not counted/)
		assertSilent(settle(project), 'the same notice is shown once')
	})

	it('blocks unfiltered on output it cannot parse', () => {
		const project = editedProject(`${TSC.replace('; exit 1', '')}; echo 'npm ERR! code 2'; exit 1`)
		edit(project, 'c.ts')
		touch(project, 'c.ts')

		const reason = assertBlocked(settle(project))

		assert.match(reason, /could not parse/)
		assert.match(reason, /^b\.ts\(2,2\)/m, 'unfiltered shows everything')
	})

	it('keeps an error located in a file that does not exist', () => {
		const project = editedProject(String.raw`printf '%s\n' "ghost.ts(1,1): error TS2322: x"; exit 1`)
		touch(project, 'c.ts')
		edit(project, 'c.ts')
		assert.match(assertBlocked(settle(project)), /ghost\.ts/)
	})

	it('keeps an error inside node_modules', () => {
		const project = editedProject(String.raw`printf '%s\n' "node_modules/x/index.d.ts(1,1): error TS2307: Cannot find module 'y'."; exit 1`)
		touch(project, 'node_modules/x/index.d.ts')
		touch(project, 'c.ts')
		edit(project, 'c.ts')
		assert.match(assertBlocked(settle(project)), /Cannot find module/)
	})
})

describe('repeating itself', () => {
	function failingProject(output = 'same') {
		const project = makeProject({ checks: [programCheck(`printf "${output}\n"; exit 1`)] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		return project
	}

	it('does not ask the agent twice about the same failure, and tells the user once', () => {
		const project = failingProject()

		assertBlocked(settle(project))
		assert.equal(blockedIn(project).length, 1)

		const second = settle(project)
		assertNotBlocked(second, 'the agent has already been told about this failure')
		assert.match(systemMessageOf(second), /already told/)

		assertSilent(settle(project), 'and the user only once')
	})

	it('blocks again when the failure changes', () => {
		const project = failingProject('first')
		assertBlocked(settle(project))

		writeConfig(project, { checks: [programCheck('printf "second\n"; exit 1')] })

		assertBlocked(settle(project), 'a different failure has not been reported yet')
		assert.equal(blockedIn(project).length, 2)
	})

	it('does not block when stop_hook_active is set, and tells the user instead', () => {
		const project = failingProject()

		const result = settle(project, 'Stop', { stop_hook_active: true })

		assertNotBlocked(result)
		assert.match(systemMessageOf(result), /stop hook/)
		assert.deepEqual(blockedIn(project), [], 'the agent was not told, so nothing is remembered as told')
	})

	it('stays silent when every check passes', () => {
		const project = makeProject({ checks: [programCheck('true'), unitCheck('true')] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')
		assertSilent(settle(project))
	})
})

describe('stale recorded paths', () => {
	it('drops a path that has since been deleted', () => {
		const project = makeProject({ checks: [filesCheck()] })
		touch(project, 'a.ts')
		touch(project, 'gone.ts')
		edit(project, 'a.ts')
		edit(project, 'gone.ts')
		remove(project, 'gone.ts')

		settle(project)

		assert.deepEqual(pathsSeenBy(project), ['a.ts'])
	})

	it('owes nothing when every recorded path is gone', () => {
		const project = makeProject({ checks: [programCheck(MARKING_THEN_FAILING)] })
		touch(project, 'gone.ts')
		edit(project, 'gone.ts')
		remove(project, 'gone.ts')

		assertSilent(settle(project))
		assertDidNotRun(project)
	})
})

describe('teammate scoping', () => {
	it('keeps each scope’s edits to itself', () => {
		const project = makeProject({ checks: [filesCheck()] })
		touch(project, 'alice.ts')
		touch(project, 'lead.ts')

		edit(project, 'alice.ts', { teammate_name: 'alice' })
		edit(project, 'lead.ts')

		settle(project, 'TeammateIdle', { teammate_name: 'alice' })
		assert.deepEqual(pathsSeenBy(project), ['alice.ts'], 'one agent must not be held to another agent’s files')

		settle(project, 'Stop')
		assert.deepEqual(pathsSeenBy(project), ['lead.ts'])
	})

	it('does not let one scope silence another scope’s failure', () => {
		const project = makeProject({ checks: [programCheck('printf "shared failure\n"; exit 1')] })
		touch(project, 'a.ts')
		for (const teammate of ['alice', 'bob']) edit(project, 'a.ts', { teammate_name: teammate })
		edit(project, 'a.ts')

		assertBlocked(settle(project, 'TeammateIdle', { teammate_name: 'alice' }))
		assertNotBlocked(settle(project, 'TeammateIdle', { teammate_name: 'alice' }), 'alice was already told')

		assertBlocked(settle(project, 'TeammateIdle', { teammate_name: 'bob' }), 'bob has not been told yet')
		assertBlocked(settle(project, 'Stop'), 'the lead has not been told yet')
	})
})

// ---------------------------------------------------------------------------
// checkouts
// ---------------------------------------------------------------------------

describe('worktrees and other checkouts', () => {
	it('checks a worktree edit from the worktree, not from the checkout that contains it', () => {
		const project = makeRepo({ checks: [filesCheck(String.raw`printf '%s\n' "$(pwd)" {files} > received.txt`)] })
		git(project.cwd, 'worktree', 'add', '-q', '.claude/worktrees/wt')
		const worktree = path.join(project.cwd, '.claude', 'worktrees', 'wt')
		mkdirSync(path.join(worktree, 'src'), { recursive: true })
		writeFileSync(path.join(worktree, 'src', 'a.ts'), 'x\n')

		edit(project, path.join(worktree, 'src', 'a.ts'))
		settle(project)

		assert.deepEqual(pathsSeenBy(project, RECEIVED, worktree), [worktree, 'src/a.ts'])
		assertDidNotRun(project, RECEIVED, 'the main checkout must not lint a worktree path')
	})

	it('names the checkout when a failure is not in the session’s own', () => {
		const project = makeRepo({ checks: [programCheck('exit 1')] })
		git(project.cwd, 'worktree', 'add', '-q', '.claude/worktrees/wt')
		const worktree = path.join(project.cwd, '.claude', 'worktrees', 'wt')
		writeFileSync(path.join(worktree, 'a.ts'), 'x\n')
		edit(project, path.join(worktree, 'a.ts'))

		assert.ok(assertBlocked(settle(project)).includes(`(in ${worktree})`))
	})

	it('ignores a file in another repository', () => {
		const project = makeRepo({ checks: [programCheck(MARKING_THEN_FAILING)] })
		const other = makeRepo({})
		const file = path.join(other.cwd, 'a.ts')
		writeFileSync(file, 'x\n')

		edit(project, file)

		assertSilent(settle(project))
		assertDidNotRun(project)
	})

	it('keeps the project’s subdirectory when the session runs below the repository root', () => {
		const repo = makeRepo({})
		const app = path.join(repo.cwd, 'apps', 'web')
		mkdirSync(app, { recursive: true })
		const project = makeProject({ checks: [filesCheck()] }, { cwd: app })
		writeFileSync(path.join(app, 'a.ts'), 'x\n')
		writeFileSync(path.join(repo.cwd, 'outside-app.ts'), 'x\n')

		edit(project, 'a.ts')
		edit(project, path.join(repo.cwd, 'outside-app.ts'))
		settle(project)

		assert.deepEqual(pathsSeenBy(project), ['a.ts'], 'a file in the repository but outside the project is not the project’s')
	})
})

// ---------------------------------------------------------------------------
// config problems
// ---------------------------------------------------------------------------

describe('config problems', () => {
	it('tells the user once per session about retired keys, and runs nothing for them', () => {
		const project = makeProject({ lint: MARKING_THEN_FAILING })
		touch(project, 'a.ts')

		const first = edit(project, 'a.ts')
		assertNotBlocked(first)
		assert.match(systemMessageOf(first), /`lint` is no longer a lint-gate key.*\/lint-setup/)

		assertSilent(settle(project), 'told once is enough')
		assertDidNotRun(project)
	})

	it('tells the user again after the config changes', () => {
		const project = makeProject({ lint: 'x' })
		systemMessageOf(settle(project))
		writeConfig(project, { typecheck: 'x' })
		assert.match(systemMessageOf(settle(project)), /`typecheck`/)
	})

	it('keeps the valid checks of a partly invalid config', () => {
		const project = makeProject({ checks: [{ name: 'bad', scope: 'files', command: 'eslint .' }, programCheck()] })
		touch(project, 'a.ts')
		edit(project, 'a.ts')

		const result = settle(project)

		assertNotBlocked(result)
		assert.equal(evidence(project, RAN), 'ran', 'a bad sibling must not disable a good one')
	})
})

// ---------------------------------------------------------------------------
// session state
// ---------------------------------------------------------------------------

describe('session state', () => {
	it('names the state after the session, and falls back to a fixed name without one', () => {
		const project = makeProject({ checks: [filesCheck()] }, { session: 'abc-123' })
		edit(project, 'a.ts')
		assert.ok(existsSync(editLog(project, LEAD, 'abc-123')))

		run(project, { ...editPayload('a.ts'), session_id: undefined })
		assert.ok(existsSync(editLog(project, LEAD, 'unknown-session')), 'a missing session id must not lose the recording')
	})

	it('ignores torn and foreign lines in the edit log', () => {
		const project = makeProject({ checks: [filesCheck()] })
		const file = touch(project, 'real.ts')
		mkdirSync(stateDir(project), { recursive: true })
		writeFileSync(editLog(project), `not json\n[123, 1]\n["${file}", 1]\n["x"`)

		settle(project)

		assert.deepEqual(pathsSeenBy(project), ['real.ts'])
	})

	describe('degrades safely on an unreadable state file', () => {
		const junk: Array<[string, string]> = [
			['unparseable', 'not json {'],
			['a top-level array', '[]'],
			['null', 'null'],
			['a legacy bare array per scope', JSON.stringify({ [LEAD]: ['signature'] })],
			['empty', ''],
		]

		for (const [label, contents] of junk) {
			it(`still blocks and rewrites valid state when the file is ${label}`, () => {
				const project = makeProject({ checks: [programCheck('exit 1')] })
				touch(project, 'a.ts')
				edit(project, 'a.ts')
				writeRawState(project, contents)

				assertBlocked(settle(project))

				assert.equal(blockedIn(project).length, 1, `state was not repaired: ${rawState(project)}`)
			})
		}
	})

	it('repeats itself rather than failing when the state cannot be written', () => {
		const project = makeProject({ checks: [programCheck(MARKING_THEN_FAILING)] })
		mkdirSync(path.join(project.home, '.claude'), { recursive: true })
		// A file where the state directory belongs: mkdir and every write fail.
		writeFileSync(stateDir(project), 'not a directory\n')

		assertSilent(edit(project, 'a.ts'), 'an unwritable memory must not break the edit')
		assertSilent(settle(project), 'and with no record of the edit, nothing is owed')
	})
})

// ---------------------------------------------------------------------------
// fails open
// ---------------------------------------------------------------------------

/**
 * The central promise of the gate's own machinery: whatever it is handed, the
 * hook exits 0 and says nothing on stderr (both asserted in `runRaw`). Every
 * project here is configured with a check that would block loudly and leave a
 * marker if the hook ever got as far as running it.
 */
describe('fails open', () => {
	function loudProject(): Project {
		const project = makeProject({ format: MARKING_THEN_FAILING, checks: [programCheck(MARKING_THEN_FAILING)] })
		touch(project, 'a.ts')
		return project
	}

	describe('on bad stdin', () => {
		const inputs: Array<[string, string]> = [
			['empty', ''],
			['not JSON', 'not json at all'],
			['truncated JSON', '{"hook_event_name": "Stop"'],
			['a bare string', '"Stop"'],
			['null', 'null'],
			['an array', '[{"hook_event_name":"Stop"}]'],
			['NUL bytes', '\u0000\u0000'],
		]

		for (const [label, stdin] of inputs) {
			it(`ignores stdin that is ${label}`, () => {
				const project = loudProject()
				assertSilent(runRaw(project, stdin))
				assertDidNotRun(project)
			})
		}
	})

	describe('on an unrecognized trigger', () => {
		for (const event of ['PreToolUse', 'SessionStart', 'SubagentStop', 'stop', 'Stop ', '', 42, null]) {
			it(`ignores hook_event_name ${JSON.stringify(event)}`, () => {
				const project = loudProject()
				assertSilent(run(project, { ...editPayload('a.ts'), hook_event_name: event }))
				assertDidNotRun(project)
				assert.equal(existsSync(stateDir(project)), false)
			})
		}
	})

	describe('on a bad cwd', () => {
		for (const [label, cwd] of [
			['missing', undefined],
			['empty', ''],
			['nonexistent', path.join(ROOT, 'no-such-project-dir')],
			['not a string', 42],
		] as Array<[string, unknown]>) {
			it(`runs nothing when cwd is ${label}`, () => {
				const project = loudProject()
				assertSilent(run(project, { hook_event_name: 'Stop', cwd }))
				assertSilent(run(project, { ...editPayload('a.ts'), cwd }))
				assertDidNotRun(project)
			})
		}

		it('runs nothing when cwd is a file', () => {
			const project = loudProject()
			const file = path.join(ROOT, 'cwd-is-a-file')
			writeFileSync(file, 'x')
			assertSilent(run(project, { hook_event_name: 'Stop', cwd: file }))
		})
	})

	describe('on a bad config', () => {
		const configs: Array<[string, unknown]> = [
			['unparseable', '{ "checks": '],
			['a JSON array', '[{"name":"x"}]'],
			['JSON null', 'null'],
			['a list of junk checks', { checks: [42, null, { name: 'x' }, { name: 'y', scope: 'program', command: 'tsc {files}' }] }],
		]

		for (const [label, config] of configs) {
			it(`runs nothing, and says why once, for a config that is ${label}`, () => {
				const project = makeProject(config)
				touch(project, 'a.ts')

				const first = edit(project, 'a.ts')
				assertNotBlocked(first)
				assert.match(systemMessageOf(first), /lint-gate\.json/)

				assertSilent(settle(project))
				assertSilent(settle(project, 'TeammateIdle'))
			})
		}

		it('is silent for an empty config', () => {
			const project = makeProject({})
			assertSilent(edit(project, 'a.ts'))
			assertSilent(settle(project))
		})

		it('is silent when the config file is missing, or is a directory', () => {
			const missing = makeProject()
			assertSilent(settle(missing))
			assertSilent(edit(missing, 'a.ts'))

			const directory = makeProject()
			mkdirSync(path.join(directory.cwd, '.claude', 'config', 'lint-gate.json'), { recursive: true })
			assertSilent(settle(directory))
		})
	})

	it('survives an enormous payload', () => {
		const project = makeProject({ checks: [filesCheck()] })
		assertSilent(edit(project, 'a.ts', { note: 'x'.repeat(200_000) }))
		assert.equal(editedIn(project).length, 1)
	})

	it('survives a deeply nested payload', () => {
		const project = makeProject({ checks: [programCheck('true')] })
		let nested: unknown = 'deep'
		for (let depth = 0; depth < 200; depth += 1) nested = { nested }
		assertSilent(run(project, { hook_event_name: 'Stop', extra: nested }))
	})
})

// ---------------------------------------------------------------------------
// watched tests
// ---------------------------------------------------------------------------

/**
 * A watcher that reports once and then stays alive, like a real one between
 * runs. Cheap enough to spawn for real, which matters: the point of these cases
 * is the process lifecycle, and a stubbed spawn would test nothing.
 */
const WATCHER_REPORTING = String.raw`printf '{"success":true}' > {status}; sleep 300`
const WATCHER_SILENT = 'sleep 300 # {status}'

function watchCheck(watch: string, extra: Record<string, unknown> = {}) {
	return { name: 'test', scope: 'unit', watch, ...extra }
}

function watcherPids(project: Project, scope = LEAD): number[] {
	return Object.values(stateOf(project)[scope]?.watchers ?? {})
}

/** The one status file this project's watcher has written; call `awaitReport` first. */
function statusFile(project: Project): string {
	const files = readdirSync(stateDir(project)).filter((name) => name.endsWith('.status.json'))
	if (files.length === 1) return path.join(stateDir(project), files[0])
	return assert.fail(`expected exactly one status file, found ${JSON.stringify(files)}`)
}

/** Write a report at a chosen age relative to now, where the watcher was told to. */
function writeReport(project: Project, report: unknown, offsetMs: number): void {
	const file = statusFile(project)
	writeFileSync(file, JSON.stringify(report))
	const when = (Date.now() + offsetMs) / 1000
	utimesSync(file, when, when)
}

const strays: number[] = []
after(() => {
	for (const pid of strays) {
		try {
			process.kill(-pid, 'SIGKILL')
		} catch {
			try {
				process.kill(pid, 'SIGKILL')
			} catch {
				// already gone
			}
		}
	}
})

function alive(pid: number | undefined): boolean {
	if (typeof pid !== 'number') return false
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

/** Edit, and keep the watcher it starts on the kill list. */
function editWatched(project: Project, file: string): void {
	touch(project, file)
	edit(project, file)
	strays.push(...watcherPids(project))
}

/** Wait until the reporting watcher has written its first report. */
function awaitReport(project: Project): void {
	const deadline = Date.now() + 5_000
	while (Date.now() < deadline) {
		if (existsSync(stateDir(project)) && readdirSync(stateDir(project)).some((name) => name.endsWith('.status.json'))) return
		spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)'])
	}
	assert.fail('the watcher never wrote its report')
}

describe('starting a watcher', () => {
	it('starts one on the first matching edit, and leaves it running', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')

		const [pid] = watcherPids(project)
		assert.equal(typeof pid, 'number', 'the pid must be recorded so the gate can check liveness later')
		assert.ok(alive(pid), 'the watcher must outlive the hook that spawned it')
	})

	it('does not start a second one on the next edit', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')
		const first = watcherPids(project)

		editWatched(project, 'src/b.ts')
		assert.deepEqual(watcherPids(project), first, 'a session pays for one watcher, not one per edit')
	})

	it('starts nothing for an edit outside its when', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING, { when: 'packages/api/**' })] })
		editWatched(project, 'packages/admin/a.ts')
		assert.deepEqual(watcherPids(project), [])
	})

	it('starts one watcher per watch check', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_SILENT), { ...watchCheck(WATCHER_SILENT), name: 'test:e2e' }] })
		editWatched(project, 'a.ts')
		assert.equal(watcherPids(project).length, 2)
	})
})

describe('stopping watchers', () => {
	it('kills them on SessionEnd and forgets them', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')
		const [pid] = watcherPids(project)
		assert.ok(alive(pid))

		run(project, { hook_event_name: 'SessionEnd' })

		// SIGTERM is not instant; give the process a moment to actually go.
		const deadline = Date.now() + 5_000
		while (alive(pid) && Date.now() < deadline) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)'])
		assert.ok(!alive(pid), 'a detached watcher must not outlive its session')
		assert.deepEqual(watcherPids(project), [])
	})

	it('is harmless when there is nothing to stop', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		assertSilent(run(project, { hook_event_name: 'SessionEnd' }))
	})
})

describe('gating on a watcher verdict', () => {
	it('blocks when the watcher has reported nothing', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_SILENT)] })
		editWatched(project, 'src/a.ts')
		assert.match(assertBlocked(settle(project)), /No usable verdict/)
	})

	it('passes on a fresh successful report', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')
		awaitReport(project)
		writeReport(project, { success: true }, 1_000)

		assertSilent(settle(project))
	})

	it('blocks on a report older than the last matching edit', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')
		awaitReport(project)
		writeReport(project, { success: true }, -60_000)

		assert.match(assertBlocked(settle(project)), /predates the most recent edit/)
	})

	it('judges freshness against edits its when matches, not against unrelated ones', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING, { when: 'src/**' })] })
		editWatched(project, 'src/a.ts')
		awaitReport(project)
		writeReport(project, { success: true }, 1_000)
		// Later than the report, but outside the watcher's when.
		touch(project, 'docs/x.md')
		const later = Date.now() + 5_000
		mkdirSync(stateDir(project), { recursive: true })
		writeFileSync(editLog(project), `${readFileSync(editLog(project), 'utf8')}${JSON.stringify([path.join(project.cwd, 'docs/x.md'), later])}\n`)

		assertSilent(settle(project))
	})

	it('blocks with a count when tests are failing', () => {
		const project = makeProject({ checks: [watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')
		awaitReport(project)
		writeReport(project, { success: false, numFailedTests: 2, numTotalTests: 9 }, 1_000)

		assert.match(assertBlocked(settle(project)), /2 of 9 tests failing/)
	})

	it('reports a check failure and a test failure together', () => {
		const project = makeProject({ checks: [programCheck(MARKING_THEN_FAILING), watchCheck(WATCHER_REPORTING)] })
		editWatched(project, 'src/a.ts')
		awaitReport(project)
		writeReport(project, { success: false, numFailedTests: 1, numTotalTests: 4 }, 1_000)

		const reason = assertBlocked(settle(project))
		assert.match(reason, /1 of 4 tests failing/)
		assert.match(reason, /typecheck/)
	})
})
