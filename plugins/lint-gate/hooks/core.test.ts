import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { commandsFor, decide, failureSignature, formatCommand, resolveConfig } from './core.ts'
import type { CommandResult, Decision, GateConfig, Trigger } from './core.ts'

const FORMAT = 'prettier --write'
const LINT = 'eslint .'
const TYPECHECK = 'tsc --noEmit'

const FULL: GateConfig = { format: FORMAT, lint: LINT, typecheck: TYPECHECK }

const SANDBOX = mkdtempSync(`${tmpdir()}/lint-gate-quoting-`)

function fail(name: string, command: string, output: string): CommandResult {
	return { name, command, ok: false, output }
}

function pass(name: string, command: string, output = ''): CommandResult {
	return { name, command, ok: true, output }
}

function decideFor(
	results: CommandResult[],
	options: { trigger?: Trigger; alreadyBlocked?: string[]; stopHookActive?: boolean } = {},
): Decision {
	return decide({
		trigger: options.trigger ?? 'Stop',
		results,
		alreadyBlocked: options.alreadyBlocked ?? [],
		stopHookActive: options.stopHookActive,
	})
}

function assertPassed(d: Decision, message?: string): void {
	assert.equal(d.block, false, message ?? `expected no block, got: ${JSON.stringify(d)}`)
}

function assertBlocked(d: Decision, message?: string): string {
	assert.equal(d.block, true, message ?? 'expected a block, got none')
	const reason = (d as { block: true; reason: string }).reason
	assert.equal(typeof reason, 'string', 'a block must carry a string reason')
	assert.ok(reason.length > 0, 'a block reason must not be empty')
	return reason
}

/**
 * Runs a built format command through a real shell and returns what it printed.
 * The base is `printf [%s]`, so a correctly quoted path yields exactly `[path]`:
 * one argument, nothing split, nothing else executed. Style-agnostic — it checks
 * the quoting works, not which quoting was chosen.
 */
function shellSees(base: string, filePath: string): string {
	const cmd = formatCommand(base, filePath)
	try {
		return execFileSync('/bin/sh', ['-c', cmd], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			// A quoting bug turns these paths into real commands; keep any fallout out of the repo.
			cwd: SANDBOX,
		})
	} catch (err) {
		assert.fail(`/bin/sh rejected the built command, so the path was not safely quoted:\n${cmd}\n${String(err)}`)
	}
}

function assertPathSurvivesShell(filePath: string, message?: string): void {
	assert.equal(shellSees('printf [%s]', filePath), `[${filePath}]`, message ?? `path mangled or unquoted: ${filePath}`)
}

describe('resolveConfig', () => {
	it('keeps all three valid string fields', () => {
		assert.deepEqual(resolveConfig({ format: FORMAT, lint: LINT, typecheck: TYPECHECK }), FULL)
	})

	it('keeps a partial config', () => {
		assert.deepEqual(resolveConfig({ lint: LINT }), { lint: LINT })
	})

	it('drops unknown extra keys', () => {
		assert.deepEqual(resolveConfig({ lint: LINT, test: 'vitest run', $comment: 'notes' }), { lint: LINT })
	})

	it('drops a known key whose value is not a string', () => {
		assert.deepEqual(resolveConfig({ format: FORMAT, lint: 42 }), { format: FORMAT })
		assert.deepEqual(resolveConfig({ lint: null, typecheck: TYPECHECK }), { typecheck: TYPECHECK })
		assert.deepEqual(resolveConfig({ lint: ['eslint', '.'] }), {})
		assert.deepEqual(resolveConfig({ typecheck: { cmd: TYPECHECK } }), {})
		assert.deepEqual(resolveConfig({ format: true }), {})
	})

	describe('fail open — junk degrades to "run nothing", never a throw', () => {
		const junk: Array<[string, unknown]> = [
			['null', null],
			['undefined', undefined],
			['a string', 'lint: eslint .'],
			['a number', 42],
			['a boolean', false],
			['an array', []],
			['an array of strings', ['eslint .']],
			['NaN', Number.NaN],
			['a function', () => LINT],
		]

		for (const [label, raw] of junk) {
			it(`yields an empty config for ${label}`, () => {
				assert.deepEqual(resolveConfig(raw), {})
			})
		}
	})

	it('returns a config usable by commandsFor without further checks', () => {
		assert.deepEqual(commandsFor('Stop', resolveConfig('nonsense')), [])
		assert.deepEqual(commandsFor('PostToolUse', resolveConfig(null)), [])
	})
})

