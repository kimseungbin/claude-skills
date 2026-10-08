/**
 * Diagnostic parsers for `report: "edited"` checks.
 *
 * Pure: text in, structured diagnostics out. A parser's job is not only to find
 * diagnostics but to account for every line the tool printed. A line it cannot
 * classify makes the whole parse fail, because the one thing an output filter
 * must never do is turn a crash, a config error or a format it does not
 * understand into "zero diagnostics in your files" — that is a faked pass.
 *
 * Each parser is written against the tool's real output, captured from:
 *   tsc        TypeScript 5.6 and 7.0, `--pretty false` (piped output is the same)
 *   mypy       mypy 2.4, default text output
 *   mypy-json  mypy 2.4, `-O json`
 *   pyright    pyright 1.1.390, `--outputjson`
 *   svelte-check  svelte-check 4.7, `--output machine`
 */

export const PARSERS = ['tsc', 'mypy', 'mypy-json', 'pyright-json', 'svelte-check-machine'] as const

export type ParserName = (typeof PARSERS)[number]

export type Severity = 'error' | 'warning' | 'note'

export interface Diagnostic {
	/** As the tool printed it; null for a diagnostic with no location. */
	file: string | null
	line: number | null
	code: string | null
	message: string
	severity: Severity
	/** The tool's own lines for this diagnostic, continuations included. */
	text: string
}

export type ParseResult =
	| {
			ok: true
			diagnostics: Diagnostic[]
			/** Directory the tool's relative paths are relative to, when the output names one. */
			base: string | null
			/** The tool's own error count, when its format carries one. */
			reportedErrors: number | null
			/** Set when the output itself says the check did not complete. */
			fatal: string | null
	  }
	| { ok: false; reason: string }

export function isParser(value: unknown): value is ParserName {
	return typeof value === 'string' && (PARSERS as readonly string[]).includes(value)
}

/**
 * `exitCode` is passed because several tools use a dedicated code for "could
 * not run at all" (mypy 2, pyright 2–4), and that must fail unfiltered no matter
 * what the output looks like.
 */
export function parseOutput(parser: ParserName, stdout: string, stderr: string, exitCode: number): ParseResult {
	switch (parser) {
		case 'tsc':
			return parseTsc(`${stdout}\n${stderr}`)
		case 'mypy':
			return withExit(parseMypyText(`${stdout}\n${stderr}`), exitCode === 2 ? 'mypy exited 2 (a blocking error)' : null)
		case 'mypy-json':
			return withExit(parseMypyJson(`${stdout}\n${stderr}`), exitCode === 2 ? 'mypy exited 2 (a blocking error)' : null)
		case 'pyright-json':
			return parsePyright(stdout, stderr, exitCode)
		case 'svelte-check-machine':
			return parseSvelteCheck(`${stdout}\n${stderr}`)
	}
}

function withExit(result: ParseResult, fatal: string | null): ParseResult {
	if (!result.ok || fatal === null) return result
	return { ...result, fatal: result.fatal ?? fatal }
}

function lines(text: string): string[] {
	return text.split(/\r?\n/)
}

function unclassified(line: string): ParseResult {
	return { ok: false, reason: `unrecognized output line: ${line.length > 200 ? `${line.slice(0, 200)}…` : line}` }
}

// ---------------------------------------------------------------------------
// tsc
// ---------------------------------------------------------------------------

const TSC_LOCATED = /^(.+)\((\d+),(\d+)\): (error|warning|message) (TS\d+): (.*)$/
const TSC_GLOBAL = /^(error|warning|message) (TS\d+): (.*)$/
const TSC_SUMMARY = /^Found (\d+) errors?\b/

/**
 * Compiler-option and project-load diagnostics (TS5xxx), "no inputs" (TS18003)
 * and "file not found" (TS6053) mean tsc did not check the program the project
 * meant it to — a pass filtered out of that is not a pass. A diagnostic located
 * in a tsconfig file is the same thing, whatever its code.
 */
function tscFatal(code: string, file: string | null): boolean {
	return /^TS5\d{3}$/.test(code) || code === 'TS18003' || code === 'TS6053' || (file !== null && /(^|[\\/])tsconfig[^\\/]*\.json$/.test(file))
}

