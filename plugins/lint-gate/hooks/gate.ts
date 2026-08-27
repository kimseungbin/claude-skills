#!/usr/bin/env node
/**
 * lint-gate runner. One entry point for all three triggers; the payload's
 * `hook_event_name` decides which.
 *
 * Fails open everywhere. This runs on every edit and every stop — a gate that
 * cannot read its config, cannot spawn, or throws must let the work through.
 * A missed lint is recoverable; a session that cannot finish a turn is not.
 */

import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import {
	commandsFor,
	decide,
	failureSignature,
	formatCommand,
	resolveConfig,
	scopeCommands,
	testVerdict,
	tracksEditedFiles,
	tracksEditTime,
	verdictAsResult,
	watchCommand,
	type CommandResult,
	type Trigger,
} from './core.ts'

interface Payload {
	hook_event_name?: string
	session_id?: string
	cwd?: string
	stop_hook_active?: boolean
	teammate_name?: string
	tool_input?: { file_path?: string; notebook_path?: string }
}

const TRIGGERS = new Set<Trigger>(['PostToolUse', 'Stop', 'TeammateIdle', 'SessionEnd'])

function readStdin(): string {
	try {
		return readFileSync(0, 'utf8')
	} catch {
		return ''
	}
}

/** Project-owned. There is no shipped default — commands are project-specific, and guessing one would run something the project never asked for. */
function loadConfig(cwd: string | undefined) {
	if (!cwd) return {}
	try {
		return resolveConfig(JSON.parse(readFileSync(path.join(cwd, '.claude', 'config', 'lint-gate.json'), 'utf8')))
	} catch {
		return {}
	}
}

function run(command: string, cwd: string): { ok: boolean; output: string } {
	try {
		const output = execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 })
		return { ok: true, output }
	} catch (error) {
		const shelled = error as { stdout?: string; stderr?: string; message?: string }
		return { ok: false, output: `${shelled.stdout ?? ''}${shelled.stderr ?? ''}`.trim() || (shelled.message ?? 'command failed') }
	}
}

/**
 * Session memory, per session and per agent: which failures have been reported,
 * and which files were edited.
 *
 * Scoped by teammate because two agents settling at different times must not
 * silence each other's failures, and must not lint each other's files.
 *
 * A file written by an older version holds a bare array of signatures per scope.
 * That is read as absent rather than migrated — the worst outcome is one
 * repeated block in a session that spanned the upgrade.
 */
type Memory = 'blocked' | 'edited'

interface ScopeState {
	blocked?: string[]
	edited?: string[]
	/** When code last changed, for judging whether a test report is current. */
	editedAt?: number
	/** The watcher this scope started, if any. */
	watcherPid?: number
}

