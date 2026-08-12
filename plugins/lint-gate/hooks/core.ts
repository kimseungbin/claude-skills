/**
 * Pure decision layer for lint-gate.
 *
 * No filesystem, no process spawning, no I/O — the runner wrappers do that and
 * hand results here. Kept separate because the interesting behavior is all
 * policy: which commands belong to which moment, when a failure is worth
 * interrupting an agent for, and when repeating yourself would only loop.
 */

import { createHash } from 'node:crypto'

export type Trigger = 'PostToolUse' | 'Stop' | 'TeammateIdle'

/** Project commands. Absent means "not configured", never "use a default". */
export interface GateConfig {
	format?: string
	lint?: string
	typecheck?: string
}

export interface CommandResult {
	name: string
	command: string
	ok: boolean
	output: string
}

export type Decision = { block: false } | { block: true; reason: string }

const CONFIG_KEYS = ['format', 'lint', 'typecheck'] as const

const TRIGGERS: readonly Trigger[] = ['PostToolUse', 'Stop', 'TeammateIdle']

/**
 * A malformed config degrades to "run nothing" rather than throwing. This runs
 * inside a hook on every edit; a config typo must not be able to break a
 * session.
 */
export function resolveConfig(raw: unknown): GateConfig {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

	const source = raw as Record<string, unknown>
	const config: GateConfig = {}

	for (const key of CONFIG_KEYS) {
		const value = source[key]
		if (typeof value === 'string' && value.trim() !== '') config[key] = value
	}

	return config
}

/**
 * Formatting is per-edit; linting and typechecking are not.
 *
 * An intermediate edit is legitimately invalid — an import added in one edit and
 * used in the next reads as an unused import in between — so semantic checks
 * only run once an agent believes it has finished. Formatting is a pure
 * syntactic transform and is safe on anything that parses.
 */
export function commandsFor(trigger: Trigger, config: GateConfig): Array<{ name: string; command: string }> {
	const wanted: Array<keyof GateConfig> = trigger === 'PostToolUse' ? ['format'] : ['lint', 'typecheck']

	// Blank is dropped here as well as in resolveConfig. GateConfig cannot
	// express "non-blank", so trusting a caller to have resolved it is an
	// invariant held only by convention — and an empty command reaching the
	// runner fails, which would produce a block from a config typo.
	return wanted
		.filter((name) => typeof config[name] === 'string' && (config[name] as string).trim() !== '')
		.map((name) => ({ name, command: config[name] as string }))
}

/**
 * `{file}` is the one edited path, for `format`. `{files}` is every path edited
 * this session, for `lint`.
 *
 * Neither token is a substring of the other — in `{files}` the `s` sits where
 * `{file}`'s closing brace would be — so filling order is not the hazard.
 * Filling in two *passes* is: an edited path may itself contain the literal
 * `{file}`, and a later pass would treat that as a placeholder and substitute
 * into the middle of the quoted string it had just inserted, closing the quotes
 * and leaving the rest of the path as live shell text. So both tokens are
 * consumed in one pass, through a replacement callback rather than a replacement
 * string — the callback form also stops a `$&` in a path from being given its
 * regex meaning.
 */
const FILE_TOKEN = '{file}'
const FILES_TOKEN = '{files}'
const EITHER_TOKEN = /\{files?\}/g