describe('commandsFor', () => {
	describe('PostToolUse — formatting only', () => {
		it('runs format alone even when lint and typecheck are configured', () => {
			assert.deepEqual(commandsFor('PostToolUse', FULL), [{ name: 'format', command: FORMAT }])
		})

		it('runs nothing when format is not configured', () => {
			assert.deepEqual(commandsFor('PostToolUse', { lint: LINT, typecheck: TYPECHECK }), [])
		})

		it('runs nothing for an empty config', () => {
			assert.deepEqual(commandsFor('PostToolUse', {}), [])
		})
	})

	for (const trigger of ['Stop', 'TeammateIdle'] as const) {
		describe(`${trigger} — lint then typecheck, never format`, () => {
			it('orders lint before typecheck', () => {
				assert.deepEqual(commandsFor(trigger, FULL), [
					{ name: 'lint', command: LINT },
					{ name: 'typecheck', command: TYPECHECK },
				])
			})

			it('keeps that order when the config lists them the other way round', () => {
				const reversed: GateConfig = { typecheck: TYPECHECK, lint: LINT }
				assert.deepEqual(commandsFor(trigger, reversed).map((c) => c.name), ['lint', 'typecheck'])
			})

			it('never includes format', () => {
				const names = commandsFor(trigger, FULL).map((c) => c.name)
				assert.equal(names.includes('format'), false, 'a post-read rewrite makes the next edit miss')
			})

			it('omits lint when it is not configured', () => {
				assert.deepEqual(commandsFor(trigger, { format: FORMAT, typecheck: TYPECHECK }), [
					{ name: 'typecheck', command: TYPECHECK },
				])
			})

			it('omits typecheck when it is not configured', () => {
				assert.deepEqual(commandsFor(trigger, { format: FORMAT, lint: LINT }), [{ name: 'lint', command: LINT }])
			})

			it('runs nothing when only format is configured', () => {
				assert.deepEqual(commandsFor(trigger, { format: FORMAT }), [])
			})

			it('runs nothing for an empty config', () => {
				assert.deepEqual(commandsFor(trigger, {}), [])
			})
		})
	}

	/**
	 * `GateConfig` cannot express "non-blank", so `commandsFor` must not rely on having
	 * been handed a `resolveConfig` result. A blank command reaches the runner, fails,
	 * and produces a block — the gate punishing the agent for a config typo.
	 */
	describe('blank commands are not commands', () => {
		const blanks: Array<[string, string]> = [
			['an empty string', ''],
			['a single space', ' '],
			['spaces', '    '],
			['a tab', '\t'],
			['a newline', '\n'],
			['mixed whitespace', ' \t\n '],
		]

		for (const [label, blank] of blanks) {
			it(`drops a format of ${label}`, () => {
				assert.deepEqual(commandsFor('PostToolUse', { format: blank }), [])
			})
		}

		for (const trigger of ['Stop', 'TeammateIdle'] as const) {
			for (const [label, blank] of blanks) {
				it(`drops a lint of ${label} on ${trigger}`, () => {
					assert.deepEqual(commandsFor(trigger, { lint: blank, typecheck: TYPECHECK }), [
						{ name: 'typecheck', command: TYPECHECK },
					])
				})

				it(`drops a typecheck of ${label} on ${trigger}`, () => {
					assert.deepEqual(commandsFor(trigger, { lint: LINT, typecheck: blank }), [
						{ name: 'lint', command: LINT },
					])
				})
			}

			it(`yields nothing on ${trigger} when both are blank`, () => {
				assert.deepEqual(commandsFor(trigger, { lint: '', typecheck: '   ' }), [])
			})
		}

		it('never emits an entry whose command is blank', () => {
			const junk: GateConfig = { format: ' ', lint: '', typecheck: '\t' }
			for (const trigger of ['PostToolUse', 'Stop', 'TeammateIdle'] as const) {
				for (const entry of commandsFor(trigger, junk)) {
					assert.fail(`${trigger} emitted a blank command: ${JSON.stringify(entry)}`)
				}
			}
		})

		/**
		 * Trim answers "is this blank?" and is then thrown away. What runs is what
		 * the project configured — a module that silently rewrites configured values
		 * stops being predictable from the config file.
		 */
		it('keeps a padded command verbatim rather than mistaking it for blank', () => {
			assert.deepEqual(commandsFor('Stop', { lint: '  eslint .  ' }), [{ name: 'lint', command: '  eslint .  ' }])
		})

		it('does not rewrite a command that is already unpadded', () => {
			assert.deepEqual(commandsFor('PostToolUse', { format: FORMAT }), [{ name: 'format', command: FORMAT }])
		})
	})

	it('names each command after the config key it came from', () => {
		for (const entry of commandsFor('Stop', FULL)) {
			assert.equal(entry.command, FULL[entry.name as keyof GateConfig], `${entry.name} must carry its own command`)
		}
		assert.equal(commandsFor('PostToolUse', FULL)[0]?.name, 'format')
	})

	it('does not leak the config object into the result entries', () => {
		const config: GateConfig = { lint: LINT }
		const [entry] = commandsFor('Stop', config)
		assert.deepEqual(Object.keys(entry as object).sort(), ['command', 'name'])
	})
})

