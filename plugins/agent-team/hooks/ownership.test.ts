import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { decide, globToRegExp, relativize } from './ownership.ts'
import type { Decision, OwnershipMap } from './ownership.ts'

const CWD = '/home/u/proj'

const MAP: OwnershipMap = {
	$comment: ['**/*.md', 'this key is documentation, not a role'],
	'test-writer': ['**/*.test.*', '**/*.spec.*', 'test/**', 'tests/**', '__tests__/**'],
	'docs-writer': ['docs/**', '!docs/internal/**'],
}

function decideFor(
	agentType: string | undefined,
	filePath: string | undefined,
	map: OwnershipMap = MAP,
	cwd: string | undefined = CWD,
): Decision {
	return decide({ agentType, filePath, cwd, map })
}

function assertAllowed(d: Decision, message?: string): void {
	assert.equal(d.allow, true, message ?? `expected allow, got deny: ${JSON.stringify(d)}`)
}

function assertDenied(d: Decision, message?: string): string {
	assert.equal(d.allow, false, message ?? 'expected deny, got allow')
	const reason = (d as { allow: false; reason: string }).reason
	assert.equal(typeof reason, 'string', 'denial must carry a string reason')
	assert.ok(reason.length > 0, 'denial reason must not be empty')
	return reason
}

