/**
 * Pure decision layer for lint-gate.
 *
 * No filesystem, no process spawning, no I/O — the runner wrappers do that and
 * hand results here. Kept separate because the interesting behavior is all
 * policy: which checks a session owes, how a check's result becomes pass or
 * fail, when a failure is worth interrupting an agent for, and when repeating
 * yourself would only loop.
 */

import { createHash } from 'node:crypto'
import path from 'node:path'

import { isParser, type Diagnostic, type ParseResult, type ParserName } from './parsers.ts'

export type Trigger = 'PostToolUse' | 'Stop' | 'TeammateIdle' | 'SessionEnd'

/**
 * How a check's result can be attributed to the session.
 *
 *   files    The command is handed the session's edited files through `{files}`,
 *            so its whole output belongs to the session. Linters and formatters
 *            in check mode.
 *   program  The command checks a whole build unit — a typechecker needs every
 *            file to resolve types, and handing it a path list changes what it
 *            checks. Judged on its exit code, or, with `report: "edited"`, on
 *            parsed diagnostics located in files the session edited.
 *   unit     The command or watcher reports a verdict with no file locations —
 *            tests, builds, `cdk synth`. Only its exit code or verdict counts.
 */
export type Scope = 'files' | 'program' | 'unit'

export type Report = 'all' | 'edited'

export interface Check {
	name: string
	scope: Scope
	/** Exactly one of `command` and `watch` is set; `watch` only on a `unit` check. */
	command?: string
	watch?: string
	/**
	 * Globs relative to the checkout root; the check is owed only if an edited path
	 * matches one. Null when the config set none: then any edit in the checkout
	 * makes the check owed, dotfiles included.
	 */
	when: string[] | null
	/** Run directory relative to the checkout root; `''` is the root itself. */
	cwd: string
	report: Report
	/** Set exactly when `report` is `edited`. */
	parse?: ParserName
	timeoutSec: number
}

/**
 * Project commands. Absent means "not configured", never "use a default".
 *
 * `format` is the one per-edit step and stays a single command: it runs on one
 * file, and a project that needs per-package formatting has a formatter that
 * already resolves it. Everything else is a named check, run in list order once
 * an agent believes it is finished.
 */
export interface GateConfig {
	format?: string
	checks: Check[]
}

export interface ResolvedConfig {
	config: GateConfig
	/** User-facing descriptions of what in the file was ignored, and why. */
	problems: string[]
}

export const SCOPES: readonly Scope[] = ['files', 'program', 'unit']

export const DEFAULT_TIMEOUT_SEC = 180

/** Where the watcher is told to write its report. */
export const STATUS_TOKEN = '{status}'

const FILE_TOKEN = '{file}'
const FILES_TOKEN = '{files}'
const EITHER_TOKEN = /\{files?\}/g

/** Keys of the config shape before `checks`; named so the warning can say how to migrate. */
const RETIRED_KEYS = new Set(['lint', 'typecheck', 'test'])

const CHECK_FIELDS = new Set(['name', 'scope', 'command', 'watch', 'when', 'cwd', 'report', 'parse', 'timeoutSec'])

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

/**
 * A malformed config degrades rather than throws: this runs inside a hook on
 * every edit, and a config typo must not be able to break a session.
 *
 * A malformed check is dropped whole and reported, never repaired into
 * something broader. Running it some other way than the project wrote — without
 * its `when`, without its scope — would run a check the project did not ask for,
 * and block the agent over a config typo.
 */
export function resolveConfig(raw: unknown): ResolvedConfig {
	const problems: string[] = []
	const config: GateConfig = { checks: [] }

	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { config, problems: ['the config is not a JSON object, so no checks run'] }
	}

	const source = raw as Record<string, unknown>

	for (const key of Object.keys(source)) {
		if (key === 'format' || key === 'checks' || key === '$comment') continue
		problems.push(
			RETIRED_KEYS.has(key)
				? `\`${key}\` is no longer a lint-gate key and is ignored — run /lint-setup to move it into \`checks\``
				: `\`${key}\` is not a lint-gate key and is ignored`,
		)
	}

	if (source.format !== undefined) {
		if (isCommand(source.format)) config.format = source.format
		else problems.push('`format` must be a non-blank command string, so nothing is formatted')
	}

	if (source.checks !== undefined) {
		if (!Array.isArray(source.checks)) {
			problems.push('`checks` must be a list, so no checks run')
		} else {
			const names = new Set<string>()
			source.checks.forEach((entry, index) => {
				const resolved = resolveCheck(entry, index)
				if (typeof resolved === 'string') {
					problems.push(resolved)
				} else if (names.has(resolved.name)) {
					problems.push(`checks[${index}] repeats the name "${resolved.name}" and is ignored — names must be unique`)
				} else {
					names.add(resolved.name)
					config.checks.push(resolved)
				}
			})
		}
	}

	return { config, problems }
}

