#!/usr/bin/env node
/**
 * lint-gate runner. One entry point for all three triggers; the payload's
 * `hook_event_name` decides which.
 *
 * Fails open everywhere. This runs on every edit and every stop — a gate that
 * cannot read its config, cannot spawn, or throws must let the work through.
 * A missed lint is recoverable; a session that cannot finish a turn is not.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import {
	commandsFor,
	decide,
	failureSignature,
	formatCommand,
	resolveConfig,
	scopeCommands,
	tracksEditedFiles,
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

const TRIGGERS = new Set<Trigger>(['PostToolUse', 'Stop', 'TeammateIdle'])

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

	if (trigger === 'PostToolUse') {
		const file = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path
		if (!file) return

		// Recorded before anything is run, and whether or not there is anything
		// to run: this is the only moment the edited path exists, and a project
		// may configure a {files} lint without configuring format at all.
		if (tracksEditedFiles(config)) remember(sessionId, scope, 'edited', [file])

		// Formatting is fire-and-forget: the edit already happened, so there is
		// nothing to block, and a formatter's own failure is not the agent's problem.
		const [format] = commandsFor(trigger, config)
		if (format) run(formatCommand(format.command, file), cwd)
		return
	}

	const commands = scopeCommands(commandsFor(trigger, config), editedFiles(sessionId, scope, cwd))
	if (commands.length === 0) return

	const results: CommandResult[] = commands.map(({ name, command }) => ({ name, command, ...run(command, cwd) }))

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