describe('globToRegExp', () => {
	it('anchors at both ends', () => {
		const re = globToRegExp('src/main.ts')
		assert.equal(re.test('src/main.ts'), true)
		assert.equal(re.test('vendor/src/main.ts'), false, 'must not match as a suffix')
		assert.equal(re.test('src/main.ts.bak'), false, 'must not match as a prefix')
	})

	it('is stateless across repeated calls (no global flag)', () => {
		const re = globToRegExp('**/*.test.ts')
		assert.equal(re.test('src/a.test.ts'), true)
		assert.equal(re.test('src/a.test.ts'), true, 'second .test() must agree with the first')
		assert.equal(re.global, false, 'a `g` flag makes .test() alternate via lastIndex')
	})

	describe('* — one segment, never crosses /', () => {
		it('matches within a segment', () => {
			const re = globToRegExp('src/*.ts')
			assert.equal(re.test('src/main.ts'), true)
			assert.equal(re.test('src/a.ts'), true)
		})

		it('does not cross a slash', () => {
			const re = globToRegExp('src/*.ts')
			assert.equal(re.test('src/nested/main.ts'), false)
		})

		it('matches an empty run within a segment', () => {
			const re = globToRegExp('src/*.ts')
			assert.equal(re.test('src/.ts'), true)
		})

		it('handles a bare leading * as one segment', () => {
			const re = globToRegExp('*.md')
			assert.equal(re.test('README.md'), true)
			assert.equal(re.test('docs/README.md'), false)
		})
	})

	describe('** — any depth, including zero segments', () => {
		it('matches zero intervening segments', () => {
			const re = globToRegExp('**/*.test.ts')
			assert.equal(re.test('a.test.ts'), true, '**/ must be able to match nothing at all')
		})

		it('matches one segment', () => {
			assert.equal(globToRegExp('**/*.test.ts').test('src/a.test.ts'), true)
		})

		it('matches many segments', () => {
			assert.equal(globToRegExp('**/*.test.ts').test('a/b/c/d/e.test.ts'), true)
		})

		it('matches any depth as a trailing wildcard', () => {
			const re = globToRegExp('test/**')
			assert.equal(re.test('test/a.ts'), true)
			assert.equal(re.test('test/deep/nested/a.ts'), true)
			assert.equal(re.test('tests/a.ts'), false, 'must not bleed into a sibling directory')
			assert.equal(re.test('src/test/a.ts'), false, 'must stay anchored at the start')
		})

		it('matches in the middle of a pattern', () => {
			const re = globToRegExp('src/**/fixtures/*.json')
			assert.equal(re.test('src/fixtures/a.json'), true, 'zero segments in the middle')
			assert.equal(re.test('src/a/b/fixtures/c.json'), true)
			assert.equal(re.test('src/a/b/fixtures/deep/c.json'), false, 'the trailing * is one segment')
		})
	})

	describe('? — exactly one character', () => {
		it('matches exactly one character', () => {
			const re = globToRegExp('src/a?c.ts')
			assert.equal(re.test('src/abc.ts'), true)
			assert.equal(re.test('src/ac.ts'), false, '? must not match the empty string')
			assert.equal(re.test('src/abbc.ts'), false, '? must not match two characters')
		})

		it('does not cross a slash', () => {
			assert.equal(globToRegExp('src?main.ts').test('src/main.ts'), false)
		})
	})

	describe('literals — everything else is not regex syntax', () => {
		it('treats . as a literal dot', () => {
			const re = globToRegExp('src/a.ts')
			assert.equal(re.test('src/a.ts'), true)
			assert.equal(re.test('src/axts'), false, '. must not match an arbitrary character')
		})

		it('treats parentheses as literals', () => {
			const re = globToRegExp('docs/(draft)/notes.md')
			assert.equal(re.test('docs/(draft)/notes.md'), true)
			assert.equal(re.test('docs/draft/notes.md'), false, 'parens must not form a group')
		})

		it('treats brackets as literals', () => {
			const re = globToRegExp('src/[abc].ts')
			assert.equal(re.test('src/[abc].ts'), true)
			assert.equal(re.test('src/a.ts'), false, 'brackets must not form a character class')
		})

		it('treats + as a literal plus', () => {
			const re = globToRegExp('src/a+.ts')
			assert.equal(re.test('src/a+.ts'), true)
			assert.equal(re.test('src/aa.ts'), false, '+ must not quantify')
		})

		it('treats ^ and $ as literals', () => {
			const re = globToRegExp('config/$comment^1.json')
			assert.equal(re.test('config/$comment^1.json'), true)
		})

		it('treats braces and pipes as literals', () => {
			const re = globToRegExp('src/{a,b}.ts')
			assert.equal(re.test('src/{a,b}.ts'), true)
			assert.equal(re.test('src/a.ts'), false, 'braces must not expand')
			assert.equal(globToRegExp('src/a|b.ts').test('src/a.ts'), false, '| must not alternate')
		})

		it('treats a backslash as a literal', () => {
			assert.equal(globToRegExp('src/a\\b.ts').test('src/a\\b.ts'), true)
		})

		it('escapes literals that sit next to wildcards', () => {
			const re = globToRegExp('**/*.test.*')
			assert.equal(re.test('src/a.test.ts'), true)
			assert.equal(re.test('src/a.test.tsx'), true)
			assert.equal(re.test('a.test.ts'), true)
			assert.equal(re.test('src/atest.ts'), false, 'the dots around `test` are literal')
			assert.equal(re.test('src/a.testx.ts'), false, 'the dot after `test` is literal')
		})

		it('keeps a path containing regex metacharacters matchable', () => {
			assert.equal(globToRegExp('**/*.test.*').test('src/a+b(c).test.ts'), true)
		})
	})
})