describe('formatCommand', () => {
	describe('placeholder substitution', () => {
		it('substitutes {file} in the middle of the base', () => {
			const cmd = formatCommand('prettier --write {file} --log-level warn', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{file\}/, 'the placeholder must be consumed')
			assert.match(cmd, /^prettier --write /)
			assert.match(cmd, / --log-level warn$/, 'the tail of the base must survive')
			assert.match(cmd, /src\/a\.ts/)
		})

		it('substitutes every occurrence', () => {
			const cmd = formatCommand('cmp -s {file} {file}', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{file\}/)
			assert.equal(cmd.split('src/a.ts').length - 1, 2, 'both placeholders must be filled')
		})

		it('passes exactly one argument through a shell when the placeholder is used', () => {
			assert.equal(shellSees('printf [%s] {file}', 'src/a.ts'), '[src/a.ts]')
		})

		it('does not also append the path when the placeholder is present', () => {
			const cmd = formatCommand('prettier --write {file}', 'src/a.ts')
			assert.equal(cmd.split('src/a.ts').length - 1, 1, 'the path must appear once, not substituted and appended')
		})
	})

	describe('appending when there is no placeholder', () => {
		it('keeps the base intact at the front', () => {
			const cmd = formatCommand('prettier --write', 'src/a.ts')
			assert.equal(cmd.startsWith('prettier --write'), true)
			assert.match(cmd, /src\/a\.ts/)
		})

		it('separates the base from the path', () => {
			const cmd = formatCommand('prettier --write', 'src/a.ts')
			assert.doesNotMatch(cmd, /--writesrc/, 'the path must not be glued onto the last flag')
		})

		it('passes exactly one argument through a shell', () => {
			assert.equal(shellSees('printf [%s]', 'src/a.ts'), '[src/a.ts]')
		})
	})

	describe('shell quoting — a mistake here is a shell injection', () => {
		const hostile: Array<[string, string]> = [
			['a space', '/tmp/my file.ts'],
			['a single quote', "/tmp/it's.ts"],
			['a double quote', '/tmp/a"b.ts'],
			['a semicolon', '/tmp/a;echo pwned;.ts'],
			['a command separator', '/tmp/a && echo pwned.ts'],
			['a pipe', '/tmp/a | echo pwned.ts'],
			['command substitution', '/tmp/a$(echo pwned).ts'],
			['backticks', '/tmp/a`echo pwned`.ts'],
			['a variable reference', '/tmp/$HOME.ts'],
			['a glob', '/tmp/*'],
			['a tilde', '~/a.ts'],
			['a newline', '/tmp/a\nb.ts'],
			['a tab', '/tmp/a\tb.ts'],
			['a backslash', '/tmp/a\\b.ts'],
			['a redirect', '/tmp/a > pwned.ts'],
			['a subshell', '/tmp/(a).ts'],
			['a dash in the name', '/tmp/-rf.ts'],
			['every trick at once', `/tmp/a'"\`$(echo x) ;&|>*.ts`],
		]

		for (const [label, filePath] of hostile) {
			it(`survives ${label} when appended`, () => {
				assertPathSurvivesShell(filePath)
			})
		}

		for (const [label, filePath] of hostile) {
			it(`survives ${label} when substituted into {file}`, () => {
				assert.equal(shellSees('printf [%s] {file}', filePath), `[${filePath}]`, `path mangled: ${filePath}`)
			})
		}

		it('does not execute an injected command', () => {
			const out = shellSees('printf [%s]', '/tmp/x; echo pwned')
			assert.doesNotMatch(out, /pwned$/m, 'the injected echo must never run')
			assert.equal(out, '[/tmp/x; echo pwned]')
		})

		it('leaves the raw path unquoted nowhere in the command', () => {
			const cmd = formatCommand('prettier --write', '/tmp/my file.ts')
			assert.doesNotMatch(cmd, /(^|\s)\/tmp\/my file\.ts(\s|$)/, 'a bare path with a space is two arguments')
		})
	})

	describe('edge cases', () => {
		it('handles an empty base', () => {
			assert.match(formatCommand('', 'src/a.ts'), /src\/a\.ts/)
		})

		it('handles a base that is only the placeholder', () => {
			assert.equal(shellSees('{file}', 'true'), '')
		})

		it('does not treat {file} inside the path as a placeholder', () => {
			assertPathSurvivesShell('/tmp/{file}/a.ts')
		})

		it('is pure — the same inputs give the same command', () => {
			assert.equal(formatCommand(FORMAT, 'src/a.ts'), formatCommand(FORMAT, 'src/a.ts'))
		})
	})
})