function statePath(sessionId: string): string {
	return path.join(os.homedir(), '.claude', 'lint-gate', `${sessionId}.json`)
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

function listFrom(state: Record<string, ScopeState>, scope: string, key: Memory): string[] {
	const list = state[scope]?.[key]
	return Array.isArray(list) ? list.filter((entry) => typeof entry === 'string') : []
}

function remembered(sessionId: string, scope: string, key: Memory): string[] {
	return listFrom(readState(sessionId), scope, key)
}

/**
 * Deduped on write as well as on read: the same file is edited many times in a
 * session, and an append-only list would grow without bound for no added
 * information. Signatures are hashes, so a repeat carries none either.
 */
function remember(sessionId: string, scope: string, key: Memory, values: string[]): void {
	try {
		const file = statePath(sessionId)
		mkdirSync(path.dirname(file), { recursive: true })

		const state = readState(sessionId)
		state[scope] = { ...(state[scope] ?? {}), [key]: [...new Set([...listFrom(state, scope, key), ...values])] }
		writeFileSync(file, JSON.stringify(state))
	} catch {
		// If the memory cannot be written the gate simply repeats itself once
		// more; that is better than failing the hook.
	}
}

/**
 * The edited paths still worth checking.
 *
 * An agent may write a file and then delete or rename it in the same session.
 * Handing a linter a path that no longer exists exits non-zero on "no files
 * matching", which would reach the agent as a lint failure it cannot act on.
 * Resolved against the payload's cwd, since the hook's own working directory is
 * not the project's.
 */
/**
 * Scalar scope fields, kept apart from the list-valued memories above because
 * they overwrite rather than accumulate.
 */
function readScalar<K extends 'editedAt' | 'watcherPid'>(sessionId: string, scope: string, key: K): ScopeState[K] {
	return readState(sessionId)[scope]?.[key]
}

function writeScalar<K extends 'editedAt' | 'watcherPid'>(sessionId: string, scope: string, key: K, value: ScopeState[K]): void {
	try {
		const file = statePath(sessionId)
		mkdirSync(path.dirname(file), { recursive: true })
		const state = readState(sessionId)
		state[scope] = { ...(state[scope] ?? {}), [key]: value }
		writeFileSync(file, JSON.stringify(state))
	} catch {
		// Same tolerance as remember(): a lost write costs accuracy, not a session.
	}
}

/** Where the watcher writes, and the gate reads. Per session and per scope, so teammates never share one. */
function statusPath(sessionId: string, scope: string): string {
	const safe = scope.replace(/[^A-Za-z0-9_-]/g, '_')
	return path.join(os.homedir(), '.claude', 'lint-gate', `${sessionId}-${safe}-test.json`)
}

/** Signal 0 tests for existence without delivering anything. */
function alive(pid: number | undefined): boolean {
	if (typeof pid !== 'number' || pid <= 0) return false
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

/**
 * Start the watcher, detached, once per scope.
 *
 * Detached and fully redirected: the hook exits immediately after an edit, and
 * a child sharing its stdio would be killed with it or would block the hook
 * from exiting. The report file is the only channel back — which is why the
 * gate treats a missing report as unknown rather than as success.
 */
function startWatcher(command: string, cwd: string, sessionId: string, scope: string): void {
	if (alive(readScalar(sessionId, scope, 'watcherPid'))) return

	try {
		const child = spawn(command, {
			cwd,
			shell: true,
			detached: true,
			stdio: 'ignore',
		})
		child.unref()
		if (typeof child.pid === 'number') writeScalar(sessionId, scope, 'watcherPid', child.pid)
	} catch {
		// A watcher that will not start reports nothing, which the Stop gate
		// surfaces as an unknown verdict rather than silently passing.
	}
}

function stopWatcher(sessionId: string, scope: string): void {
	const pid = readScalar(sessionId, scope, 'watcherPid')
	if (!alive(pid)) return
	try {
		// Negative pid kills the detached child's whole process group; a test
		// runner in watch mode spawns workers that would otherwise survive it.
		process.kill(-(pid as number), 'SIGTERM')
	} catch {
		try {
			process.kill(pid as number, 'SIGTERM')
		} catch {
			// Already gone.
		}
	}
	writeScalar(sessionId, scope, 'watcherPid', undefined)
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

function editedFiles(sessionId: string, scope: string, cwd: string): string[] {
	return remembered(sessionId, scope, 'edited').filter((file) => existsSync(path.resolve(cwd, file)))
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

	const trigger = payload.hook_event_name as Trigger
	if (!TRIGGERS.has(trigger)) return

	const cwd = payload.cwd
	if (!cwd) return

	const config = loadConfig(cwd)
	const sessionId = payload.session_id ?? 'unknown-session'
	const scope = payload.teammate_name ?? '__lead__'

	// The session is over; nothing is owed but cleanup. A detached watcher
	// outlives its session otherwise, and the next one starts another.
	if (trigger === 'SessionEnd') {
		stopWatcher(sessionId, scope)
		return
	}

	if (trigger === 'PostToolUse') {
		const file = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path
		if (!file) return

		// Recorded before anything is run, and whether or not there is anything
		// to run: this is the only moment the edited path exists, and a project
		// may configure a {files} lint without configuring format at all.
		if (tracksEditedFiles(config)) remember(sessionId, scope, 'edited', [file])

		// Stamped before the watcher starts, so a report produced by the run this
		// edit triggers still counts as newer than the edit. Stamping afterwards
		// would race the watcher and read its fresh report as stale.
		if (tracksEditTime(config)) writeScalar(sessionId, scope, 'editedAt', Date.now())

		// Lazily started: a session that never edits code never pays for a
		// watcher, and one that does pays once.
		if (config.test) {
			startWatcher(watchCommand(config.test.watch, statusPath(sessionId, scope)), cwd, sessionId, scope)
		}

		// Formatting is fire-and-forget: the edit already happened, so there is
		// nothing to block, and a formatter's own failure is not the agent's problem.
		const [format] = commandsFor(trigger, config)
		if (format) run(formatCommand(format.command, file), cwd)
		return
	}

	const commands = scopeCommands(commandsFor(trigger, config), editedFiles(sessionId, scope, cwd), cwd)

	const results: CommandResult[] = commands.map(({ name, command }) => ({ name, command, ...run(command, cwd) }))

	// The watcher has been running all along; this reads what it concluded
	// rather than starting a suite of its own.
	if (config.test) {
		const { status, statusMtime } = readReport(statusPath(sessionId, scope))
		const verdict = testVerdict({
			status,
			statusMtime,
			lastEditAt: readScalar(sessionId, scope, 'editedAt') ?? null,
			watcherAlive: alive(readScalar(sessionId, scope, 'watcherPid')),
		})
		const result = verdictAsResult(verdict, config.test.watch)
		if (result) results.push(result)
	}

	if (results.length === 0) return

	const decision = decide({
		trigger,
		results,
		alreadyBlocked: remembered(sessionId, scope, 'blocked'),
		stopHookActive: payload.stop_hook_active === true,
	})

	if (!decision.block) return

	remember(sessionId, scope, 'blocked', [failureSignature(results)])
	process.stdout.write(JSON.stringify({ decision: 'block', reason: decision.reason }))
}

try {
	main()
} catch {
	process.exitCode = 0
}
