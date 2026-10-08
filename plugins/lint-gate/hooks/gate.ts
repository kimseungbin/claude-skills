#!/usr/bin/env node
/**
 * lint-gate runner. One entry point for every trigger; the payload's
 * `hook_event_name` decides which.
 *
 * The gate's own machinery fails open: a payload it cannot read, a state file it
 * cannot write, or an exception lets the work through, because a missed lint is
 * recoverable and a session that cannot finish a turn is not. A *check* fails
 * closed: one that cannot start, is killed, runs out of time or produces output
 * that cannot be attributed is a check that did not pass.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'

import {
	conclude,
	formatCommand,
	judgeByExit,
	judgeEdited,
	planChecks,
	resolveConfig,
	rootRelative,
	testVerdict,
	verdictAsResult,
	watchCommand,
	withinRoot,
	type Check,
	type CheckResult,
	type GateConfig,
	type Location,
	type PlannedCheck,
	type RootEdits,
	type RunOutcome,
	type Trigger,
} from './core.ts'
import { parseOutput } from './parsers.ts'

interface Payload {
	hook_event_name?: string
	session_id?: string
	cwd?: string
	stop_hook_active?: boolean
	teammate_name?: string
	tool_name?: string
	tool_input?: { file_path?: unknown; notebook_path?: unknown }
	tool_response?: { bashEditDiff?: { changedFiles?: unknown } }
}

const TRIGGERS = new Set<Trigger>(['PostToolUse', 'Stop', 'TeammateIdle', 'SessionEnd'])

/**
 * The whole Stop run must finish inside the hook's own timeout (hooks.json gives
 * 600 s). A check that would outlive it is never started rather than killed with
 * no verdict, which Claude Code would treat as the hook passing.
 */
const STOP_BUDGET_MS = 570_000
const FORMAT_TIMEOUT_MS = 25_000
const STARTED = Date.now()