describe('relativize', () => {
	it('relativizes an absolute path inside cwd', () => {
		assert.deepEqual(relativize('/home/u/proj/src/a.ts', CWD), { rel: 'src/a.ts', outside: false })
	})

	it('resolves a relative path against cwd', () => {
		assert.deepEqual(relativize('src/a.ts', CWD), { rel: 'src/a.ts', outside: false })
	})

	it('strips a leading ./', () => {
		assert.deepEqual(relativize('./src/a.ts', CWD), { rel: 'src/a.ts', outside: false })
	})

	it('normalizes traversal that stays inside cwd', () => {
		assert.deepEqual(relativize('/home/u/proj/src/../lib/a.ts', CWD), { rel: 'lib/a.ts', outside: false })
	})

	it('normalizes traversal before judging, not after', () => {
		const { outside } = relativize('/home/u/proj/src/../../other/a.ts', CWD)
		assert.equal(outside, true, '.. escaping the project must be caught after normalization')
	})

	it('flags a relative path that traverses out', () => {
		assert.equal(relativize('../other/a.ts', CWD).outside, true)
	})

	it('flags an unrelated absolute path', () => {
		assert.equal(relativize('/etc/passwd', CWD).outside, true)
	})

	it('does not treat a sibling with a shared prefix as inside', () => {
		assert.equal(relativize('/home/u/project/a.ts', CWD).outside, true, 'prefix match is not containment')
		assert.equal(relativize('/home/u/proj-2/a.ts', CWD).outside, true)
	})

	it('tolerates a trailing slash on cwd', () => {
		assert.deepEqual(relativize('/home/u/proj/src/a.ts', '/home/u/proj/'), { rel: 'src/a.ts', outside: false })
	})

	it('keeps deep paths intact', () => {
		assert.equal(relativize('/home/u/proj/a/b/c/d.ts', CWD).rel, 'a/b/c/d.ts')
	})
})

describe('decide — who is constrained', () => {
	it('allows the lead, whose payload carries no agent_type', () => {
		assertAllowed(decideFor(undefined, '/home/u/proj/src/a.ts'))
	})

	it('allows the lead when agent_type is an empty string', () => {
		assertAllowed(decideFor('', '/home/u/proj/src/a.ts'))
	})

	it('allows the lead even for a path outside the project', () => {
		assertAllowed(decideFor(undefined, '/etc/hosts'), 'the lead is never constrained')
	})

	it('allows an agent type with no entry in the map', () => {
		assertAllowed(decideFor('reviewer', '/home/u/proj/src/a.ts'), 'unknown roles are unconstrained by design')
	})

	it('allows a namespaced type that does not match an unnamespaced key', () => {
		assertAllowed(decideFor('agent-team:test-writer', '/home/u/proj/src/a.ts'))
	})

	it('constrains a role that is in the map', () => {
		assertDenied(decideFor('test-writer', '/home/u/proj/src/a.ts'))
	})
})

describe('decide — $-prefixed keys are metadata, never roles', () => {
	it('does not treat $comment as a role', () => {
		assertAllowed(decideFor('$comment', '/home/u/proj/src/a.ts'), '$comment is documentation, not an entry')
	})

	it('does not let $-prefixed globs constrain a real role', () => {
		const map: OwnershipMap = { $schema: ['schema/**'], 'test-writer': ['test/**'] }
		assertAllowed(decideFor('test-writer', '/home/u/proj/test/a.ts', map))
		assertDenied(decideFor('test-writer', '/home/u/proj/schema/a.json', map))
	})

	it('allows any $-prefixed agent type', () => {
		assertAllowed(decideFor('$anything', '/home/u/proj/src/a.ts'))
	})
})

describe('decide — matching', () => {
	it('allows a path matching one of the role globs', () => {
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/a.test.ts'))
		assertAllowed(decideFor('test-writer', '/home/u/proj/tests/helpers/setup.ts'))
		assertAllowed(decideFor('test-writer', '/home/u/proj/__tests__/a.ts'))
	})

	it('allows a test file at the project root (** matching zero segments)', () => {
		assertAllowed(decideFor('test-writer', '/home/u/proj/a.test.ts'))
	})

	it('denies a path matching no glob', () => {
		assertDenied(decideFor('test-writer', '/home/u/proj/src/index.ts'))
		assertDenied(decideFor('test-writer', '/home/u/proj/README.md'))
	})

	it('denies a near miss on the literal parts of a glob', () => {
		assertDenied(decideFor('test-writer', '/home/u/proj/src/atest.ts'))
		assertDenied(decideFor('test-writer', '/home/u/proj/testing/a.ts'), '`test/**` must not match `testing/`')
	})

	it('matches against the path relative to cwd, not the absolute path', () => {
		const map: OwnershipMap = { 'test-writer': ['test/**'] }
		assertDenied(
			decideFor('test-writer', '/home/u/test/proj/src/a.ts', map, '/home/u/test/proj'),
			'`test/` in the absolute prefix must not satisfy the glob',
		)
		assertAllowed(decideFor('test-writer', '/home/u/test/proj/test/a.ts', map, '/home/u/test/proj'))
	})

	it('accepts a relative filePath', () => {
		assertAllowed(decideFor('test-writer', 'src/a.test.ts'))
		assertDenied(decideFor('test-writer', 'src/a.ts'))
	})

	it('denies everything when a role owns an empty glob list', () => {
		const map: OwnershipMap = { reviewer: [] }
		assertDenied(decideFor('reviewer', '/home/u/proj/src/a.ts', map), '[] is how a write-nothing role is spelled')
		assertDenied(decideFor('reviewer', '/home/u/proj/README.md', map))
		assertDenied(decideFor('reviewer', '/home/u/proj/a.test.ts', map))
	})
})