function parseTsc(output: string): ParseResult {
	const diagnostics: Diagnostic[] = []
	let reportedErrors: number | null = null
	let fatal: string | null = null

	for (const line of lines(output)) {
		if (line.trim() === '') continue

		const located = TSC_LOCATED.exec(line)
		const global = located ? null : TSC_GLOBAL.exec(line)
		if (located || global) {
			const file = located ? located[1] : null
			const severity = tscSeverity(located ? located[4] : global![1])
			const code = located ? located[5] : global![2]
			const message = located ? located[6] : global![3]
			diagnostics.push({ file, line: located ? Number(located[2]) : null, code, message, severity, text: line })
			if (severity === 'error' && fatal === null && tscFatal(code, file)) fatal = line
			continue
		}

		// An elaborated message or related information, indented under the
		// diagnostic it belongs to.
		if (/^\s/.test(line) && diagnostics.length > 0) {
			diagnostics[diagnostics.length - 1].text += `\n${line}`
			continue
		}

		const summary = TSC_SUMMARY.exec(line)
		if (summary) {
			reportedErrors = Number(summary[1])
			continue
		}

		return unclassified(line)
	}

	return { ok: true, diagnostics, base: null, reportedErrors, fatal }
}

function tscSeverity(word: string): Severity {
	return word === 'error' ? 'error' : word === 'warning' ? 'warning' : 'note'
}

// ---------------------------------------------------------------------------
// mypy
// ---------------------------------------------------------------------------

const MYPY_LOCATED = /^(.+?):(\d+)(?::\d+)?(?::\d+:\d+)?: (error|warning|note): (.*?)(?:\s{2}\[([a-z0-9-]+)\])?$/
const MYPY_FILE_LEVEL = /^(.+?): (error|warning|note): (.*?)(?:\s{2}\[([a-z0-9-]+)\])?$/
const MYPY_SUMMARY = /^Found (\d+) errors? in \d+ files? \(checked \d+ source files?\)$/
const MYPY_SUCCESS = /^Success: no issues found in \d+ source files?$/

function parseMypyText(output: string): ParseResult {
	const diagnostics: Diagnostic[] = []
	let reportedErrors: number | null = null

	for (const line of lines(output)) {
		if (line.trim() === '') continue

		const summary = MYPY_SUMMARY.exec(line)
		if (summary) {
			reportedErrors = Number(summary[1])
			continue
		}
		if (MYPY_SUCCESS.test(line)) {
			reportedErrors = 0
			continue
		}

		// `--pretty` source excerpts and carets sit indented under their diagnostic.
		if (/^\s/.test(line) && diagnostics.length > 0) {
			diagnostics[diagnostics.length - 1].text += `\n${line}`
			continue
		}

		const located = MYPY_LOCATED.exec(line)
		if (located) {
			diagnostics.push({
				file: located[1],
				line: Number(located[2]),
				code: located[5] ?? null,
				message: located[4],
				severity: located[3] as Severity,
				text: line,
			})
			continue
		}

		// mypy's own command-line errors print as `mypy: error: …`; that is not a
		// file, and it means the run did not happen.
		const fileLevel = MYPY_FILE_LEVEL.exec(line)
		if (fileLevel && fileLevel[1] !== 'mypy') {
			diagnostics.push({
				file: fileLevel[1],
				line: null,
				code: fileLevel[4] ?? null,
				message: fileLevel[3],
				severity: fileLevel[2] as Severity,
				text: line,
			})
			continue
		}

		return unclassified(line)
	}

	return { ok: true, diagnostics, base: null, reportedErrors, fatal: null }
}

function parseMypyJson(output: string): ParseResult {
	const diagnostics: Diagnostic[] = []
	let reportedErrors: number | null = null

	for (const line of lines(output)) {
		if (line.trim() === '') continue

		const summary = MYPY_SUMMARY.exec(line)
		if (summary) {
			reportedErrors = Number(summary[1])
			continue
		}
		if (MYPY_SUCCESS.test(line)) {
			reportedErrors = 0
			continue
		}

		let entry: unknown
		try {
			entry = JSON.parse(line)
		} catch {
			return unclassified(line)
		}
		const record = entry as Record<string, unknown>
		if (!entry || typeof entry !== 'object' || typeof record.message !== 'string' || !isSeverity(record.severity)) {
			return unclassified(line)
		}

		diagnostics.push({
			file: typeof record.file === 'string' && record.file !== '' ? record.file : null,
			line: typeof record.line === 'number' ? record.line : null,
			code: typeof record.code === 'string' ? record.code : null,
			message: record.message,
			severity: record.severity,
			text: line,
		})
	}

	return { ok: true, diagnostics, base: null, reportedErrors, fatal: null }
}