describe('failureSignature', () => {
	const lintFail = fail('lint', LINT, 'src/a.ts:1:1 no-unused-vars')
	const typeFail = fail('typecheck', TYPECHECK, "src/b.ts(3,5): error TS2345: Argument of type 'string'")

	it('returns a string', () => {
		assert.equal(typeof failureSignature([lintFail]), 'string')
	})

	it('is stable across repeated calls', () => {
		assert.equal(failureSignature([lintFail, typeFail]), failureSignature([lintFail, typeFail]))
	})

	it('is stable for an empty set', () => {
		assert.equal(typeof failureSignature([]), 'string')
		assert.equal(failureSignature([]), failureSignature([]))
	})

	it('is stable for an all-passing set', () => {
		const sig = failureSignature([pass('lint', LINT), pass('typecheck', TYPECHECK)])
		assert.equal(typeof sig, 'string')
		assert.equal(sig, failureSignature([pass('lint', LINT), pass('typecheck', TYPECHECK)]))
	})

	it('ignores passing results entirely', () => {
		assert.equal(
			failureSignature([lintFail, pass('typecheck', TYPECHECK, 'no errors')]),
			failureSignature([lintFail]),
			'a passing sibling must not change which failures these are',
		)
		assert.equal(
			failureSignature([pass('format', FORMAT, 'wrote 3 files'), lintFail]),
			failureSignature([pass('typecheck', TYPECHECK, 'ok'), lintFail]),
			'which commands passed is irrelevant to the failure identity',
		)
		assert.equal(failureSignature([pass('lint', LINT)]), failureSignature([]), 'no failures is no failures')
	})

	it('is independent of array order', () => {
		assert.equal(failureSignature([lintFail, typeFail]), failureSignature([typeFail, lintFail]))
	})

	it('is independent of where passing results sit in the array', () => {
		const p = pass('format', FORMAT)
		assert.equal(failureSignature([p, lintFail, typeFail]), failureSignature([typeFail, p, lintFail]))
	})

	it('changes when a failure output changes', () => {
		const worse = fail('lint', LINT, 'src/a.ts:1:1 no-unused-vars\nsrc/c.ts:9:2 eqeqeq')
		assert.notEqual(failureSignature([lintFail]), failureSignature([worse]), 'a new error must be reported')
	})

	it('changes when the failing command changes', () => {
		const other = fail('lint', 'eslint src', lintFail.output)
		assert.notEqual(failureSignature([lintFail]), failureSignature([other]))
	})

	it('changes when the failing name changes', () => {
		const other = fail('typecheck', LINT, lintFail.output)
		assert.notEqual(failureSignature([lintFail]), failureSignature([other]))
	})

	it('distinguishes a subset from a superset', () => {
		assert.notEqual(failureSignature([lintFail]), failureSignature([lintFail, typeFail]))
		assert.notEqual(failureSignature([]), failureSignature([lintFail]))
	})

	it('distinguishes one failure from a different single failure', () => {
		assert.notEqual(failureSignature([lintFail]), failureSignature([typeFail]))
	})

	it('does not mutate its input', () => {
		const results = [typeFail, lintFail]
		const snapshot = structuredClone(results)
		failureSignature(results)
		assert.deepEqual(results, snapshot, 'sorting for order-independence must not reorder the caller array')
	})
})