/** POSIX single-quote escaping: close, escape, reopen. */
function shellQuote(value: string): string {
	return `'${value.split("'").join(`'\\''`)}'`
}

function fill(base: string, token: string, replacement: string): string {
	return base.split(token).join(replacement)
}

/** Whether a command asks to be scoped to the files edited this session. */
export function usesEditedFiles(command: string): boolean {
	return command.includes(FILES_TOKEN)
}

/**
 * Whether anything will consume a record of the edited paths.
 *
 * Asked on every edit, so that accumulating paths costs a project nothing unless
 * one of its own check commands asked to be scoped by them. Derived from the
 * Stop-time set rather than from the raw config, so it cannot answer yes for a
 * command that would never run.
 */
export function tracksEditedFiles(config: GateConfig): boolean {
	return commandsFor('Stop', config).some(({ command }) => usesEditedFiles(command))
}

/**
 * Build the per-file format invocation.
 *
 * The path is always shell-quoted. This is the one place in the module where a
 * mistake becomes a shell injection rather than a wrong answer, since the path
 * originates in a tool payload.
 */
export function formatCommand(base: string, filePath: string): string {
	const quoted = shellQuote(filePath)

	// Either token is filled with the single edited path. A format command
	// written with {files} is honored rather than corrected: it runs per edit, so
	// the list it would get is that one file anyway.
	if (base.includes(FILE_TOKEN) || base.includes(FILES_TOKEN)) return base.replace(EITHER_TOKEN, () => quoted)

	return `${base} ${quoted}`
}

/**
 * Narrow Stop-time commands to the files edited this session.
 *
 * A project-wide `lint` on a repo with any pre-existing backlog fails at the end
 * of every task, reporting files the agent never opened — which teaches the
 * agent to discount the gate. `{files}` lets the project ask for the narrower
 * question instead.
 *
 * An empty list drops the command rather than running it bare. A linter with no
 * path argument silently checks nothing under some configs and errors under
 * others; neither is a useful gate result, and nothing was edited, so nothing is
 * owed. Commands without the placeholder pass through untouched, so a project
 * that never asked for scoping keeps today's project-wide behavior.
 */
export function scopeCommands(
	commands: Array<{ name: string; command: string }>,
	editedFiles: string[],
): Array<{ name: string; command: string }> {
	// Deduped here rather than only at the storage layer: this is the pure,
	// tested layer, and handing the same path to a linter twice is the kind of
	// thing a caller should not have to have gotten right.
	const paths = [...new Set((Array.isArray(editedFiles) ? editedFiles : []).filter((file) => typeof file === 'string' && file !== ''))]
	const joined = paths.map(shellQuote).join(' ')

	return (Array.isArray(commands) ? commands : [])
		.filter(({ command }) => !usesEditedFiles(command) || paths.length > 0)
		.map(({ name, command }) => (usesEditedFiles(command) ? { name, command: fill(command, FILES_TOKEN, joined) } : { name, command }))
}

/**
 * Stable identity for a set of failures, so the same unfixable problem is not
 * reported twice.
 *
 * Sorted, so array order cannot change the signature; only failures contribute,
 * so a newly passing command changes it. The command string is part of the
 * identity too — if the project changed what `lint` runs, that is a different
 * check and the agent has not been told about it yet, even if the output
 * happens to match. Erring toward re-blocking is the safe direction here.
 */
export function failureSignature(results: CommandResult[]): string {
	const failures = (Array.isArray(results) ? results : [])
		.filter((result) => result && !result.ok)
		.map((result) => ({
			name: String(result.name),
			command: String(result.command ?? ''),
			output: String(result.output ?? '').trim(),
		}))
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

	return createHash('sha256').update(JSON.stringify(failures)).digest('hex')
}

function buildReason(failures: CommandResult[]): string {
	const blocks = failures
		.map((failure) => `${failure.name} — \`${failure.command}\`\n\n${failure.output.trim()}`)
		.join('\n\n')

	return (
		`lint-gate: ${failures.length === 1 ? 'a check' : `${failures.length} checks`} failed.\n\n` +
		`${blocks}\n\n` +
		`Fix these before finishing. If a failure is not yours to fix, say so explicitly rather than leaving it unmentioned.`
	)
}

/**
 * Both guards exist to stop the same thing: telling an agent to fix something it
 * has already been told about, forever.
 */
export function decide({
	trigger,
	results,
	alreadyBlocked,
	stopHookActive,
}: {
	trigger: Trigger
	results: CommandResult[]
	alreadyBlocked: string[]
	stopHookActive?: boolean
}): Decision {
	// This is the only function here that can block, so an input it does not
	// recognize must not produce one. The decision is otherwise independent of
	// which trigger fired.
	if (!TRIGGERS.includes(trigger)) return { block: false }

	const failures = (Array.isArray(results) ? results : []).filter((result) => result && !result.ok)
	if (failures.length === 0) return { block: false }

	// A Stop hook that already blocked this turn must not block again.
	if (stopHookActive) return { block: false }

	// Idle fires on every settle, so without this the same failure re-blocks
	// indefinitely whenever the agent cannot fix it.
	const signature = failureSignature(results)
	if (Array.isArray(alreadyBlocked) && alreadyBlocked.includes(signature)) return { block: false }

	return { block: true, reason: buildReason(failures) }
}