function isSeverity(value: unknown): value is Severity {
	return value === 'error' || value === 'warning' || value === 'note'
}

// ---------------------------------------------------------------------------
// pyright
// ---------------------------------------------------------------------------

/** pyright's documented exit codes: 2 fatal error, 3 config file unreadable, 4 illegal parameters. */
const PYRIGHT_FATAL: Record<number, string> = {
	2: 'pyright exited 2 (a fatal error)',
	3: 'pyright exited 3 (the config file could not be read)',
	4: 'pyright exited 4 (illegal command-line parameters)',
}

function parsePyright(stdout: string, stderr: string, exitCode: number): ParseResult {
	// `--outputjson` puts everything on stdout. Anything on stderr — a config
	// warning, a crash — is output this parser has not accounted for.
	const strayLine = lines(stderr).find((line) => line.trim() !== '')
	if (strayLine !== undefined) return unclassified(strayLine)

	let report: unknown
	try {
		report = JSON.parse(stdout)
	} catch {
		return { ok: false, reason: 'pyright output is not the JSON report --outputjson produces' }
	}

	const record = report as Record<string, unknown>
	if (!report || typeof report !== 'object' || !Array.isArray(record.generalDiagnostics)) {
		return { ok: false, reason: 'pyright output has no generalDiagnostics list' }
	}

	const diagnostics: Diagnostic[] = []
	for (const raw of record.generalDiagnostics) {
		const entry = raw as Record<string, unknown>
		if (!raw || typeof raw !== 'object' || typeof entry.message !== 'string') {
			return { ok: false, reason: 'pyright reported a diagnostic without a message' }
		}
		const severity: Severity = entry.severity === 'error' ? 'error' : entry.severity === 'warning' ? 'warning' : 'note'
		const range = entry.range as { start?: { line?: unknown } } | undefined
		const line = typeof range?.start?.line === 'number' ? range.start.line + 1 : null
		const file = typeof entry.file === 'string' && entry.file !== '' ? entry.file : null
		diagnostics.push({
			file,
			line,
			code: typeof entry.rule === 'string' ? entry.rule : null,
			message: entry.message,
			severity,
			text: `${file ?? '(no file)'}${line === null ? '' : `:${line}`}: ${severity}: ${entry.message}`,
		})
	}

	const summary = record.summary as Record<string, unknown> | undefined
	const reportedErrors = typeof summary?.errorCount === 'number' ? summary.errorCount : null

	return { ok: true, diagnostics, base: null, reportedErrors, fatal: PYRIGHT_FATAL[exitCode] ?? null }
}

// ---------------------------------------------------------------------------
// svelte-check
// ---------------------------------------------------------------------------

const SVELTE_START = /^\d+ START "(.*)"$/
const SVELTE_DIAGNOSTIC = /^\d+ (ERROR|WARNING) "(.*?)" (\d+):(\d+) "(.*)"$/
const SVELTE_COMPLETED = /^\d+ COMPLETED \d+ FILES (\d+) ERRORS \d+ WARNINGS \d+ FILES_WITH_PROBLEMS$/
const SVELTE_FAILURE = /^\d+ FAILURE "(.*)"$/

function parseSvelteCheck(output: string): ParseResult {
	const diagnostics: Diagnostic[] = []
	let base: string | null = null
	let reportedErrors: number | null = null
	let fatal: string | null = null

	for (const line of lines(output)) {
		if (line.trim() === '') continue

		const start = SVELTE_START.exec(line)
		if (start) {
			base = unquote(start[1])
			continue
		}

		const diagnostic = SVELTE_DIAGNOSTIC.exec(line)
		if (diagnostic) {
			diagnostics.push({
				file: unquote(diagnostic[2]),
				line: Number(diagnostic[3]),
				code: null,
				message: unquote(diagnostic[5]),
				severity: diagnostic[1] === 'ERROR' ? 'error' : 'warning',
				text: line,
			})
			continue
		}

		const completed = SVELTE_COMPLETED.exec(line)
		if (completed) {
			reportedErrors = Number(completed[1])
			continue
		}

		const failure = SVELTE_FAILURE.exec(line)
		if (failure) {
			fatal = `svelte-check failed: ${unquote(failure[1])}`
			continue
		}

		return unclassified(line)
	}

	return { ok: true, diagnostics, base, reportedErrors, fatal }
}

/** svelte-check writes each quoted field as a JSON string body. */
function unquote(body: string): string {
	try {
		return JSON.parse(`"${body}"`) as string
	} catch {
		return body
	}
}