describe('decide — when not to block', () => {
	it('does not block with no results', () => {
		assertPassed(decideFor([]))
	})

	it('does not block when every result passes', () => {
		assert.deepEqual(decideFor([pass('lint', LINT), pass('typecheck', TYPECHECK)]), { block: false })
	})

	it('does not block when the loop guard is set', () => {
		const results = [fail('lint', LINT, 'boom')]
		assertPassed(decideFor(results, { stopHookActive: true }), 'a Stop hook must not block twice on a turn')
	})

	it('does not block when this exact failure was already reported', () => {
		const results = [fail('lint', LINT, 'boom')]
		assertPassed(decideFor(results, { alreadyBlocked: [failureSignature(results)] }))
	})

	it('does not block on a reported failure listed among other signatures', () => {
		const results = [fail('lint', LINT, 'boom')]
		const blocked = ['sig-of-something-else', failureSignature(results), 'another']
		assertPassed(decideFor(results, { alreadyBlocked: blocked }))
	})

	it('does not block when the reported failure arrives in a different order', () => {
		const a = fail('lint', LINT, 'boom')
		const b = fail('typecheck', TYPECHECK, 'bang')
		assertPassed(decideFor([b, a], { alreadyBlocked: [failureSignature([a, b])] }))
	})

	it('does not block when only a newly passing sibling differs from the reported set', () => {
		const reported = [fail('lint', LINT, 'boom')]
		const now = [fail('lint', LINT, 'boom'), pass('typecheck', TYPECHECK)]
		assertPassed(
			decideFor(now, { alreadyBlocked: [failureSignature(reported)] }),
			'a newly passing sibling does not make the same failure new',
		)
	})

	it('treats an absent stopHookActive as false', () => {
		assertBlocked(decideFor([fail('lint', LINT, 'boom')]), 'an unset guard must not suppress the first block')
	})
})

describe('decide — when to block', () => {
	it('blocks on a single failure', () => {
		assertBlocked(decideFor([fail('lint', LINT, 'boom')]))
	})

	it('blocks when one of several results fails', () => {
		assertBlocked(decideFor([pass('lint', LINT), fail('typecheck', TYPECHECK, 'TS2345')]))
	})

	it('blocks when the loop guard is explicitly false', () => {
		assertBlocked(decideFor([fail('lint', LINT, 'boom')], { stopHookActive: false }))
	})

	it('blocks when alreadyBlocked holds only unrelated signatures', () => {
		assertBlocked(decideFor([fail('lint', LINT, 'boom')], { alreadyBlocked: ['unrelated'] }))
	})

	it('blocks again when the failure set grew', () => {
		const first = [fail('lint', LINT, 'boom')]
		const second = [...first, fail('typecheck', TYPECHECK, 'TS2345')]
		assertBlocked(
			decideFor(second, { alreadyBlocked: [failureSignature(first)] }),
			'a new failure is news, even if an old one was already reported',
		)
	})

	it('blocks again when the failure output changed', () => {
		const before = [fail('lint', LINT, 'one error')]
		const after = [fail('lint', LINT, 'two errors')]
		assertBlocked(decideFor(after, { alreadyBlocked: [failureSignature(before)] }))
	})

	it('decides the same way for every trigger', () => {
		const results = [fail('lint', LINT, 'boom')]
		for (const trigger of ['PostToolUse', 'Stop', 'TeammateIdle'] as const) {
			assertBlocked(decideFor(results, { trigger }), `${trigger} must block on a real failure`)
		}
	})

	it('tolerates an empty alreadyBlocked list', () => {
		assertBlocked(decideFor([fail('lint', LINT, 'boom')], { alreadyBlocked: [] }))
	})
})