function resolveCheck(entry: unknown, index: number): Check | string {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `checks[${index}] is not an object and is ignored`

	const source = entry as Record<string, unknown>
	const label = isCommand(source.name) ? `checks[${index}] ("${source.name}")` : `checks[${index}]`
	const dropped = (why: string) => `${label} ${why}, so the check is ignored`

	if (!isCommand(source.name)) return dropped('has no name')
	const unknown = Object.keys(source).filter((key) => !CHECK_FIELDS.has(key))
	if (unknown.length > 0) return dropped(`has unknown field${unknown.length === 1 ? '' : 's'} ${unknown.map((key) => `\`${key}\``).join(', ')}`)

	if (!SCOPES.includes(source.scope as Scope)) return dropped('needs `scope` set to "files", "program" or "unit"')
	const scope = source.scope as Scope

	const hasCommand = source.command !== undefined
	const hasWatch = source.watch !== undefined
	if (hasCommand === hasWatch) return dropped('needs exactly one of `command` and `watch`')
	if (hasCommand && !isCommand(source.command)) return dropped('has a blank or non-string `command`')
	if (hasWatch && !isCommand(source.watch)) return dropped('has a blank or non-string `watch`')

	if (hasWatch) {
		if (scope !== 'unit') return dropped('uses `watch`, which only a "unit" check can')
		// The token is required rather than defaulted. Appending an output flag
		// ourselves would mean guessing the runner's CLI, and guessing wrong
		// produces a watcher that runs but never reports — which reads at Stop as
		// a watcher that is merely slow, forever.
		if (!(source.watch as string).includes(STATUS_TOKEN)) return dropped('has a `watch` command without {status}, so there would be no verdict to read')
	}

	const command = (hasCommand ? source.command : source.watch) as string
	if (command.includes(FILE_TOKEN)) return dropped('uses {file}, which belongs to `format`; a check takes {files}')
	if (hasCommand && command.includes(STATUS_TOKEN)) return dropped('uses {status} outside a `watch` command')
	if (scope === 'files' && !command.includes(FILES_TOKEN)) return dropped('has scope "files" but no {files} in its command')
	if (scope !== 'files' && command.includes(FILES_TOKEN)) {
		return dropped(`has scope "${scope}" but puts {files} in its command — a ${scope} check runs whole`)
	}

	const when = resolveWhen(source.when)
	if (when === undefined) return dropped('has a `when` that is not a non-blank glob or a non-empty list of them')

	const cwd = resolveCwd(source.cwd)
	if (cwd === null) return dropped('has a `cwd` that is not a relative path inside the checkout')

	let report: Report = 'all'
	if (source.report !== undefined) {
		if (source.report !== 'all' && source.report !== 'edited') return dropped('has a `report` other than "all" or "edited"')
		report = source.report
	}
	if (report === 'edited' && scope !== 'program') return dropped('uses `report: "edited"`, which only a "program" check can')

	let parse: ParserName | undefined
	if (report === 'edited') {
		if (!isParser(source.parse)) return dropped('uses `report: "edited"` without a known `parse` (tsc, mypy, mypy-json, pyright-json, svelte-check-machine)')
		parse = source.parse
	} else if (source.parse !== undefined) {
		return dropped('sets `parse` without `report: "edited"`')
	}

	let timeoutSec = DEFAULT_TIMEOUT_SEC
	if (source.timeoutSec !== undefined) {
		if (typeof source.timeoutSec !== 'number' || !Number.isFinite(source.timeoutSec) || source.timeoutSec <= 0) {
			return dropped('has a `timeoutSec` that is not a positive number')
		}
		timeoutSec = source.timeoutSec
	}

	const check: Check = { name: source.name, scope, when, cwd, report, timeoutSec }
	if (hasCommand) check.command = command
	else check.watch = command
	if (parse !== undefined) check.parse = parse
	return check
}

function isCommand(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== ''
}

function resolveWhen(value: unknown): string[] | null | undefined {
	if (value === undefined) return null
	if (isCommand(value)) return [value]
	if (Array.isArray(value) && value.length > 0 && value.every(isCommand)) return value as string[]
	return undefined
}

function resolveCwd(value: unknown): string | null {
	if (value === undefined) return ''
	if (typeof value !== 'string') return null
	const normalized = path.posix.normalize(value.split(path.sep).join('/'))
	if (path.posix.isAbsolute(normalized)) return null
	if (normalized === '.' || normalized === './') return ''
	if (normalized === '..' || normalized.startsWith('../')) return null
	return normalized.replace(/\/$/, '')
}

// ---------------------------------------------------------------------------
// paths
// ---------------------------------------------------------------------------

/** POSIX single-quote escaping: close, escape, reopen. */
export function shellQuote(value: string): string {
	return `'${value.split("'").join(`'\\''`)}'`
}