describe('decide — negation', () => {
	it('allows a path inside an owned glob and outside every negation', () => {
		assertAllowed(decideFor('docs-writer', '/home/u/proj/docs/guide.md'))
	})

	it('denies a path subtracted by a negation', () => {
		assertDenied(decideFor('docs-writer', '/home/u/proj/docs/internal/secrets.md'))
	})

	it('lets a negation win over a positive match regardless of order', () => {
		const negFirst: OwnershipMap = { role: ['!src/generated/**', 'src/**'] }
		const negLast: OwnershipMap = { role: ['src/**', '!src/generated/**'] }
		assertDenied(decideFor('role', '/home/u/proj/src/generated/api.ts', negFirst))
		assertDenied(decideFor('role', '/home/u/proj/src/generated/api.ts', negLast))
		assertAllowed(decideFor('role', '/home/u/proj/src/api.ts', negFirst))
	})

	it('denies everything when a role lists only negations', () => {
		const map: OwnershipMap = { role: ['!src/**'] }
		assertDenied(decideFor('role', '/home/u/proj/docs/a.md', map), 'a negation alone owns nothing')
	})

	it('applies negation glob syntax like any other glob', () => {
		const map: OwnershipMap = { role: ['src/**', '!**/*.gen.ts'] }
		assertDenied(decideFor('role', '/home/u/proj/src/deep/a.gen.ts', map))
		assertAllowed(decideFor('role', '/home/u/proj/src/deep/agen.ts', map))
	})
})

describe('decide — paths outside the project', () => {
	it('denies an absolute path outside cwd', () => {
		assertDenied(decideFor('test-writer', '/etc/a.test.ts'))
	})

	it('denies an escaping path even when it would otherwise match', () => {
		assertDenied(decideFor('test-writer', '/home/u/proj/../elsewhere/a.test.ts'))
	})

	it('denies a relative path that traverses out', () => {
		assertDenied(decideFor('test-writer', '../elsewhere/a.test.ts'))
	})

	it('gives a distinct reason for outside-the-project denials', () => {
		const outsideReason = assertDenied(decideFor('test-writer', '/etc/a.test.ts'))
		const ownershipReason = assertDenied(decideFor('test-writer', '/home/u/proj/src/a.ts'))
		assert.notEqual(outsideReason, ownershipReason, 'the two denials must read differently')
		assert.match(outsideReason, /outside/i, 'the reason should say the path is outside the project')
	})

	it('allows a path that traverses but lands back inside', () => {
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/../test/a.ts'))
	})
})

