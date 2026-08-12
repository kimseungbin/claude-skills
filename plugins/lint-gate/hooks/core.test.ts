import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

import {
	commandsFor,
	decide,
	failureSignature,
	formatCommand,
	resolveConfig,
	scopeCommands,
	tracksEditedFiles,
	usesEditedFiles,
} from './core.ts'
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
 * Runs a built command through a real shell and returns what it printed. Every
 * base here is `printf [%s]`, so a correctly quoted path yields exactly `[path]`
 * and a correctly quoted list of N paths yields `[a][b]…`: one argument each,
 * nothing split, nothing else executed. Style-agnostic — it checks the quoting
 * works, not which quoting was chosen.
 */
function runInShell(cmd: string): string {
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

/** What a shell sees for the one path a format command is built around. */
function shellSees(base: string, filePath: string): string {
	return runInShell(formatCommand(base, filePath))
}

/** What a shell sees for the path list a `{files}` command is narrowed to. */
function shellSeesScoped(base: string, editedFiles: unknown[]): string {
	const [entry] = scopeCommands([{ name: 'lint', command: base }], editedFiles as string[])
	assert.ok(entry, `scopeCommands dropped a command it was supposed to fill: ${base}`)
	return runInShell(entry.command)
}

function assertPathSurvivesShell(filePath: string, message?: string): void {
	assert.equal(shellSees('printf [%s]', filePath), `[${filePath}]`, message ?? `path mangled or unquoted: ${filePath}`)
}

/**
 * Three distinct ways a path can escape its quoting: word splitting, breaking the
 * quoting scheme itself, and outright execution.
 *
 * Every path in this file funnels into the same `shellQuote`, so only the sweep
 * below re-proves that function against the full table. The suites that reach it
 * through a second route — a placeholder, a joined list — use these three, because
 * what those suites are actually asserting is that the route reaches `shellQuote`
 * at all, and a route that mangles a space mangles a backtick too.
 */
const REPRESENTATIVE_PATHS: Array<[string, string]> = [
	['a space', '/tmp/my file.ts'],
	['a single quote', "/tmp/it's.ts"],
	['command substitution', '/tmp/a$(echo pwned).ts'],
]

/**
 * A path is also a replacement string as far as `String.prototype.replace` is
 * concerned: with a replacement string rather than a callback, `$&` re-inserts the
 * token that was just consumed and `$1` inserts an empty string. Swept everywhere
 * a token is substituted, since that grammar only exists on those routes and no
 * amount of shell quoting protects against it.
 */
const REPLACEMENT_PATTERN_PATHS: Array<[string, string]> = [
	['a regex replacement pattern', '/tmp/a$&b.ts'],
	['a regex capture reference', '/tmp/a$1b.ts'],
	['every replacement pattern at once', "/tmp/a$&$1$`$'$$b.ts"],
]

/** Every path a tool payload can legitimately carry that also means something to a shell. */
const HOSTILE_PATHS: Array<[string, string]> = [
	...REPRESENTATIVE_PATHS,
	['a double quote', '/tmp/a"b.ts'],
	['a semicolon', '/tmp/a;echo pwned;.ts'],
	['a command separator', '/tmp/a && echo pwned.ts'],
	['a pipe', '/tmp/a | echo pwned.ts'],
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
	...REPLACEMENT_PATTERN_PATHS,
]

/** The representatives plus the paths that only a substituted token can mangle. */
const SUBSTITUTED_PATHS: Array<[string, string]> = [...REPRESENTATIVE_PATHS, ...REPLACEMENT_PATTERN_PATHS]

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

describe('usesEditedFiles', () => {
	it('recognises the placeholder', () => {
		assert.equal(usesEditedFiles('eslint {files}'), true)
	})

	it('is indifferent to where the placeholder sits', () => {
		const commands = [
			'{files}',
			'{files} --cache',
			'eslint {files}',
			'eslint {files} --max-warnings 0',
			'eslint {files} {files}',
			'eslint --ext .ts {files}\n',
		]
		for (const command of commands) {
			assert.equal(usesEditedFiles(command), true, `must be recognised in: ${JSON.stringify(command)}`)
		}
	})

	it('is false for a project-wide command', () => {
		assert.equal(usesEditedFiles(LINT), false)
		assert.equal(usesEditedFiles(TYPECHECK), false)
		assert.equal(usesEditedFiles(''), false)
	})

	/**
	 * The two tokens mean different things — one path versus every path this session
	 * — and this is what decides whether the session records edited paths at all. A
	 * per-file format command must not read as a request for the session's list.
	 */
	it('is not fooled by the singular {file}', () => {
		assert.equal(usesEditedFiles('prettier --write {file}'), false)
		assert.equal(usesEditedFiles('{file}'), false)
		assert.equal(usesEditedFiles('cmp -s {file} {file}'), false)
	})

	it('is false for a near miss', () => {
		const nearMisses = ['eslint { files }', 'eslint {FILES}', 'eslint {filess}', 'eslint {file}s', 'eslint $files', 'eslint files']
		for (const command of nearMisses) {
			assert.equal(usesEditedFiles(command), false, `must not be treated as scoped: ${command}`)
		}
	})
})

/**
 * Answered on every edit, before anything is recorded, so that accumulating paths
 * costs a project nothing unless one of its own checks asked to be scoped by them.
 * Derived from the Stop-time set rather than the raw config, so it cannot answer
 * yes for a command that would never run.
 */
describe('tracksEditedFiles', () => {
	it('is true when lint is scoped', () => {
		assert.equal(tracksEditedFiles({ lint: 'eslint {files}', typecheck: TYPECHECK }), true)
	})

	it('is true when typecheck is scoped', () => {
		assert.equal(tracksEditedFiles({ lint: LINT, typecheck: 'tsc --noEmit {files}' }), true)
	})

	it('is true when both are scoped', () => {
		assert.equal(tracksEditedFiles({ lint: 'eslint {files}', typecheck: 'tsc --noEmit {files}' }), true)
	})

	it('is true when a scoped lint is the only configured command', () => {
		assert.equal(tracksEditedFiles({ lint: 'eslint {files}' }), true)
	})

	/**
	 * `format` never runs at Stop, so nothing would ever consume the record — and
	 * `formatCommand` already fills `{files}` from the single path it is handed.
	 */
	it('is false when only format is scoped', () => {
		assert.equal(tracksEditedFiles({ format: 'prettier --write {files}' }), false)
		assert.equal(tracksEditedFiles({ format: 'prettier --write {files}', lint: LINT, typecheck: TYPECHECK }), false)
	})

	it('is false for project-wide Stop commands', () => {
		assert.equal(tracksEditedFiles(FULL), false)
		assert.equal(tracksEditedFiles({ lint: LINT }), false)
	})

	it('is false for an empty config', () => {
		assert.equal(tracksEditedFiles({}), false)
	})

	it('is false when the singular {file} is used at Stop time', () => {
		assert.equal(tracksEditedFiles({ lint: 'eslint {file}' }), false)
	})

	/**
	 * A string holding `{files}` can never itself be blank, so the reachable case is
	 * a value `commandsFor` drops for another reason. Asking the Stop-time set
	 * rather than the config is what makes that fall out for free.
	 */
	it('is false for a scoped command commandsFor would drop', () => {
		assert.equal(tracksEditedFiles({ lint: ['eslint', '{files}'] as unknown as string }), false)
		assert.equal(tracksEditedFiles({ lint: 42 as unknown as string, typecheck: '  ' }), false)
		assert.equal(tracksEditedFiles(resolveConfig({ lint: { cmd: 'eslint {files}' } })), false)
	})

	it('agrees with the Stop-time command set for every config', () => {
		const configs: GateConfig[] = [
			{},
			FULL,
			{ lint: 'eslint {files}' },
			{ typecheck: 'tsc --noEmit {files}' },
			{ format: 'prettier --write {files}' },
			{ format: 'prettier --write {files}', lint: LINT },
			{ lint: '  ', typecheck: 'tsc {files}' },
		]
		for (const config of configs) {
			const expected = commandsFor('Stop', config).some((c) => usesEditedFiles(c.command))
			assert.equal(tracksEditedFiles(config), expected, `disagreed for ${JSON.stringify(config)}`)
		}
	})

	/** As with `commandsFor`, a resolved junk config answers rather than throwing. */
	it('is false for a resolved junk config', () => {
		for (const junk of [null, undefined, 'lint: eslint {files}', 42, [], ['eslint {files}']]) {
			assert.equal(tracksEditedFiles(resolveConfig(junk)), false, `must degrade for ${JSON.stringify(junk)}`)
		}
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

	/**
	 * A format command written with `{files}` is honored rather than corrected: it
	 * runs once per edit, so the list it asks for is the one file being formatted.
	 */
	describe('a base written with the plural {files}', () => {
		it('substitutes the one path being formatted', () => {
			assert.equal(shellSees('printf [%s] {files}', 'src/a.ts'), '[src/a.ts]')
		})

		/**
		 * Whole tokens only: matching `{file}` inside `{files}` would consume the
		 * plural's head and leave its `s}` tail behind as a stray shell argument.
		 */
		it('leaves no token and no stray tail behind', () => {
			const cmd = formatCommand('prettier --write {files}', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{files?\}/, 'the placeholder must be consumed')
			assert.doesNotMatch(cmd, /s\}/, 'no fragment of the plural token may survive as a stray argument')
			assert.equal(cmd.split('src/a.ts').length - 1, 1, 'the path must appear once, not substituted and appended')
		})

		it('keeps the text on both sides of the placeholder', () => {
			const cmd = formatCommand('prettier --write {files} --log-level warn', 'src/a.ts')
			assert.match(cmd, /^prettier --write /)
			assert.match(cmd, / --log-level warn$/, 'the tail of the base must survive')
		})

		it('substitutes every occurrence', () => {
			assert.equal(shellSees('printf [%s] {files} {files}', 'src/a.ts'), '[src/a.ts][src/a.ts]')
		})

		it('fills both tokens when a base uses each', () => {
			const cmd = formatCommand('cmp -s {file} {files}', 'src/a.ts')
			assert.doesNotMatch(cmd, /\{files?\}/)
			assert.doesNotMatch(cmd, /s\}/)
			assert.equal(cmd.split('src/a.ts').length - 1, 2, 'both placeholders must be filled')
			assert.equal(shellSees('printf [%s] {file} {files}', 'src/a.ts'), '[src/a.ts][src/a.ts]')
		})

		/**
		 * Regression — the tokens were once filled in two passes, and an edited path
		 * may itself contain the literal `{file}`. The second pass read that as a
		 * placeholder and substituted into the middle of the quoted string the first
		 * pass had just inserted, closing the quotes and leaving the remainder of the
		 * path as live shell text: an injection, not merely a wrong path. What protects
		 * against it is that a replacement is never rescanned — one pass over the
		 * original base. `scopeCommands` never rescanned and was never affected.
		 */
		it('does not re-fill a {file} that arrived inside the path', () => {
			assertPathSurvivesShell('/tmp/{file}/a.ts')
			assert.equal(shellSees('printf [%s] {files}', '/tmp/{file}/a.ts'), '[/tmp/{file}/a.ts]')
			assert.equal(shellSees('printf [%s] {file}', '/tmp/{file}/a.ts'), '[/tmp/{file}/a.ts]', 'the {file} base is fine')
		})

		it('does not re-fill a {files} that arrived inside the path', () => {
			assert.equal(shellSees('printf [%s] {file}', '/tmp/{files}/a.ts'), '[/tmp/{files}/a.ts]')
			assert.equal(shellSees('printf [%s] {files}', '/tmp/{files}/a.ts'), '[/tmp/{files}/a.ts]')
		})

		it('does not execute a command hidden behind a {file} in the path', () => {
			// A marker file, because the injected command's own output would be
			// indistinguishable from the path text printf echoes back.
			const marker = `${SANDBOX}/injected-through-files-token`
			const filePath = `/tmp/a{file};touch ${marker}`
			const out = shellSees('printf [%s] {files}', filePath)
			assert.equal(existsSync(marker), false, 'the injected command must never run')
			assert.equal(out, `[${filePath}]`)
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
		for (const [label, filePath] of HOSTILE_PATHS) {
			it(`survives ${label} when appended`, () => {
				assertPathSurvivesShell(filePath)
			})
		}

		for (const [label, filePath] of SUBSTITUTED_PATHS) {
			it(`survives ${label} when substituted into {file}`, () => {
				assert.equal(shellSees('printf [%s] {file}', filePath), `[${filePath}]`, `path mangled: ${filePath}`)
			})
		}

		for (const [label, filePath] of SUBSTITUTED_PATHS) {
			it(`survives ${label} when substituted into {files}`, () => {
				assert.equal(shellSees('printf [%s] {files}', filePath), `[${filePath}]`, `path mangled: ${filePath}`)
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

		/**
		 * Repeated rather than merely compared twice: a module-level `/g` regex carries
		 * `lastIndex` across calls if it is ever driven by `.test()` or `.exec()`, which
		 * makes every other call resume mid-string and miss the token — a bug that hides
		 * from any single call and from any pair of calls on different bases.
		 */
		it('answers the same for a token base however many times it is called', () => {
			for (const base of ['prettier --write {file}', 'prettier --write {files}', 'cmp -s {file} {files}']) {
				const first = formatCommand(base, 'src/a.ts')
				assert.doesNotMatch(first, /\{files?\}/, `the placeholder must be consumed: ${base}`)
				for (let call = 2; call <= 5; call++) {
					assert.equal(formatCommand(base, 'src/a.ts'), first, `call ${call} of ${base} differed from the first`)
				}
			}
		})
	})
})

describe('scopeCommands', () => {
	const SCOPED_LINT = 'eslint {files}'
	const scoped = { name: 'lint', command: SCOPED_LINT }
	const wide = { name: 'typecheck', command: TYPECHECK }

	describe('narrowing a scoped command', () => {
		it('substitutes the one edited path', () => {
			assert.equal(shellSeesScoped('printf [%s] {files}', ['src/a.ts']), '[src/a.ts]')
		})

		it('substitutes several paths as separate arguments, in order', () => {
			assert.equal(
				shellSeesScoped('printf [%s] {files}', ['src/a.ts', 'src/b.ts', 'src/c.ts']),
				'[src/a.ts][src/b.ts][src/c.ts]',
			)
		})

		it('substitutes every occurrence', () => {
			assert.equal(shellSeesScoped('printf [%s] {files} {files}', ['src/a.ts', 'src/b.ts']), '[src/a.ts][src/b.ts][src/a.ts][src/b.ts]')
		})

		it('consumes the placeholder', () => {
			const [entry] = scopeCommands([scoped], ['src/a.ts'])
			assert.doesNotMatch(entry.command, /\{files\}/, 'a placeholder reaching the shell is a literal argument')
			assert.ok(entry.command.includes('src/a.ts'), `the path must be in the command: ${entry.command}`)
		})

		it('keeps the text on both sides of the placeholder', () => {
			const [entry] = scopeCommands([{ name: 'lint', command: 'eslint --max-warnings 0 {files} --cache' }], ['src/a.ts'])
			assert.match(entry.command, /^eslint --max-warnings 0 /)
			assert.match(entry.command, / --cache$/, 'the tail of the command must survive')
		})

		it('keeps the name of the command it narrowed', () => {
			assert.deepEqual(scopeCommands([scoped, wide], ['src/a.ts']).map((c) => c.name), ['lint', 'typecheck'])
		})

		it('preserves command order', () => {
			const commands = commandsFor('Stop', { lint: SCOPED_LINT, typecheck: 'tsc --noEmit {files}' })
			assert.deepEqual(scopeCommands(commands, ['src/a.ts']).map((c) => c.name), ['lint', 'typecheck'])
		})

		it('carries exactly a name and a command', () => {
			for (const entry of scopeCommands([scoped, wide], ['src/a.ts'])) {
				assert.deepEqual(Object.keys(entry).sort(), ['command', 'name'], `${entry.name} leaked an extra key`)
			}
		})

		it('narrows what tracksEditedFiles promised would be narrowed', () => {
			const config: GateConfig = { format: 'prettier --write {file}', lint: SCOPED_LINT, typecheck: TYPECHECK }
			assert.equal(tracksEditedFiles(config), true)

			const [lint, typecheck] = scopeCommands(commandsFor('Stop', config), ['src/a.ts'])
			assert.doesNotMatch(lint.command, /\{files\}/)
			assert.equal(typecheck.command, TYPECHECK, 'the project-wide sibling is not the one being narrowed')
		})
	})

	/**
	 * Today's behavior for a project that never asked for scoping. A command without
	 * the placeholder is project-wide by choice, so nothing about it changes — not
	 * even when the session edited nothing.
	 */
	describe('a command without the placeholder passes through untouched', () => {
		it('leaves the command string alone', () => {
			assert.deepEqual(scopeCommands([wide], ['src/a.ts']), [wide])
		})

		it('leaves it alone for an empty list too', () => {
			assert.deepEqual(scopeCommands([wide], []), [wide])
		})

		it('leaves a whole project-wide config alone', () => {
			const commands = commandsFor('Stop', FULL)
			assert.deepEqual(scopeCommands(commands, ['src/a.ts']), commands)
			assert.deepEqual(scopeCommands(commands, []), commands)
		})

		/**
		 * The singular `{file}` is documented as format-only — there is no single
		 * path at Stop time — so the command string is passed through as the project
		 * wrote it rather than guessed at.
		 */
		it('leaves a singular {file} verbatim rather than guessing', () => {
			const perFile = { name: 'lint', command: 'eslint {file}' }
			assert.deepEqual(scopeCommands([perFile], ['src/a.ts', 'src/b.ts']), [perFile])
			assert.deepEqual(scopeCommands([perFile], []), [perFile], 'it is not scoped, so an empty list does not drop it')
		})
	})

	/**
	 * A linter handed no path argument silently checks nothing under some configs and
	 * errors under others; neither is a useful gate result, and nothing was edited,
	 * so nothing is owed.
	 */
	describe('an empty list drops the command rather than running it bare', () => {
		it('drops a scoped command when nothing was edited', () => {
			assert.deepEqual(scopeCommands([scoped], []), [])
		})

		it('drops every scoped command but keeps the project-wide sibling', () => {
			const commands = [scoped, wide, { name: 'other', command: 'check {files} --strict' }]
			assert.deepEqual(scopeCommands(commands, []), [wide])
		})

		it('drops the command wherever the placeholder sits in it', () => {
			for (const command of ['{files}', 'eslint {files}', 'eslint {files} --cache', 'eslint {files} {files}']) {
				assert.deepEqual(scopeCommands([{ name: 'lint', command }], []), [], `must drop: ${command}`)
			}
		})

		it('never emits a command still holding the placeholder', () => {
			const commands = [scoped, wide]
			for (const files of [[], ['src/a.ts'], ['src/a.ts', 'src/b.ts']]) {
				for (const entry of scopeCommands(commands, files)) {
					assert.doesNotMatch(entry.command, /\{files\}/, `unfilled placeholder for ${JSON.stringify(files)}`)
				}
			}
		})
	})

	describe('deduping', () => {
		it('lists a repeated path once', () => {
			assert.equal(shellSeesScoped('printf [%s] {files}', ['src/a.ts', 'src/a.ts']), '[src/a.ts]')
		})

		it('keeps first-seen order while deduping', () => {
			assert.equal(
				shellSeesScoped('printf [%s] {files}', ['src/b.ts', 'src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']),
				'[src/b.ts][src/a.ts][src/c.ts]',
			)
		})

		it('does not conflate distinct paths that share a basename', () => {
			assert.equal(shellSeesScoped('printf [%s] {files}', ['src/a.ts', 'test/a.ts']), '[src/a.ts][test/a.ts]')
		})
	})

	/**
	 * This runs inside a hook, so a throw is the one unacceptable outcome: junk must
	 * cost the session a check, never the session itself.
	 */
	describe('fail open — junk degrades, never throws', () => {
		const notArrays: Array<[string, unknown]> = [
			['null', null],
			['undefined', undefined],
			['a string', 'src/a.ts'],
			['a number', 42],
			['a boolean', true],
			['an object', { 0: 'src/a.ts', length: 1 }],
		]

		for (const [label, value] of notArrays) {
			it(`yields no commands when commands is ${label}`, () => {
				assert.deepEqual(scopeCommands(value as never, ['src/a.ts']), [])
			})

			it(`treats ${label} as no edited files`, () => {
				assert.deepEqual(scopeCommands([scoped, wide], value as never), [wide])
			})
		}

		it('discards non-string and empty entries from the list', () => {
			assert.equal(
				shellSeesScoped('printf [%s] {files}', ['src/a.ts', '', null, 42, undefined, {}, [], 'src/b.ts']),
				'[src/a.ts][src/b.ts]',
			)
		})

		it('drops the command when every entry is junk', () => {
			assert.deepEqual(scopeCommands([scoped], ['', null, undefined, 0, {}] as never), [])
		})

		it('survives junk on both arguments at once', () => {
			assert.deepEqual(scopeCommands(null as never, null as never), [])
		})

		it('returns an array even for nothing at all', () => {
			assert.deepEqual(scopeCommands([], []), [])
		})
	})

	describe('shell quoting the list — a mistake here is a shell injection', () => {
		for (const [label, filePath] of SUBSTITUTED_PATHS) {
			it(`survives ${label} as the only edited file`, () => {
				assert.equal(shellSeesScoped('printf [%s] {files}', [filePath]), `[${filePath}]`, `path mangled: ${filePath}`)
			})
		}

		for (const [label, filePath] of REPRESENTATIVE_PATHS) {
			it(`survives ${label} beside ordinary paths`, () => {
				assert.equal(
					shellSeesScoped('printf [%s] {files}', ['src/a.ts', filePath, 'src/b.ts']),
					`[src/a.ts][${filePath}][src/b.ts]`,
					`path mangled among siblings: ${filePath}`,
				)
			})
		}

		it('keeps each path a single argument when several contain spaces', () => {
			assert.equal(
				shellSeesScoped('printf [%s] {files}', ['/tmp/my file.ts', '/tmp/other file.ts']),
				'[/tmp/my file.ts][/tmp/other file.ts]',
			)
		})

		it('does not execute a command injected from anywhere in the list', () => {
			const out = shellSeesScoped('printf [%s] {files}', ['src/a.ts', '/tmp/x; echo pwned', 'src/b.ts'])
			assert.doesNotMatch(out, /pwned$/m, 'the injected echo must never run')
			assert.equal(out, '[src/a.ts][/tmp/x; echo pwned][src/b.ts]')
		})

		it('leaves no raw path in the built command', () => {
			const [entry] = scopeCommands([scoped], ['/tmp/my file.ts'])
			assert.doesNotMatch(entry.command, /(^|\s)\/tmp\/my file\.ts(\s|$)/, 'a bare path with a space is two arguments')
		})

		/** Either token, because a filled-in path must never be rescanned for either. */
		it('does not treat a token inside a path as a placeholder', () => {
			assert.equal(shellSeesScoped('printf [%s] {files}', ['/tmp/{files}/a.ts']), '[/tmp/{files}/a.ts]')
			assert.equal(shellSeesScoped('printf [%s] {files}', ['/tmp/{file}/a.ts']), '[/tmp/{file}/a.ts]')
			assert.equal(
				shellSeesScoped('printf [%s] {files}', ['/tmp/{file}/a.ts', '/tmp/{files}/b.ts']),
				'[/tmp/{file}/a.ts][/tmp/{files}/b.ts]',
			)
		})
	})

	it('does not mutate its inputs', () => {
		const commands = [{ name: 'lint', command: SCOPED_LINT }, { name: 'typecheck', command: TYPECHECK }]
		const editedFiles = ['src/b.ts', 'src/a.ts', 'src/b.ts']
		const commandsSnapshot = structuredClone(commands)
		const filesSnapshot = structuredClone(editedFiles)

		scopeCommands(commands, editedFiles)

		assert.deepEqual(commands, commandsSnapshot, 'narrowing must build new entries, not rewrite the caller ones')
		assert.deepEqual(editedFiles, filesSnapshot, 'deduping must not reorder or shrink the caller list')
	})

	it('is pure — the same inputs give the same result', () => {
		assert.deepEqual(scopeCommands([scoped], ['src/a.ts']), scopeCommands([scoped], ['src/a.ts']))
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
