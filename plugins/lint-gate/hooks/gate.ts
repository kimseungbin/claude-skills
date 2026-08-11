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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { commandsFor, decide, failureSignature, formatCommand, resolveConfig, type CommandResult, type Trigger } from './core.ts'

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
 * Blocked-signature memory, per session and per agent.
 *
 * Scoped by teammate because two agents settling at different times must not
 * silence each other's failures.
 */
function statePath(sessionId: string): string {
	return path.join(os.homedir(), '.claude', 'lint-gate', `${sessionId}.json`)
}

function readBlocked(sessionId: string, scope: string): string[] {
	try {
		const state = JSON.parse(readFileSync(statePath(sessionId), 'utf8')) as Record<string, string[]>
		return Array.isArray(state?.[scope]) ? state[scope] : []
	} catch {
		return []
	}
}

function rememberBlocked(sessionId: string, scope: string, signature: string): void {
	try {
		const file = statePath(sessionId)
		mkdirSync(path.dirname(file), { recursive: true })

		let state: Record<string, string[]> = {}
		try {
			state = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>
		} catch {
			// First write for this session.
		}

		state[scope] = [...(Array.isArray(state[scope]) ? state[scope] : []), signature]
		writeFileSync(file, JSON.stringify(state))
	} catch {
		// If the memory cannot be written the gate simply repeats itself once
		// more; that is better than failing the hook.
	}
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
	const commands = commandsFor(trigger, config)
	if (commands.length === 0) return

	// Formatting is fire-and-forget: the edit already happened, so there is
	// nothing to block, and a formatter's own failure is not the agent's problem.
	if (trigger === 'PostToolUse') {
		const file = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path
		if (!file) return
		run(formatCommand(commands[0].command, file), cwd)
		return
	}

	const results: CommandResult[] = commands.map(({ name, command }) => ({ name, command, ...run(command, cwd) }))

	const sessionId = payload.session_id ?? 'unknown-session'
	const scope = payload.teammate_name ?? '__lead__'

	const decision = decide({
		trigger,
		results,
		alreadyBlocked: readBlocked(sessionId, scope),
		stopHookActive: payload.stop_hook_active === true,
	})

	if (!decision.block) return

	rememberBlocked(sessionId, scope, failureSignature(results))
	process.stdout.write(JSON.stringify({ decision: 'block', reason: decision.reason }))
}

try {
	main()
} catch {
	process.exitCode = 0
}