describe('decide — the denial reason', () => {
	it('names the role, the path, what the role owns, and the escalation route', () => {
		const reason = assertDenied(decideFor('test-writer', '/home/u/proj/src/index.ts'))
		assert.match(reason, /test-writer/, 'names the role')
		assert.match(reason, /src\/index\.ts/, 'names the offending path')
		assert.match(reason, /\*\*\/\*\.test\.\*/, 'lists what the role does own')
		assert.match(reason, /SendMessage/, 'directs the agent to report the need to the lead')
	})

	it('lists the owned globs of the role in question', () => {
		const map: OwnershipMap = { 'docs-writer': ['docs/**', '!docs/internal/**'] }
		const reason = assertDenied(decideFor('docs-writer', '/home/u/proj/src/a.ts', map))
		assert.match(reason, /docs\/\*\*/)
	})

	it('still reads as a sentence when the role owns nothing', () => {
		const reason = assertDenied(decideFor('reviewer', '/home/u/proj/src/a.ts', { reviewer: [] }))
		assert.match(reason, /It owns: \(nothing\)\./, 'an empty list needs a placeholder, not a bare separator')
		assert.doesNotMatch(reason, /It owns: ?\./, '`It owns: .` is a defect, not a sentence')
	})
})

describe('decide — fail open on an unusable map', () => {
	it('allows when the map is null', () => {
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/a.ts', null as unknown as OwnershipMap))
	})

	it('allows when the map is undefined', () => {
		const input = { agentType: 'test-writer', filePath: '/home/u/proj/src/a.ts', cwd: CWD }
		assertAllowed(decide(input as unknown as Parameters<typeof decide>[0]))
	})

	it('allows when the map is not an object', () => {
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/a.ts', 'nope' as unknown as OwnershipMap))
	})

	it('allows when the role value is a string rather than an array', () => {
		const map = { 'test-writer': 'test/**' } as unknown as OwnershipMap
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/a.ts', map))
	})

	it('allows when the role value is an object rather than an array', () => {
		const map = { 'test-writer': { globs: ['test/**'] } } as unknown as OwnershipMap
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/a.ts', map))
	})

	it('allows when the role value is null', () => {
		const map = { 'test-writer': null } as unknown as OwnershipMap
		assertAllowed(decideFor('test-writer', '/home/u/proj/src/a.ts', map))
	})

	it('allows when filePath is missing', () => {
		assertAllowed(decideFor('test-writer', undefined))
	})

	it('allows when cwd is missing', () => {
		assertAllowed(decide({ agentType: 'test-writer', filePath: '/home/u/proj/src/a.ts', cwd: undefined, map: MAP }))
	})

	it('ignores non-string entries inside an otherwise valid glob array', () => {
		const map = { 'test-writer': ['*.test.js', 42, null, {}] } as unknown as OwnershipMap
		assertAllowed(decideFor('test-writer', '/home/u/proj/a.test.js', map), 'the string glob must survive the junk')
		assertDenied(decideFor('test-writer', '/home/u/proj/src/index.ts', map), 'the junk must not match anything')
	})

	it('still enforces a healthy role when a sibling entry is malformed', () => {
		const map = { broken: 'oops', 'test-writer': ['test/**'] } as unknown as OwnershipMap
		assertDenied(decideFor('test-writer', '/home/u/proj/src/a.ts', map))
		assertAllowed(decideFor('broken', '/home/u/proj/src/a.ts', map))
	})
})

describe('decide — the shipped ownership map', () => {
	const shipped: OwnershipMap = {
		$comment: ['Ownership map: agent type -> globs that agent type may Edit/Write.'],
		'test-writer': ['**/*.test.*', '**/*.spec.*', 'test/**', 'tests/**', '__tests__/**'],
	}

	it('lets test-writer write this very file', () => {
		assertAllowed(
			decideFor('test-writer', '/home/u/proj/plugins/agent-team/hooks/ownership.test.ts', shipped),
		)
	})

	it('stops test-writer writing the implementation it tests', () => {
		assertDenied(decideFor('test-writer', '/home/u/proj/plugins/agent-team/hooks/ownership.ts', shipped))
	})

	it('stops test-writer editing the ownership map itself', () => {
		assertDenied(decideFor('test-writer', '/home/u/proj/plugins/agent-team/config/ownership.json', shipped))
	})
})
