/**
 * Tests for the node:test reporter that produces lint-gate's report shape.
 *
 * The reporter is driven by an async event stream, so every case here feeds it
 * one and reads what it wrote — there is no pure layer to test instead.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import nodeTestJson from '../reporters/node-test-json.mjs'

const ROOT = mkdtempSync(path.join(tmpdir(), 'lint-gate-reporter-'))
let runs = 0

function destination(): string {
	return path.join(ROOT, `status-${++runs}.json`)
}

/** Feed the reporter a sequence of events and drain whatever it yields. */
async function report(events: unknown[], file: string | undefined): Promise<string[]> {
	const previous = process.env.LINT_GATE_STATUS
	if (file === undefined) delete process.env.LINT_GATE_STATUS
	else process.env.LINT_GATE_STATUS = file

	try {
		const out: string[] = []
		for await (const chunk of nodeTestJson((async function* () {
			for (const event of events) yield event
		})())) {
			out.push(String(chunk))
		}
		return out
	} finally {
		if (previous === undefined) delete process.env.LINT_GATE_STATUS
		else process.env.LINT_GATE_STATUS = previous
	}
}

const summary = (success: boolean, counts: Record<string, number>, file?: string) => ({
	type: 'test:summary',
	data: { success, counts, ...(file === undefined ? {} : { file }) },
})

function readReport(file: string): Record<string, unknown> {
	return JSON.parse(readFileSync(file, 'utf8'))
}

describe('reporting a node:test run to lint-gate', () => {
	it('writes the verdict and the counts', async () => {
		const file = destination()
		await report([summary(true, { tests: 7, failed: 0, passed: 7 })], file)
		assert.deepEqual(readReport(file), {
			success: true,
			numTotalTests: 7,
			numFailedTests: 0,
			numPassedTests: 7,
		})
	})

	it('reports a failing run as failing', async () => {
		const file = destination()
		await report([summary(false, { tests: 7, failed: 2, passed: 5 })], file)
		assert.equal(readReport(file).success, false)
		assert.equal(readReport(file).numFailedTests, 2)
	})

	it('reports the run aggregate, not the last file', async () => {
		// A run emits a summary per file and then an aggregate. A green file can
		// come last in a red run, and reporting it would be the wrong verdict.
		const file = destination()
		await report(
			[
				summary(false, { tests: 3, failed: 1, passed: 2 }, '/proj/a.test.ts'),
				summary(true, { tests: 2, failed: 0, passed: 2 }, '/proj/b.test.ts'),
				summary(false, { tests: 5, failed: 1, passed: 4 }),
			],
			file,
		)
		assert.equal(readReport(file).success, false)
		assert.equal(readReport(file).numTotalTests, 5)
	})

	it('rewrites the report on every run rather than appending', async () => {
		// The watch case: the event stream never ends, so a reporter that emits
		// once at the end never emits at all. Each aggregate must land on its own.
		const file = destination()
		await report(
			[
				summary(false, { tests: 2, failed: 1, passed: 1 }),
				summary(true, { tests: 2, failed: 0, passed: 2 }),
			],
			file,
		)
		// Parses as one object, so the second run replaced the first.
		assert.equal(readReport(file).success, true)
		assert.equal(readReport(file).numFailedTests, 0)
	})

	it('ignores events that are not summaries', async () => {
		const file = destination()
		await report([{ type: 'test:pass', data: {} }, { type: 'test:diagnostic', data: {} }], file)
		assert.equal(existsSync(file), false, 'a run with no summary must leave no verdict behind')
	})

	it('yields to stdout when no destination is set', async () => {
		const out = await report([summary(true, { tests: 1, failed: 0, passed: 1 })], undefined)
		assert.equal(JSON.parse(out.join('')).success, true)
	})
})