function fill(base: string, token: string, replacement: string): string {
	return base.split(token).join(replacement)
}

/**
 * Whether a path lies inside a root.
 *
 * Lexical, not `realpath`: this layer does no I/O. `..` is compared against a
 * full segment, because a file legitimately named `..rc.ts` shares the prefix but
 * not the meaning. The root itself is not inside — it is not a file the gate was
 * asked about.
 */
export function withinRoot(root: string, filePath: string): boolean {
	if (typeof root !== 'string' || root === '' || typeof filePath !== 'string' || filePath === '') return false
	const relative = path.relative(root, path.resolve(root, filePath))

	// An absolute result means there is no path between the two at all — a
	// different Windows drive.
	if (relative === '' || path.isAbsolute(relative)) return false

	return relative !== '..' && !relative.startsWith(`..${path.sep}`)
}

/** Root-relative with `/` separators, so a glob is written the same way on every platform. */
export function rootRelative(root: string, filePath: string): string {
	return path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/')
}

/**
 * Whether a root-relative path matches any of a check's globs. Standard glob
 * semantics, so a `*` or `**` segment does not match a dotfile unless the glob
 * names the dot. No `when` at all matches every path.
 */
export function matchesWhen(relative: string, when: string[] | null): boolean {
	return when === null || when.some((glob) => path.posix.matchesGlob(relative, glob))
}

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------

/**
 * Build the per-file format invocation.
 *
 * The path is always shell-quoted. This is one of two places in the module where
 * a mistake becomes a shell injection rather than a wrong answer, since the path
 * originates in a tool payload.
 *
 * Both tokens are consumed in one pass, through a replacement callback. Filling
 * them in two passes would let an edited path containing the literal `{file}` be
 * substituted again, into the middle of the quoted string just inserted, leaving
 * the rest of the path as live shell text; and a replacement string rather than a
 * callback would give a `$&` in a path its regex meaning.
 */
export function formatCommand(base: string, filePath: string): string {
	const quoted = shellQuote(filePath)

	// A format command written with {files} is honored rather than corrected: it
	// runs per edit, so the list it would get is that one file anyway.
	if (base.includes(FILE_TOKEN) || base.includes(FILES_TOKEN)) return base.replace(EITHER_TOKEN, () => quoted)

	return `${base} ${quoted}`
}

/**
 * Fill the watcher command with the report path the gate will read. Quoted like
 * every other path this module builds: it is composed from a home directory and
 * a session id, and one of those comes from the payload.
 */
export function watchCommand(base: string, statusPath: string): string {
	return fill(base, STATUS_TOKEN, shellQuote(statusPath))
}

// ---------------------------------------------------------------------------
// planning
// ---------------------------------------------------------------------------

/** The session's edits inside one checkout, with the root the checks resolve against. */
export interface RootEdits {
	root: string
	/** Absolute paths, each inside `root`, deduped. */
	files: string[]
}

