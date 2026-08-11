#!/usr/bin/env node
/**
 * PreToolUse hook: deny an Edit/Write whose target lies outside the globs the
 * acting agent type owns.
 *
 * Scope, deliberately narrow: this covers tool-level edits only. A teammate
 * with Bash can still reach any file through `sed -i`, a redirect, or
 * `git checkout`, and no Edit|Write hook closes that. See the README section
 * "What this does and does not enforce".
 *
 * Every failure path allows the write. A hook that cannot parse its input,
 * locate its map, or resolve its own module must not brick the session — an
 * unenforced write is recoverable, a session that cannot write anything is not.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { decide, type OwnershipMap } from './ownership.ts'

interface HookPayload {
	/** Present for teammates, absent for the lead. See ownership.ts. */
	agent_type?: string
	cwd?: string
	tool_input?: {
		file_path?: string
		notebook_path?: string
	}
}

function readStdin(): string {
	try {
		return readFileSync(0, 'utf8')
	} catch {
		return ''
	}
}

/**
 * A project override replaces the shipped default outright rather than merging,
 * so what a role owns is always readable from exactly one file.
 */
function loadMap(cwd: string | undefined): OwnershipMap | undefined {
	const here = path.dirname(fileURLToPath(import.meta.url))

	const candidates = [
		cwd ? path.join(cwd, '.claude', 'config', 'agent-team', 'ownership.json') : undefined,
		path.join(here, '..', 'config', 'ownership.json'),
	]

	for (const candidate of candidates) {
		if (!candidate) continue
		try {
			return JSON.parse(readFileSync(candidate, 'utf8')) as OwnershipMap
		} catch {
			// Missing or unparseable: fall through to the next candidate, and to
			// allowing the write if none resolve.
		}
	}

	return undefined
}

function main(): void {
	const raw = readStdin()
	if (!raw.trim()) return

	let payload: HookPayload
	try {
		payload = JSON.parse(raw) as HookPayload
	} catch {
		return
	}

	const map = loadMap(payload.cwd)
	if (!map) return

	const decision = decide({
		agentType: payload.agent_type,
		filePath: payload.tool_input?.file_path ?? payload.tool_input?.notebook_path,
		cwd: payload.cwd,
		map,
	})

	if (decision.allow) return

	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason: decision.reason,
			},
		}),
	)
}

try {
	main()
} catch {
	// Fail open, loudly enough to debug but never blocking.
	process.exitCode = 0
}