function readStdin(): string {
	try {
		return readFileSync(0, 'utf8')
	} catch {
		return ''
	}
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

interface LoadedConfig {
	config: GateConfig
	problems: string[]
	/** Identifies this config text, so a warning about it is shown once. */
	key: string
}

/** Project-owned. There is no shipped default — commands are project-specific, and guessing one would run something the project never asked for. */
function loadConfig(cwd: string): LoadedConfig {
	let text: string
	try {
		text = readFileSync(path.join(cwd, '.claude', 'config', 'lint-gate.json'), 'utf8')
	} catch {
		return { config: { checks: [] }, problems: [], key: '' }
	}

	const key = `config:${createHash('sha256').update(text).digest('hex')}`
	let raw: unknown
	try {
		raw = JSON.parse(text)
	} catch {
		return { config: { checks: [] }, problems: ['the file is not valid JSON, so nothing runs'], key }
	}
	const { config, problems } = resolveConfig(raw)
	return { config, problems, key }
}

// ---------------------------------------------------------------------------
// processes
// ---------------------------------------------------------------------------

function run(command: string, cwd: string, timeoutMs: number): RunOutcome {
	const child = spawnSync(command, {
		cwd,
		shell: true,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		timeout: timeoutMs,
		maxBuffer: 64 * 1024 * 1024,
	})
	const stdout = child.stdout ?? ''
	const stderr = child.stderr ?? ''

	if (child.error) {
		const code = (child.error as NodeJS.ErrnoException).code
		if (code === 'ETIMEDOUT') return { ran: false, why: `timed out after ${Math.round(timeoutMs / 1000)} s`, stdout, stderr }
		if (code === 'ENOENT' && !existsSync(cwd)) return { ran: false, why: `could not start: the run directory ${cwd} does not exist`, stdout, stderr }
		return { ran: false, why: `could not start: ${child.error.message}`, stdout, stderr }
	}
	if (child.signal) return { ran: false, why: `was killed by ${child.signal}`, stdout, stderr }
	return { ran: true, exitCode: child.status ?? 1, stdout, stderr }
}

/** Signal 0 tests for existence without delivering anything. */
function alive(pid: unknown): boolean {
	if (typeof pid !== 'number' || pid <= 0) return false
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

// ---------------------------------------------------------------------------
// checkouts
// ---------------------------------------------------------------------------

/**
 * Canonical form of a path, so `/tmp` and `/private/tmp` compare equal. A path
 * that does not exist yet is canonicalised through its nearest existing parent.
 */
function real(file: string): string {
	const absolute = path.resolve(file)
	try {
		return realpathSync(absolute)
	} catch {
		const parent = path.dirname(absolute)
		return parent === absolute ? absolute : path.join(real(parent), path.basename(absolute))
	}
}

/** The directory itself, or its closest ancestor that exists — git can only be asked from a real directory. */
function nearestDirectory(dir: string): string {
	let current = dir
	while (!existsSync(current)) {
		const parent = path.dirname(current)
		if (parent === current) break
		current = parent
	}
	return current
}

interface GitInfo {
	top: string
	common: string
}

const gitCache = new Map<string, GitInfo | null>()

function gitInfo(dir: string): GitInfo | null {
	if (gitCache.has(dir)) return gitCache.get(dir) ?? null
	let info: GitInfo | null = null
	try {
		const child = spawnSync('git', ['-C', dir, 'rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 10_000,
		})
		const [top, common] = (child.status === 0 ? child.stdout : '').split('\n')
		if (top && common) info = { top: real(top), common: real(common) }
	} catch {
		info = null
	}
	gitCache.set(dir, info)
	return info
}

/**
 * Which checkout root an edited file belongs to, or null if no project check
 * could resolve it.
 *
 * The session's project is the payload cwd. Inside git, every worktree of the
 * same repository is a checkout of that project — identified by a shared git
 * common dir — and a file belongs to the matching directory in its own
 * worktree. That is what lets an edit under `.claude/worktrees/x/` be checked
 * from `.claude/worktrees/x/`, with its own `node_modules` and its own state,
 * rather than from the main checkout that merely contains it.
 *
 * Everything else is outside: Claude Code writes plan and memory files under
 * `~/.claude`, and a file in another repository is not this project's. Handing
 * such a path to a tool that discovers its config per file fails the whole
 * invocation, which would take the in-project files down with it.
 */
function rootResolver(cwd: string): { project: string; rootOf: (file: string) => string | null } {
	const project = real(cwd)
	const main = gitInfo(project)
	if (!main) return { project, rootOf: (file) => (withinRoot(project, file) ? project : null) }

	const offset = path.relative(main.top, project)
	return {
		project,
		rootOf: (file) => {
			const info = gitInfo(nearestDirectory(path.dirname(file)))
			if (!info || info.common !== main.common) return null
			const root = offset === '' ? info.top : path.join(info.top, offset)
			return withinRoot(root, file) ? root : null
		},
	}
}

// ---------------------------------------------------------------------------
// session memory
// ---------------------------------------------------------------------------

/**
 * Per session and per agent scope: which failures the agent was told about,
 * which messages the user was shown, and which watchers this scope started.
 *
 * Scoped by teammate because two agents settling at different times must not
 * silence each other's failures, and must not be held to each other's files.
 */
interface ScopeState {
	blocked?: string[]
	notified?: string[]
	watchers?: Record<string, number>
}

function stateDir(): string {
	return path.join(os.homedir(), '.claude', 'lint-gate')
}

function safe(value: string): string {
	return value.replace(/[^A-Za-z0-9_-]/g, '_')
}

function statePath(sessionId: string): string {
	return path.join(stateDir(), `${sessionId}.json`)
}

function readState(sessionId: string): Record<string, ScopeState> {
	try {
		const parsed = JSON.parse(readFileSync(statePath(sessionId), 'utf8')) as unknown
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
		return parsed as Record<string, ScopeState>
	} catch {
		return {}
	}
}

function scopeState(sessionId: string, scope: string): ScopeState {
	const value = readState(sessionId)[scope]
	return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function listOf(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function updateScope(sessionId: string, scope: string, change: (current: ScopeState) => ScopeState): void {
	try {
		mkdirSync(stateDir(), { recursive: true })
		const state = readState(sessionId)
		const current = state[scope]
		state[scope] = change(current && typeof current === 'object' && !Array.isArray(current) ? current : {})
		writeFileSync(statePath(sessionId), JSON.stringify(state))
	} catch {
		// If the memory cannot be written the gate simply repeats itself once
		// more; that is better than failing the hook.
	}
}

function remember(sessionId: string, scope: string, key: 'blocked' | 'notified', values: string[]): void {
	if (values.length === 0) return
	updateScope(sessionId, scope, (current) => ({ ...current, [key]: [...new Set([...listOf(current[key]), ...values])] }))
}

/**
 * The edit log: one line per recorded edit, appended rather than rewritten.
 *
 * Whether a check runs at all now depends on this record, so a lost write is a
 * silently skipped check. PostToolUse hooks for parallel tool calls run at the
 * same time, and a read-modify-write of a shared file would drop one of two
 * concurrent edits. A single small append is not torn by a concurrent one.
 */
function editLogPath(sessionId: string, scope: string): string {
	return path.join(stateDir(), `${sessionId}-${safe(scope)}.edits`)
}

function recordEdits(sessionId: string, scope: string, files: string[]): void {
	if (files.length === 0) return
	try {
		mkdirSync(stateDir(), { recursive: true })
		const at = Date.now()
		appendFileSync(editLogPath(sessionId, scope), files.map((file) => `${JSON.stringify([file, at])}\n`).join(''))
	} catch {
		// Unrecordable: the same tolerance as the rest of the memory.
	}
}

/** Recorded edits, with the time each file was last edited. */
function readEdits(sessionId: string, scope: string): Map<string, number> {
	const edits = new Map<string, number>()
	let text = ''
	try {
		text = readFileSync(editLogPath(sessionId, scope), 'utf8')
	} catch {
		return edits
	}
	for (const line of text.split('\n')) {
		try {
			const [file, at] = JSON.parse(line) as unknown[]
			if (typeof file === 'string' && file !== '' && typeof at === 'number') edits.set(file, Math.max(at, edits.get(file) ?? 0))
		} catch {
			// A torn or foreign line costs that one record, nothing else.
		}
	}
	return edits
}

// ---------------------------------------------------------------------------
// watchers
// ---------------------------------------------------------------------------

/** One watcher per watch check per checkout, so a worktree's tests are watched from that worktree. */
function watcherKey(root: string, name: string): string {
	return createHash('sha256').update(`${root}\u0000${name}`).digest('hex').slice(0, 16)
}

function statusPath(sessionId: string, scope: string, key: string): string {
	return path.join(stateDir(), `${sessionId}-${safe(scope)}-${key}.status.json`)
}

/**
 * Start a watcher, detached, unless this scope's is still running.
 *
 * Detached and fully redirected: the hook exits immediately after an edit, and a
 * child sharing its stdio would be killed with it or would block the hook from
 * exiting. The report file is the only channel back — which is why the gate
 * treats a missing report as unknown rather than as success.
 */
function startWatcher(sessionId: string, scope: string, root: string, check: Check, runDir: string): void {
	const key = watcherKey(root, check.name)
	if (alive(scopeState(sessionId, scope).watchers?.[key])) return

	try {
		const child = spawn(watchCommand(check.watch as string, statusPath(sessionId, scope, key)), {
			cwd: runDir,
			shell: true,
			detached: true,
			stdio: 'ignore',
		})
		child.on('error', () => {})
		child.unref()
		const pid = child.pid
		if (typeof pid === 'number') {
			updateScope(sessionId, scope, (current) => ({ ...current, watchers: { ...(current.watchers ?? {}), [key]: pid } }))
		}
	} catch {
		// A watcher that will not start reports nothing, which the Stop gate
		// surfaces as an unknown verdict rather than silently passing.
	}
}

function stopWatchers(sessionId: string, scope: string): void {
	const watchers = scopeState(sessionId, scope).watchers ?? {}
	for (const pid of Object.values(watchers)) {
		if (!alive(pid)) continue
		try {
			// Negative pid kills the detached child's whole process group; a test
			// runner in watch mode spawns workers that would otherwise survive it.
			process.kill(-pid, 'SIGTERM')
		} catch {
			try {
				process.kill(pid, 'SIGTERM')
			} catch {
				// Already gone.
			}
		}
	}
	if (Object.keys(watchers).length > 0) updateScope(sessionId, scope, (current) => ({ ...current, watchers: {} }))
}

/** The watcher's latest report, with the mtime that says whether it is current. */
function readReport(file: string): { status: unknown; statusMtime: number | null } {
	try {
		const statusMtime = statSync(file).mtimeMs
		try {
			return { status: JSON.parse(readFileSync(file, 'utf8')), statusMtime }
		} catch {
			// Present but unparseable: mid-write, or truncated. Still a report,
			// so freshness is judged before the unreadable content is reported.
			return { status: null, statusMtime }
		}
	} catch {
		return { status: null, statusMtime: null }
	}
}

// ---------------------------------------------------------------------------
// triggers
// ---------------------------------------------------------------------------

/** Paths a tool call changed: the file a file tool wrote, or what Claude Code saw a Bash command change. */
function changedFiles(payload: Payload): string[] {
	if (payload.tool_name === 'Bash') {
		return listOf(payload.tool_response?.bashEditDiff?.changedFiles).filter((file) => file !== '')
	}
	const file = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path
	return typeof file === 'string' && file !== '' ? [file] : []
}

function afterEdit(payload: Payload, cwd: string, loaded: LoadedConfig, sessionId: string, scope: string): void {
	const { config } = loaded
	const files = changedFiles(payload).map((file) => path.resolve(cwd, file))
	if (files.length === 0) return

	// Recorded before anything else runs, whatever else is configured: this is
	// the only moment the edited path exists.
	if (config.checks.length > 0) recordEdits(sessionId, scope, files)

	const watched = config.checks.filter((check) => check.watch !== undefined)
	const formats = config.format !== undefined && payload.tool_name !== 'Bash'
	if (watched.length === 0 && !formats) return

	const { rootOf } = rootResolver(cwd)
	for (const file of files) {
		const resolved = real(file)
		const root = rootOf(resolved)
		if (root === null) continue

		// Lazily started: a session that never edits a watched unit never pays
		// for its watcher, and one that does pays once.
		for (const plan of planChecks(watched, [{ root, files: [resolved] }])) startWatcher(sessionId, scope, root, plan.check, plan.runDir)

		// Formatting is fire-and-forget: the edit already happened, so there is
		// nothing to block, and a formatter's own failure is not the agent's
		// problem. Run from the file's checkout, never on a file outside one.
		if (formats) run(formatCommand(config.format as string, rootRelative(root, resolved)), root, FORMAT_TIMEOUT_MS)
	}
}

function remainingMs(): number {
	return STOP_BUDGET_MS - (Date.now() - STARTED)
}

function runPlanned(plan: PlannedCheck, sessionId: string, scope: string, edits: Map<string, number>, edited: Set<string>): CheckResult {
	const { check, root, runDir } = plan
	const base = { name: check.name, command: plan.command, root }

	if (check.watch !== undefined) {
		const key = watcherKey(root, check.name)
		const { status, statusMtime } = readReport(statusPath(sessionId, scope, key))
		const lastEditAt = Math.max(...plan.matched.map((file) => edits.get(file) ?? 0))
		const verdict = testVerdict({
			status,
			statusMtime,
			lastEditAt: lastEditAt > 0 ? lastEditAt : null,
			watcherAlive: alive(scopeState(sessionId, scope).watchers?.[key]),
		})
		return verdictAsResult(verdict, base)
	}

	const remaining = remainingMs()
	const outcome: RunOutcome =
		remaining < 2_000
			? { ran: false, why: "was not started: lint-gate's time for this hook was already spent on earlier checks", stdout: '', stderr: '' }
			: run(plan.command, runDir, Math.min(check.timeoutSec * 1000, remaining - 1_000))

	if (check.report !== 'edited' || check.parse === undefined) return judgeByExit(base, outcome)

	const parsed = outcome.ran ? parseOutput(check.parse, outcome.stdout, outcome.stderr, outcome.exitCode) : null
	const relativeBase = parsed?.ok && parsed.base ? parsed.base : runDir
	const locate = (diagnostic: { file: string | null }): Location => {
		if (diagnostic.file === null) return 'global'
		const file = path.resolve(relativeBase, diagnostic.file)
		if (!existsSync(file)) return 'global'
		const resolved = real(file)
		if (!withinRoot(root, resolved) || resolved.split(path.sep).includes('node_modules')) return 'global'
		return edited.has(resolved) ? 'edited' : 'other'
	}
	return judgeEdited(base, outcome, parsed, locate)
}

/**
 * A checkout with a manifest but no installed dependencies — a fresh worktree,
 * typically — fails every typecheck and test for a reason that is not in the
 * code. Saying so keeps the agent from "fixing" types that are not broken.
 */
function dependencyNotes(results: CheckResult[]): string[] {
	const roots = [...new Set(results.filter((result) => !result.ok).map((result) => result.root))]
	return roots
		.filter((root) => existsSync(path.join(root, 'package.json')) && !existsSync(path.join(root, 'node_modules')))
		.map((root) => `Note: ${root} has a package.json but no node_modules — its dependencies are not installed, so these failures may not be in the code.`)
}

function settle(trigger: Trigger, payload: Payload, cwd: string, loaded: LoadedConfig, sessionId: string, scope: string): { block: string | null; messages: string[] } {
	const { config } = loaded
	if (config.checks.length === 0) return { block: null, messages: [] }

	const edits = readEdits(sessionId, scope)
	const { project, rootOf } = rootResolver(cwd)

	// Grouped by checkout. A recorded file that no longer exists is dropped:
	// handing a tool a missing path fails on something the agent cannot act on.
	const byRoot = new Map<string, string[]>()
	const editedTimes = new Map<string, number>()
	for (const [file, at] of edits) {
		if (!existsSync(file)) continue
		const resolved = real(file)
		const root = rootOf(resolved)
		if (root === null) continue
		byRoot.set(root, [...(byRoot.get(root) ?? []), resolved])
		editedTimes.set(resolved, Math.max(at, editedTimes.get(resolved) ?? 0))
	}
	const groups: RootEdits[] = [...byRoot].map(([root, files]) => ({ root, files }))
	const edited = new Set(editedTimes.keys())

	const planned = planChecks(config.checks, groups)
	if (planned.length === 0) return { block: null, messages: [] }

	const results = planned.map((plan) => runPlanned(plan, sessionId, scope, editedTimes, edited))

	const roots = new Set(planned.map((plan) => plan.root))
	const state = scopeState(sessionId, scope)
	const conclusion = conclude({
		trigger,
		results,
		alreadyBlocked: listOf(state.blocked),
		alreadyNotified: listOf(state.notified),
		stopHookActive: payload.stop_hook_active === true,
		notes: dependencyNotes(results),
		rootLabel: (root) => (roots.size > 1 || root !== project ? root : null),
	})

	if (conclusion.blocked) remember(sessionId, scope, 'blocked', [conclusion.blocked])
	remember(sessionId, scope, 'notified', conclusion.notified)
	return { block: conclusion.block, messages: conclusion.systemMessage ? [conclusion.systemMessage] : [] }
}

/** A config problem is shown to the user once per session, scope and config text. */
function configMessages(loaded: LoadedConfig, sessionId: string, scope: string): string[] {
	if (loaded.problems.length === 0 || loaded.key === '') return []
	if (listOf(scopeState(sessionId, scope).notified).includes(loaded.key)) return []
	remember(sessionId, scope, 'notified', [loaded.key])
	return [`lint-gate: .claude/config/lint-gate.json — ${loaded.problems.join('; ')}.`]
}

function main(): void {
	const raw = readStdin()
	if (!raw.trim()) return

	let payload: Payload
	try {
		payload = JSON.parse(raw) as Payload
	} catch {
		return
	}
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return

	const trigger = payload.hook_event_name as Trigger
	if (!TRIGGERS.has(trigger)) return

	const cwd = payload.cwd
	if (typeof cwd !== 'string' || cwd === '' || !existsSync(cwd) || !statSync(cwd).isDirectory()) return

	const sessionId = typeof payload.session_id === 'string' && payload.session_id !== '' ? safe(payload.session_id) : 'unknown-session'
	const scope = typeof payload.teammate_name === 'string' && payload.teammate_name !== '' ? payload.teammate_name : '__lead__'

	// The session is over; nothing is owed but cleanup. A detached watcher
	// outlives its session otherwise, and the next one starts another.
	if (trigger === 'SessionEnd') {
		stopWatchers(sessionId, scope)
		return
	}

	// Most Bash calls change nothing; they should cost nothing.
	if (trigger === 'PostToolUse' && changedFiles(payload).length === 0) return

	const loaded = loadConfig(cwd)
	const messages = configMessages(loaded, sessionId, scope)
	let block: string | null = null

	if (trigger === 'PostToolUse') {
		afterEdit(payload, cwd, loaded, sessionId, scope)
	} else {
		const settled = settle(trigger, payload, cwd, loaded, sessionId, scope)
		block = settled.block
		messages.push(...settled.messages)
	}

	const output: Record<string, string> = {}
	if (block !== null) {
		output.decision = 'block'
		output.reason = block
	}
	if (messages.length > 0) output.systemMessage = messages.join('\n')
	if (Object.keys(output).length > 0) process.stdout.write(JSON.stringify(output))
}

try {
	main()
} catch {
	process.exitCode = 0
}