export interface PlannedCheck {
	check: Check
	root: string
	/** Absolute run directory. */
	runDir: string
	/** The edited files that made this check owed, absolute. */
	matched: string[]
	/** Ready to run; for a watch check, the unfilled watcher command. */
	command: string
}

/**
 * Which checks the session owes, per checkout root.
 *
 * Every check, whatever its scope, is owed only if an edited path inside the
 * root matches its `when` — a check without one is owed for any edit there.
 * A session that edited nothing owes nothing: a Stop gate is about the
 * session's own edits, and a read-only session blocked by someone else's
 * uncommitted error has been handed a failure it cannot own.
 *
 * A `files` check gets exactly its matched paths, relative to its run directory
 * and shell-quoted. Paths outside the root never reach here — the caller groups
 * by root — so no project command is handed a file it could not resolve.
 */
export function planChecks(checks: Check[], groups: RootEdits[]): PlannedCheck[] {
	const planned: PlannedCheck[] = []
	for (const group of Array.isArray(groups) ? groups : []) {
		if (!group || typeof group.root !== 'string' || group.root === '') continue
		const files = [...new Set((Array.isArray(group.files) ? group.files : []).filter((file) => withinRoot(group.root, file)))]
		if (files.length === 0) continue

		for (const check of Array.isArray(checks) ? checks : []) {
			const matched = files.filter((file) => matchesWhen(rootRelative(group.root, file), check.when))
			if (matched.length === 0) continue

			const runDir = check.cwd === '' ? group.root : path.join(group.root, ...check.cwd.split('/'))
			const base = (check.command ?? check.watch) as string
			const command =
				check.scope === 'files'
					? fill(base, FILES_TOKEN, matched.map((file) => shellQuote(path.relative(runDir, file) || '.')).join(' '))
					: base
			planned.push({ check, root: group.root, runDir, matched, command })
		}
	}
	return planned
}

// ---------------------------------------------------------------------------
// results
// ---------------------------------------------------------------------------

export interface CheckResult {
	name: string
	command: string
	root: string
	ok: boolean
	/** What the agent is shown. */
	output: string
	/**
	 * What identifies this failure for dedup, when that is not the raw output —
	 * a parsed check is keyed by its diagnostics, so a line shift in an edited
	 * file does not read as a new failure.
	 */
	identity?: string
	/** A non-blocking note for the user, keyed so it is shown once. */
	notice?: { key: string; text: string }
}

/** How a check process ended, as the runner observed it. */
export type RunOutcome =
	| { ran: true; exitCode: number; stdout: string; stderr: string }
	| { ran: false; why: string; stdout: string; stderr: string }

/**
 * Exit code decides, and anything that kept the check from completing is a
 * failure. A check that cannot run is a check that did not pass.
 */
export function judgeByExit(base: Omit<CheckResult, 'ok' | 'output'>, outcome: RunOutcome): CheckResult {
	const output = combined(outcome)
	if (!outcome.ran) return { ...base, ok: false, output: `${outcome.why}${output ? `\n\n${output}` : ''}` }
	if (outcome.exitCode === 127) return { ...base, ok: false, output: `the command could not be found (exit 127)${output ? `\n\n${output}` : ''}` }
	if (outcome.exitCode === 0) return { ...base, ok: true, output }
	return { ...base, ok: false, output: output || `exited ${outcome.exitCode} with no output` }
}

function combined(outcome: RunOutcome): string {
	return [outcome.stdout, outcome.stderr].map((part) => part.trim()).filter((part) => part !== '').join('\n')
}

/** Where a diagnostic's file lies, as resolved by the runner (which can touch the filesystem). */
export type Location = 'edited' | 'other' | 'global'

/**
 * Judge a `report: "edited"` check.
 *
 * The rules apply in order and the first that matches decides. Each step before
 * attribution exists because filtering adds a way to fake a pass that a plain
 * exit-code gate does not have: a crash, a config error or an unrecognised
 * format can all look like "no diagnostics in your files".
 *
 *   1. A check that did not run fails.
 *   2. Exit 0 passes; the tool's own threshold wins.
 *   3. Output the parser cannot fully account for fails unfiltered.
 *   4. Output the parser recognises as fatal fails unfiltered.
 *   5. A non-zero exit with no error to explain it fails unfiltered.
 *   6. An error count that disagrees with the tool's own summary fails unfiltered.
 *   7. Otherwise errors are attributed. Global ones — no file, a file that does
 *      not resolve inside the checkout, a dependency's declarations — are always
 *      kept; ones located in edited files are kept; the rest are filtered. Any
 *      kept error fails the check, showing only the kept ones.
 *
 * Only errors are attributed. Warnings and notes never block on their own here;
 * a project that gates on warnings should keep `report: "all"`.
 */
