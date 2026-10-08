/**
 * Tests for the diagnostic parsers behind `report: "edited"`.
 *
 * Every fixture is real tool output, captured from the versions named in
 * parsers.ts, with paths shortened. The cases that matter most are the ones
 * where the parse must *fail*: anything a parser cannot account for has to fail
 * the check, or a filter can turn a crash into a pass.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { isParser, parseOutput, type ParseResult } from './parsers.ts'

function parsed(result: ParseResult) {
	assert.equal(result.ok, true, `expected a parse, got: ${JSON.stringify(result)}`)
	return result as Extract<ParseResult, { ok: true }>
}

function rejected(result: ParseResult): string {
	assert.equal(result.ok, false, `expected the parse to fail, got: ${JSON.stringify(result)}`)
	return (result as { reason: string }).reason
}

describe('isParser', () => {
	it('knows the shipped parsers and nothing else', () => {
		for (const name of ['tsc', 'mypy', 'mypy-json', 'pyright-json', 'svelte-check-machine']) assert.equal(isParser(name), true)
		for (const name of ['eslint', 'gnu', '', null, 7]) assert.equal(isParser(name), false)
	})
})

describe('tsc', () => {
	// TypeScript 5.6 and 7.0 print the same thing with --pretty false, and when piped.
	const OUTPUT = [
		"src/a.ts(1,40): error TS2322: Type 'number' is not assignable to type 'string'.",
		"src/c.ts(5,3): error TS2345: Argument of type '{ x: { y: string; }; }' is not assignable to parameter of type '{ x: { y: number; }; }'.",
		"  The types of 'x.y' are incompatible between these types.",
		"    Type 'string' is not assignable to type 'number'.",
		"src/c.ts(6,5): error TS2322: Type '{ p: number; }' is not assignable to type 'string'.",
		'',
	].join('\n')

	it('reads located diagnostics with their continuation lines', () => {
		const result = parsed(parseOutput('tsc', OUTPUT, '', 1))
		assert.deepEqual(
			result.diagnostics.map((d) => [d.file, d.line, d.code, d.severity]),
			[
				['src/a.ts', 1, 'TS2322', 'error'],
				['src/c.ts', 5, 'TS2345', 'error'],
				['src/c.ts', 6, 'TS2322', 'error'],
			],
		)
		assert.match(result.diagnostics[1].text, /incompatible between these types\.\n    Type 'string'/)
		assert.equal(result.fatal, null)
	})

	it('reads a diagnostic with no file', () => {
		const result = parsed(parseOutput('tsc', "error TS2318: Cannot find global type 'Array'.", '', 2))
		assert.equal(result.diagnostics[0].file, null)
	})

	it('takes the error count from a summary line when one is printed', () => {
		assert.equal(parsed(parseOutput('tsc', `${OUTPUT}\nFound 3 errors in 2 files.\n`, '', 1)).reportedErrors, 3)
		assert.equal(parsed(parseOutput('tsc', OUTPUT, '', 1)).reportedErrors, null)
	})

	it('marks a compiler-option error as fatal', () => {
		const result = parsed(parseOutput('tsc', "tsconfig.json(1,24): error TS5023: Unknown compiler option 'bogus'.", '', 1))
		assert.match(result.fatal ?? '', /TS5023/)
	})

	it('marks "no inputs" as fatal', () => {
		const line = "error TS18003: No inputs were found in config file '/p/tsconfig.json'. Specified 'include' paths were '[\"nothing\"]' and 'exclude' paths were '[]'."
		assert.match(parsed(parseOutput('tsc', line, '', 2)).fatal ?? '', /TS18003/)
	})

	it('marks any error located in a tsconfig file as fatal', () => {
		assert.ok(parsed(parseOutput('tsc', 'packages/api/tsconfig.build.json(3,5): error TS6046: bad', '', 1)).fatal)
	})

	it('rejects output it does not recognise', () => {
		assert.match(rejected(parseOutput('tsc', `${OUTPUT}\nnpm ERR! code 2`, '', 1)), /npm ERR!/)
	})

	it('rejects pretty output, whose frames it cannot attribute', () => {
		rejected(parseOutput('tsc', "src/a.ts:1:40 - error TS2322: Type 'number' is not assignable to type 'string'.\n\n1 export {}\n", '', 1))
	})

	it('rejects a stack trace on stderr', () => {
		rejected(parseOutput('tsc', OUTPUT, 'Error: ENOMEM\n    at Object.<anonymous>', 1))
	})

	it('rejects an indented line with nothing to attach to', () => {
		rejected(parseOutput('tsc', '  orphan continuation', '', 1))
	})
})

describe('mypy', () => {
	// mypy 2.4, default text output.
	const OUTPUT = [
		'pkg/b.py:3: error: Too many arguments for "g"  [call-arg]',
		'pkg/a.py:2: error: Incompatible return value type (got "int", expected "str")  [return-value]',
		'pkg/a.py:5: note: Revealed type is "def (x: int) -> str"',
		'pkg/a.py:6: note: See https://mypy.readthedocs.io/en/stable/running_mypy.html#missing-imports',
		'Found 2 errors in 2 files (checked 2 source files)',
		'',
	].join('\n')

	it('reads errors and notes with their codes, and the summary count', () => {
		const result = parsed(parseOutput('mypy', OUTPUT, '', 1))
		assert.deepEqual(
			result.diagnostics.map((d) => [d.file, d.line, d.code, d.severity]),
			[
				['pkg/b.py', 3, 'call-arg', 'error'],
				['pkg/a.py', 2, 'return-value', 'error'],
				['pkg/a.py', 5, null, 'note'],
				['pkg/a.py', 6, null, 'note'],
			],
		)
		assert.equal(result.reportedErrors, 2)
	})

	it('reads the success line as zero errors', () => {
		assert.equal(parsed(parseOutput('mypy', 'Success: no issues found in 2 source files\n', '', 0)).reportedErrors, 0)
	})

	it('reads column and end positions when mypy is asked for them', () => {
		const result = parsed(parseOutput('mypy', 'pkg/a.py:2:12:2:13: error: Incompatible return value  [return-value]', '', 1))
		assert.deepEqual([result.diagnostics[0].file, result.diagnostics[0].line], ['pkg/a.py', 2])
	})

	it('treats exit 2 as fatal', () => {
		assert.match(parsed(parseOutput('mypy', 'pkg/c.py:1: error: invalid syntax  [syntax]', '', 2)).fatal ?? '', /exited 2/)
	})

	it('rejects mypy’s own command-line errors', () => {
		rejected(parseOutput('mypy', '', 'mypy: error: Missing target module, package, files, or command.', 2))
	})

	it('rejects config warnings it cannot attribute', () => {
		rejected(parseOutput('mypy', OUTPUT, 'mypy.ini: [mypy]: Unrecognized option: bogus_opt = 1', 1))
	})
})

describe('mypy-json', () => {
	// mypy 2.4, `-O json`: one object per line, no summary.
	const OUTPUT = [
		'{"file": "pkg/b.py", "line": 3, "column": 0, "end_line": 3, "end_column": 4, "message": "Too many arguments for \\"g\\"", "hint": null, "code": "call-arg", "severity": "error"}',
		'{"file": "pkg/a.py", "line": 5, "column": 12, "end_line": 5, "end_column": 13, "message": "Revealed type is \\"def (x: int) -> str\\"", "hint": null, "code": "misc", "severity": "note"}',
		'',
	].join('\n')

	it('reads one diagnostic per line', () => {
		const result = parsed(parseOutput('mypy-json', OUTPUT, '', 1))
		assert.deepEqual(
			result.diagnostics.map((d) => [d.file, d.line, d.code, d.severity]),
			[
				['pkg/b.py', 3, 'call-arg', 'error'],
				['pkg/a.py', 5, 'misc', 'note'],
			],
		)
		assert.equal(result.reportedErrors, null)
	})

	it('accepts the summary line mypy prints without --no-error-summary', () => {
		assert.equal(parsed(parseOutput('mypy-json', `${OUTPUT}Found 1 error in 1 file (checked 2 source files)\n`, '', 1)).reportedErrors, 1)
	})

	it('treats exit 2 as fatal', () => {
		assert.ok(parsed(parseOutput('mypy-json', OUTPUT, '', 2)).fatal)
	})

	it('rejects config warnings on stderr', () => {
		rejected(parseOutput('mypy-json', OUTPUT, 'mypy.ini: [mypy]: strict: Not a boolean: maybe', 1))
	})

	it('rejects a JSON line that is not a diagnostic', () => {
		rejected(parseOutput('mypy-json', '{"unexpected": true}', '', 1))
	})
})

describe('pyright-json', () => {
	// pyright 1.1.390, `--outputjson`.
	const REPORT = JSON.stringify({
		version: '1.1.390',
		generalDiagnostics: [
			{
				file: '/p/pkg/a.py',
				severity: 'error',
				message: 'Type "int" is not assignable to return type "str"\n  "int" is not assignable to "str"',
				range: { start: { line: 1, character: 11 }, end: { line: 1, character: 12 } },
				rule: 'reportReturnType',
			},
			{
				file: '/p/pkg/a.py',
				severity: 'information',
				message: 'Type of "f" is "(x: int) -> str"',
				range: { start: { line: 4, character: 12 }, end: { line: 4, character: 13 } },
			},
		],
		summary: { filesAnalyzed: 2, errorCount: 1, warningCount: 0, informationCount: 1, timeInSec: 0.1 },
	})

	it('reads diagnostics with one-based lines, and the summary count', () => {
		const result = parsed(parseOutput('pyright-json', REPORT, '', 1))
		assert.deepEqual(
			result.diagnostics.map((d) => [d.file, d.line, d.code, d.severity]),
			[
				['/p/pkg/a.py', 2, 'reportReturnType', 'error'],
				['/p/pkg/a.py', 5, null, 'note'],
			],
		)
		assert.equal(result.reportedErrors, 1)
		assert.equal(result.fatal, null)
	})

	it('treats its fatal exit codes as fatal', () => {
		for (const code of [2, 3, 4]) assert.ok(parsed(parseOutput('pyright-json', REPORT, '', code)).fatal, `exit ${code}`)
	})

	it('rejects anything on stderr', () => {
		rejected(parseOutput('pyright-json', REPORT, 'Config file "/p/pyrightconfig.json" could not be parsed.', 3))
	})

	it('rejects output that is not its report', () => {
		rejected(parseOutput('pyright-json', 'No configuration file found.', '', 1))
		rejected(parseOutput('pyright-json', '{"summary": {}}', '', 1))
	})
})

describe('svelte-check-machine', () => {
	// svelte-check 4.7, `--output machine`.
	const OUTPUT = [
		'1791427438157 START "/p/app"',
		'1791427438158 WARNING "src/App.svelte" 5:1 "`<div>` with a click handler must have an ARIA role\\nhttps://svelte.dev/e/a11y_no_static_element_interactions"',
		'1791427438158 ERROR "src/App.svelte" 2:7 "Type \'string\' is not assignable to type \'number\'."',
		'1791427438158 ERROR "src/util.ts" 1:14 "Type \'number\' is not assignable to type \'string\'."',
		'1791427438158 COMPLETED 82 FILES 2 ERRORS 1 WARNINGS 2 FILES_WITH_PROBLEMS',
		'',
	].join('\n')

	it('reads diagnostics relative to the workspace it started in, with the summary count', () => {
		const result = parsed(parseOutput('svelte-check-machine', OUTPUT, '', 1))
		assert.equal(result.base, '/p/app')
		assert.equal(result.reportedErrors, 2)
		assert.deepEqual(
			result.diagnostics.map((d) => [d.file, d.line, d.severity]),
			[
				['src/App.svelte', 5, 'warning'],
				['src/App.svelte', 2, 'error'],
				['src/util.ts', 1, 'error'],
			],
		)
		assert.match(result.diagnostics[0].message, /ARIA role\nhttps/)
	})

	it('treats a FAILURE row as fatal', () => {
		assert.match(parsed(parseOutput('svelte-check-machine', '1791427438157 START "/p"\n1791427438158 FAILURE "Cannot read tsconfig"\n', '', 1)).fatal ?? '', /tsconfig/)
	})

	it('rejects machine-verbose rows, which it does not read', () => {
		rejected(parseOutput('svelte-check-machine', '1791427440118 {"type":"ERROR","filename":"src/util.ts"}', '', 1))
	})
})
