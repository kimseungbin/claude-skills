/**
 * Pure decision layer for lint-gate.
 *
 * No filesystem, no process spawning, no I/O — the runner wrappers do that and
 * hand results here. Kept separate because the interesting behavior is all
 * policy: which commands belong to which moment, when a failure is worth
 * interrupting an agent for, and when repeating yourself would only loop.
 */

import { createHash } from 'node:crypto'
import path from 'node:path'

export type Trigger = 'PostToolUse' | 'Stop' | 'TeammateIdle' | 'SessionEnd'

/**
 * Tests are watched, not run.
 *
 * Every other check is a command the gate invokes at Stop. A test suite is the
 * one that cannot afford it — running it per turn costs minutes, and the agent
 * waits. A watcher already re-runs the affected tests on every save, so the
 * gate's job is to read the verdict it produced rather than produce its own.
 *
 * `{status}` is where the watcher must write a JSON report. The gate owns that
 * path; a command without the token is dropped, because there would be nothing
 * to read and a gate that cannot see a verdict is worse than no gate.
 */
export interface TestWatchConfig {
	watch: string
}

/** Project commands. Absent means "not configured", never "use a default". */
export interface GateConfig {
	format?: string
	lint?: string
	typecheck?: string
	test?: TestWatchConfig
}

export interface CommandResult {
	name: string
	command: string
	ok: boolean
	output: string
}

export type Decision = { block: false } | { block: true; reason: string }

const CONFIG_KEYS = ['format', 'lint', 'typecheck'] as const

const TRIGGERS: readonly Trigger[] = ['PostToolUse', 'Stop', 'TeammateIdle', 'SessionEnd']