export function judgeEdited(
	base: Omit<CheckResult, 'ok' | 'output'>,
	outcome: RunOutcome,
	parsed: ParseResult | null,
	locate: (diagnostic: Diagnostic) => Location,
): CheckResult {
	if (!outcome.ran || outcome.exitCode === 0 || outcome.exitCode === 127) return judgeByExit(base, outcome)

	const raw = combined(outcome)
	const unfiltered = (why: string): CheckResult => ({
		...base,
		ok: false,
		output: `${why} — the full output is shown unfiltered.\n\n${raw || `exited ${outcome.exitCode} with no output`}`,
	})

	if (parsed === null || !parsed.ok) return unfiltered(`lint-gate could not parse this output (${parsed === null ? 'no parser' : parsed.reason})`)
	if (parsed.fatal !== null) return unfiltered(`the check did not complete (${parsed.fatal})`)

	const errors = parsed.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
	if (errors.length === 0) return unfiltered(`it exited ${outcome.exitCode} but reported no error to attribute`)
	if (parsed.reportedErrors !== null && parsed.reportedErrors !== errors.length) {
		return unfiltered(`it reported ${parsed.reportedErrors} errors but ${errors.length} were parsed`)
	}

	const kept: Array<{ diagnostic: Diagnostic; location: Location }> = []
	let filtered = 0
	for (const diagnostic of errors) {
		const location = locate(diagnostic)
		if (location === 'other') filtered += 1
		else kept.push({ diagnostic, location })
	}

	const filteredNote =
		filtered === 0 ? '' : `${filtered} error${filtered === 1 ? '' : 's'} located in files this session did not edit ${filtered === 1 ? 'was' : 'were'} not counted.`

	if (kept.length === 0) {
		return {
			...base,
			ok: true,
			output: '',
			notice: {
				key: `notice:${base.name}:${base.root}:${filtered}`,
				text: `${base.name} found no errors in files this session edited; ${filteredNote.charAt(0).toLowerCase()}${filteredNote.slice(1)}`,
			},
		}
	}

	const identity = JSON.stringify(
		kept
			.map(({ diagnostic }) => [diagnostic.file ?? '', diagnostic.code ?? '', diagnostic.message])
			.sort((a, b) => compare(a.join('\u0000'), b.join('\u0000'))),
	)
	const shown = kept.map(({ diagnostic }) => diagnostic.text).join('\n')
	const globals = kept.some(({ location }) => location === 'global')

	return {
		...base,
		ok: false,
		identity,
		output:
			`Errors located in files this session edited${globals ? ', or with no file in this checkout' : ''}:\n\n${shown}` +
			(filteredNote ? `\n\n${filteredNote}` : ''),
	}
}

// ---------------------------------------------------------------------------
// watched tests
// ---------------------------------------------------------------------------

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
 * pass against this code. Liveness only changes what the message says.
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
 * `unknown` blocks like a failure does. "I could not tell whether the tests
 * pass" is not permission to finish, and treating it as passing is the failure
 * mode that makes a dead watcher invisible.
 */
export function verdictAsResult(verdict: TestVerdict, base: Omit<CheckResult, 'ok' | 'output'>): CheckResult {
	if (verdict.state === 'pass') return { ...base, ok: true, output: '' }
	return {
		...base,
		ok: false,
		output: verdict.state === 'fail' ? verdict.detail : `No usable verdict — ${verdict.reason}.`,
	}
}

// ---------------------------------------------------------------------------
// deciding
// ---------------------------------------------------------------------------

/**
 * Stable identity for a set of failures, so the same unfixable problem is not
 * reported twice.
 *
 * Sorted, so array order cannot change the signature; only failures contribute,
 * so a newly passing check changes it. The command and root are part of the
 * identity too — a check that changed what it runs, or fails in a different
 * checkout, is a different failure the agent has not been told about.
 */
