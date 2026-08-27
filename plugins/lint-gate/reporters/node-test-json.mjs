/**
 * A node:test reporter that emits the report shape lint-gate reads.
 *
 * Node's built-in reporters are spec, dot, tap, junit and lcov — none carries a
 * machine-readable pass/fail verdict, so a project on the built-in test runner
 * has nothing for the gate to consult. This bridges that.
 *
 * Usage, in .claude/config/lint-gate.json:
 *
 *   "test": {
 *     "watch": "LINT_GATE_STATUS={status} node --test --watch --test-reporter=${CLAUDE_PLUGIN_ROOT}/reporters/node-test-json.mjs"
 *   }
 *
 * The report path comes from LINT_GATE_STATUS and the file is written here
 * rather than through --test-reporter-destination. That is not a preference:
 * a reporter is an async generator over an event stream that, under --watch,
 * never ends. Anything yielded after the loop is never yielded at all, so a
 * reporter that accumulates and emits at the end produces an empty file for
 * the entire life of the watch process. Writing per run is the only shape that
 * reports more than once.
 */

import { writeFileSync } from 'node:fs'

export default async function* nodeTestJson(source) {
	const destination = process.env.LINT_GATE_STATUS

	for await (const event of source) {
		if (event.type !== 'test:summary') continue

		// A run emits one summary per file and then an aggregate with no `file`.
		// Only the aggregate is the verdict for the run — writing the per-file
		// ones would leave a green file as the last word on a red run.
		if (event.data?.file !== undefined) continue

		const counts = event.data?.counts ?? {}
		const report = JSON.stringify({
			success: event.data?.success === true,
			numTotalTests: counts.tests ?? 0,
			numFailedTests: counts.failed ?? 0,
			numPassedTests: counts.passed ?? 0,
		})

		if (destination) {
			try {
				writeFileSync(destination, `${report}\n`)
			} catch {
				// A report that cannot be written reads at the gate as a missing
				// verdict, which blocks. Crashing the test run would be worse.
			}
		} else {
			yield `${report}\n`
		}
	}
}