/**
 * `decide` is the only function here that can block, so an input it does not
 * recognize must not produce one. This is also the only place the trigger
 * parameter matters — for recognized triggers the decision is trigger-independent.
 */
describe('decide — fails open on an unrecognized trigger', () => {
	const results = [fail('lint', LINT, 'boom')]

	function decideWithTrigger(trigger: unknown): Decision {
		return decide({ trigger: trigger as Trigger, results, alreadyBlocked: [] })
	}

	const unrecognized: Array<[string, unknown]> = [
		['an unknown name', 'Nope'],
		['a lowercase Stop', 'stop'],
		['a differently cased TeammateIdle', 'teammateidle'],
		['a trailing space', 'Stop '],
		['an empty string', ''],
		['undefined', undefined],
		['null', null],
		['a number', 42],
		['an object', {}],
		['an array of triggers', ['Stop']],
		['a boolean', true],
	]

	for (const [label, trigger] of unrecognized) {
		it(`does not block for ${label}`, () => {
			assert.deepEqual(decideWithTrigger(trigger), { block: false }, `${JSON.stringify(trigger)} must fail open`)
		})
	}

	it('still blocks for each recognized trigger', () => {
		for (const trigger of ['PostToolUse', 'Stop', 'TeammateIdle'] as const) {
			assertBlocked(decideWithTrigger(trigger), `${trigger} is recognized and must still block`)
		}
	})

	it('matches the trigger exactly, not by prefix or substring', () => {
		assertPassed(decideWithTrigger('Stopped'), 'a longer name that starts with Stop is not Stop')
		assertPassed(decideWithTrigger('PreStop'), 'a longer name that ends with Stop is not Stop')
	})
})

describe('decide — the block reason', () => {
	const lintFail = fail('lint', LINT, 'src/a.ts:1:1  error  no-unused-vars')
	const typeFail = fail('typecheck', TYPECHECK, 'src/b.ts(3,5): error TS2345')

	it('names the failing command and includes its output', () => {
		const reason = assertBlocked(decideFor([lintFail]))
		assert.ok(reason.includes(LINT), `reason must name the command that failed:\n${reason}`)
		assert.ok(reason.includes(lintFail.output), `reason must include the failure output:\n${reason}`)
	})

	it('covers every failing command, not just the first', () => {
		const reason = assertBlocked(decideFor([lintFail, typeFail]))
		for (const r of [lintFail, typeFail]) {
			assert.ok(reason.includes(r.command), `reason must name ${r.name}'s command:\n${reason}`)
			assert.ok(reason.includes(r.output), `reason must include ${r.name}'s output:\n${reason}`)
		}
	})

	it('reports the failure among passing siblings', () => {
		const passing = pass('lint', LINT, 'ALL-GOOD-NOISE')
		const reason = assertBlocked(decideFor([passing, typeFail]))
		assert.ok(reason.includes(typeFail.output), 'the failure output must be there')
		assert.equal(reason.includes('ALL-GOOD-NOISE'), false, 'a passing command output is noise, not a defect')
	})

	it('carries a multi-line output through intact', () => {
		const multi = fail('lint', LINT, 'src/a.ts\n  1:1  error  no-unused-vars\n  2:9  error  eqeqeq')
		const reason = assertBlocked(decideFor([multi]))
		assert.ok(reason.includes(multi.output), 'the agent must not have to re-run to see the errors')
	})

	it('still reads as a sentence when the failing command produced no output', () => {
		const silent = fail('typecheck', TYPECHECK, '')
		const reason = assertBlocked(decideFor([silent]))
		assert.ok(reason.includes(TYPECHECK), `reason must still name the command:\n${reason}`)
		assert.ok(reason.trim().length > TYPECHECK.length, 'a bare command string is not an explanation')
	})
})