export function failureSignature(results: CheckResult[]): string {
	const failures = (Array.isArray(results) ? results : [])
		.filter((result) => result && !result.ok)
		.map((result) => ({
			name: String(result.name),
			command: String(result.command ?? ''),
			root: String(result.root ?? ''),
			identity: result.identity ?? String(result.output ?? '').trim(),
		}))
		.sort((a, b) => compare(a.name, b.name) || compare(a.root, b.root) || compare(a.command, b.command))

	return createHash('sha256').update(JSON.stringify(failures)).digest('hex')
}

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0
}

export interface Conclusion {
	/** The block reason, or null to let the agent finish. */
	block: string | null
	/** Shown to the user, never to the agent. */
	systemMessage: string | null
	/** Signature to remember as told-to-the-agent. */
	blocked: string | null
	/** Keys to remember as told-to-the-user. */
	notified: string[]
}

/**
 * Turn results into what the hook says.
 *
 * Two guards stop the gate from telling an agent about the same thing forever:
 * a Stop hook already continuing this turn does not block again, and a failure
 * set the agent was already told about is not re-sent. Neither guard makes a
 * failure invisible — what it suppresses goes to the user instead, once.
 *
 * `rootLabel` names a root when the session touched more than one checkout, so
 * a failure says where it happened.
 */
export function conclude({
	trigger,
	results,
	alreadyBlocked,
	alreadyNotified,
	stopHookActive,
	notes = [],
	rootLabel = () => null,
}: {
	trigger: Trigger
	results: CheckResult[]
	alreadyBlocked: string[]
	alreadyNotified: string[]
	stopHookActive?: boolean
	/** Extra context appended to a block, such as a checkout missing its dependencies. */
	notes?: string[]
	rootLabel?: (root: string) => string | null
}): Conclusion {
	const conclusion: Conclusion = { block: null, systemMessage: null, blocked: null, notified: [] }
	if (trigger !== 'Stop' && trigger !== 'TeammateIdle') return conclusion

	const list = Array.isArray(results) ? results.filter((result) => result && typeof result === 'object') : []
	const failures = list.filter((result) => !result.ok)
	const blockedBefore = Array.isArray(alreadyBlocked) ? alreadyBlocked : []
	const notifiedBefore = new Set(Array.isArray(alreadyNotified) ? alreadyNotified : [])
	const messages: string[] = []

	if (failures.length > 0) {
		const signature = failureSignature(failures)
		if (!stopHookActive && !blockedBefore.includes(signature)) {
			conclusion.block = blockReason(failures, notes, rootLabel)
			conclusion.blocked = signature
		} else if (!notifiedBefore.has(signature)) {
			messages.push(
				`lint-gate: ${failures.length === 1 ? 'a check is' : `${failures.length} checks are`} still failing and ${
					stopHookActive ? 'the turn is already continuing for a stop hook' : 'the agent was already told'
				}, so the agent was not asked again: ${failures.map((failure) => failure.name).join(', ')}.`,
			)
			conclusion.notified.push(signature)
		}
	}

	for (const result of list) {
		if (!result.notice || notifiedBefore.has(result.notice.key) || conclusion.notified.includes(result.notice.key)) continue
		messages.push(`lint-gate: ${result.notice.text}`)
		conclusion.notified.push(result.notice.key)
	}

	if (messages.length > 0) conclusion.systemMessage = messages.join('\n')
	return conclusion
}

function blockReason(failures: CheckResult[], notes: string[], rootLabel: (root: string) => string | null): string {
	const blocks = failures
		.map((failure) => {
			const where = rootLabel(failure.root)
			return `${failure.name}${where ? ` (in ${where})` : ''} — \`${failure.command}\`\n\n${failure.output.trim() || '(no output)'}`
		})
		.join('\n\n')

	return (
		`lint-gate: ${failures.length === 1 ? 'a check' : `${failures.length} checks`} failed.\n\n` +
		`${blocks}\n\n` +
		(notes.length > 0 ? `${notes.join('\n')}\n\n` : '') +
		'Fix these before finishing. A failure is reported by where it is, not by who caused it: if one is not yours to fix — ' +
		'another session working in the same checkout, or dependencies not installed here — say so explicitly rather than leaving it unmentioned.'
	)
}