/** Where the watcher is told to write its report. */
export const STATUS_TOKEN = '{status}'

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

	const test = source.test
	if (test && typeof test === 'object' && !Array.isArray(test)) {
		const watch = (test as Record<string, unknown>).watch
		// The token is required rather than defaulted. Appending an output flag
		// ourselves would mean guessing the runner's CLI, and guessing wrong
		// produces a watcher that runs but never reports — which reads at Stop as
		// a watcher that is merely slow, forever.
		if (typeof watch === 'string' && watch.includes(STATUS_TOKEN) && watch.trim() !== '') {
			config.test = { watch }
		}
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
 * Whether an edited path lies inside the project.
 *
 * Lexical, not `realpath`: this layer does no I/O, and the question is which
 * invocation can make sense of the path rather than whether the path is
 * trustworthy. A symlink pointing out of the tree is therefore treated as
 * inside — the gate is a correctness tool, not a sandbox boundary.
 *
 * Relative entries are resolved against the root first, so they are judged the
 * same way the linter will read them. `..` is compared against a full segment,
 * because a file legitimately named `..rc.ts` shares the prefix but not the
 * meaning.
 */
function withinRoot(root: string, filePath: string): boolean {
	const relative = path.relative(root, path.resolve(root, filePath))

	// An absolute result means there is no path between the two at all — a
	// different Windows drive.
	if (relative === '' || path.isAbsolute(relative)) return false

	return relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

/**
 * Narrow Stop-time commands to the files edited this session, bounded to the
 * project.
 *
 * A project-wide `lint` on a repo with any pre-existing backlog fails at the end
 * of every task, reporting files the agent never opened — which teaches the
 * agent to discount the gate. `{files}` lets the project ask for the narrower
 * question instead.
 *
 * Paths outside `root` are dropped. Claude Code writes outside the project as a
 * matter of course — plan mode lands a file under `~/.claude/plans`, memory
 * under `~/.claude/projects` — while every command a gate can be configured with
 * resolves from the project cwd. A tool that discovers its config per file
 * (eslint, stylelint, tsc given a path list) fails the *entire* invocation on one
 * such path, so a single plan file would otherwise take the in-project files down
 * with it: a failure nothing in the repo can fix, masking the check it was asked
 * to run. Dropping them is not a loss, because no project command could have
 * checked them anyway.
 *
 * An empty list drops the command rather than running it bare. A linter with no
 * path argument silently checks nothing under some configs and errors under
 * others; neither is a useful gate result, and nothing was edited, so nothing is
 * owed. This covers a session whose every edit was out of project, which then
 * runs nothing rather than something wrong. Commands without the placeholder pass
 * through untouched, so a project that never asked for scoping keeps today's
 * project-wide behavior.
 */
export function scopeCommands(
	commands: Array<{ name: string; command: string }>,
	editedFiles: string[],
	root: string,
): Array<{ name: string; command: string }> {
	// An unusable root cannot be resolved against, so nothing can be shown to be
	// in project and every scoped command drops. That direction is deliberate: the
	// alternative is passing paths through unbounded, which is the failure this
	// argument exists to prevent.
	const bounded = typeof root === 'string' && root !== ''

	// Deduped here rather than only at the storage layer: this is the pure,
	// tested layer, and handing the same path to a linter twice is the kind of
	// thing a caller should not have to have gotten right.
	const paths = [
		...new Set(
			(Array.isArray(editedFiles) ? editedFiles : [])
				.filter((file) => typeof file === 'string' && file !== '')
				.filter((file) => bounded && withinRoot(root, file)),
		),
	]
	const joined = paths.map(shellQuote).join(' ')

	return (Array.isArray(commands) ? commands : [])
		.filter(({ command }) => !usesEditedFiles(command) || paths.length > 0)
		.map(({ name, command }) => (usesEditedFiles(command) ? { name, command: fill(command, FILES_TOKEN, joined) } : { name, command }))
}

/**
 * Fill the watcher command with the report path the gate will read.
 *
 * Quoted like every other path this module builds: it is composed from a home
 * directory and a session id, and one of those comes from the payload.
 */
export function watchCommand(base: string, statusPath: string): string {
	return fill(base, STATUS_TOKEN, shellQuote(statusPath))
}

/**
 * Whether a session needs the edited-file record kept.
 *
 * Test watching needs it for a different reason than `{files}` does: not to
 * narrow a command, but to know when the code last changed, so a verdict older
 * than the last edit can be recognised as stale.
 */
export function tracksEditTime(config: GateConfig): boolean {
	return config.test !== undefined
}

export type TestVerdict =
	| { state: 'pass' }
	| { state: 'fail'; detail: string }
	| { state: 'unknown'; reason: string }

/**
 * Read a watcher's report, and decide whether it can be believed.
 *
 * The failure modes here all point the same way — a report that is missing,
 * frozen, or half-written looks exactly like a report that says "passing" if
 * you only check the verdict. So freshness is settled before the verdict is
 * consulted, and anything unresolved is `unknown` rather than `pass`.
 *
 * Freshness is the file's mtime, deliberately not the `startTime` inside the
 * report. Vitest's JSON reporter keeps `startTime` at the *first* run for the
 * life of a watch process — it rewrites `success` on every re-run and leaves
 * that field frozen. A gate comparing it against the last edit would call every
 * verdict stale forever.
 *
 * A watcher that has died is not itself a blocking condition. If its last
 * report still postdates the last edit, that verdict is true — the tests did
 * pass against this code. Liveness only changes what the message says, and
 * whether the next edit can be checked at all.
 */
export function testVerdict({
	status,
	statusMtime,
	lastEditAt,
	watcherAlive,
}: {
	status: unknown
	statusMtime: number | null
	lastEditAt: number | null
	watcherAlive: boolean
}): TestVerdict {
	if (statusMtime === null) {
		return {
			state: 'unknown',
			reason: watcherAlive
				? 'the test watcher has not produced a report yet'
				: 'the test watcher is not running and has produced no report',
		}
	}

	if (lastEditAt !== null && statusMtime < lastEditAt) {
		return {
			state: 'unknown',
			reason: watcherAlive
				? 'the test report predates the most recent edit — the watcher has not finished re-running'
				: 'the test report predates the most recent edit and the watcher is no longer running',
		}
	}

	if (!status || typeof status !== 'object' || Array.isArray(status)) {
		return { state: 'unknown', reason: 'the test report could not be read as JSON' }
	}

	const report = status as Record<string, unknown>
	if (typeof report.success !== 'boolean') {
		return { state: 'unknown', reason: 'the test report carries no `success` field' }
	}

	if (report.success) return { state: 'pass' }

	const failed = typeof report.numFailedTests === 'number' ? report.numFailedTests : null
	const total = typeof report.numTotalTests === 'number' ? report.numTotalTests : null
	if (failed === null) return { state: 'fail', detail: 'Tests are failing.' }

	// Pluralised on the governing number: "1 of 9 tests", but "1 test".
	if (total === null) return { state: 'fail', detail: `${failed} test${failed === 1 ? '' : 's'} failing.` }
	return { state: 'fail', detail: `${failed} of ${total} test${total === 1 ? '' : 's'} failing.` }
}

/**
 * Fold a verdict into the same shape as a command result, so blocking,
 * deduplication and the reason text all work on it unchanged.
 *
 * `unknown` blocks like a failure does. That is the whole point of the state:
 * "I could not tell whether the tests pass" is not permission to finish, and
 * the alternative — treating it as passing — is the failure mode that makes a
 * dead watcher invisible.
 *
 * It is still subject to the existing already-blocked guard, so a project whose
 * watcher never reports is told once and then left alone rather than trapped.
 */
export function verdictAsResult(verdict: TestVerdict, command: string): CommandResult | null {
	if (verdict.state === 'pass') return null

	return {
		name: 'test',
		command,
		ok: false,
		output:
			verdict.state === 'fail'
				? verdict.detail
				: `No usable verdict — ${verdict.reason}.`,
	}
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
