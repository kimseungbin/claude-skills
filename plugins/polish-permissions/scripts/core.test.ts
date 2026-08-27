// These tests double as the specification. Each `describe` names a question the
// audit has to answer, and each `it` states the answer as a sentence — reading
// the names top to bottom should tell you what the tool does and, for the
// surprising rules, why it does that.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
	analyze,
	classify,
	coverageReaches,
	defaultConfig,
	extendConfig,
	families,
	familyOf,
	isSensitive,
	nearMiss,
	rulesFrom,
	sortRules,
	splitRule,
	subsumes,
	suggestWildcards,
} from './core.ts'
import type { Config, ListName, Rule, Scope } from './core.ts'

const CFG: Config = defaultConfig()

/** Builds a single rule the way `rulesFrom` would, for tests that only care
 *  about one rule at a time. */
function rule(raw: string, scope: Scope = 'local', list: ListName = 'allow'): Rule {
	const rules = rulesFrom({ permissions: { [list]: [raw] } }, scope, CFG)
	return rules[0]!
}

/** Builds the three scopes at once. Every value is an allow list unless the
 *  test passes a full permissions object. */
function scenario(input: {
	user?: string[] | object
	project?: string[] | object
	local?: string[] | object
}): Rule[] {
	const asSettings = (v: string[] | object | undefined) =>
		Array.isArray(v) ? { permissions: { allow: v } } : (v ?? {})
	return [
		...rulesFrom(asSettings(input.user), 'user', CFG),
		...rulesFrom(asSettings(input.project), 'project', CFG),
		...rulesFrom(asSettings(input.local), 'local', CFG),
	]
}

// ---------------------------------------------------------------------------

describe('reading a permission rule', () => {
	it('splits `Tool(specifier)` into the tool and what it is scoped to', () => {
		assert.deepEqual(splitRule('Bash(git status)'), { tool: 'Bash', spec: 'git status' })
	})

	it('treats a bare tool name as having no specifier, which means "all uses of it"', () => {
		assert.deepEqual(splitRule('Read'), { tool: 'Read', spec: null })
	})

	it('keeps parentheses that appear inside the specifier', () => {
		assert.deepEqual(splitRule('Bash(echo (hi))'), { tool: 'Bash', spec: 'echo (hi)' })
	})

	it('reads an MCP rule as one tool name, since it has no specifier syntax', () => {
		assert.deepEqual(splitRule('mcp__linear__create_issue'), {
			tool: 'mcp__linear__create_issue',
			spec: null,
		})
	})
})

describe('grouping rules into families', () => {
	// Families are the unit the skill asks the user about. Asking once per rule
	// would mean 80 questions; asking once per CLI is a handful.
	it('groups a Bash rule under the command it runs', () => {
		assert.equal(familyOf('Bash', 'gh issue view *'), 'Bash:gh')
	})

	it('ignores leading VAR=value assignments so they do not become the family', () => {
		assert.equal(familyOf('Bash', 'AWS_PROFILE=prod aws s3 ls'), 'Bash:aws')
	})

	it('groups MCP rules per server, not per individual tool', () => {
		assert.equal(familyOf('mcp__linear__create_issue', null), 'mcp__linear')
		assert.equal(familyOf('mcp__linear__list_issues', null), 'mcp__linear')
	})

	it('uses the tool name for everything else', () => {
		assert.equal(familyOf('WebSearch', null), 'WebSearch')
		assert.equal(familyOf('Edit', 'src/*'), 'Edit')
	})
})

describe('deciding whether one rule already covers another', () => {
	it('treats a wildcard rule as covering the narrower rules beneath it', () => {
		assert.equal(subsumes(rule('Bash(git *)'), rule('Bash(git status)')), true)
	})

	it('treats a bare tool rule as covering every scoped rule for that tool', () => {
		assert.equal(subsumes(rule('Read'), rule('Read(src/**)')), true)
	})

	it('does not let a rule cover itself', () => {
		assert.equal(subsumes(rule('Bash(git *)'), rule('Bash(git *)')), false)
	})

	it('never crosses tools', () => {
		assert.equal(subsumes(rule('Bash(git *)'), rule('Read(git)')), false)
	})

	it('covers a narrower wildcard as well as a literal', () => {
		// `git log *` only ever expands to strings `git *` also matches.
		assert.equal(subsumes(rule('Bash(git *)'), rule('Bash(git log *)')), true)
	})

	it('treats a whole-server MCP rule as covering that server’s individual tools', () => {
		// `mcp__<server>` grants every tool on the server, so writing one out
		// separately adds nothing. Found by auditing a real repo.
		assert.equal(
			subsumes(rule('mcp__aws-knowledge'), rule('mcp__aws-knowledge__aws___search_documentation')),
			true,
		)
	})

	it('does not let a single MCP tool rule cover its whole server', () => {
		assert.equal(
			subsumes(rule('mcp__aws-knowledge__aws___search_documentation'), rule('mcp__aws-knowledge')),
			false,
		)
	})

	it('does not let one server’s rule cover a different server whose name shares a prefix', () => {
		assert.equal(subsumes(rule('mcp__aws'), rule('mcp__aws_extra__thing')), false)
	})
})

describe('the wildcard that looks foldable but is not', () => {
	// This is the case the issue's original design would have got wrong.
	// `Bash(npm test *)` requires a space and at least one argument, so folding
	// `Bash(npm test)` into it silently removes permission to run bare `npm test`.
	it('reports a wildcard that covers the argument forms but not the bare command', () => {
		assert.equal(nearMiss(rule('Bash(npm test *)'), rule('Bash(npm test)')), true)
	})

	it('is not raised when the wildcard genuinely covers the bare command', () => {
		assert.equal(nearMiss(rule('Bash(npm*)'), rule('Bash(npm test)')), false)
	})

	it('is not raised for a rule against itself', () => {
		assert.equal(nearMiss(rule('Bash(gh issue view *)'), rule('Bash(gh issue view *)')), false)
	})
})

describe('which scope can justify deleting a rule in another scope', () => {
	// Scope reach is deliberately not a straight ladder. User scope spans every
	// project but only this person; project scope spans every collaborator but
	// only this repo. Neither contains the other.
	it('lets any scope justify deleting a local rule, because local reaches least far', () => {
		assert.equal(coverageReaches('user', 'local'), true)
		assert.equal(coverageReaches('project', 'local'), true)
		assert.equal(coverageReaches('local', 'local'), true)
	})

	it('refuses to delete a project rule on the strength of a user rule', () => {
		// The user copy is personal. Deleting the committed project copy would
		// revoke the grant for every collaborator while still working locally.
		assert.equal(coverageReaches('user', 'project'), false)
	})

	it('refuses to delete a user rule on the strength of a local rule', () => {
		// The local rule only applies in one repo; the user rule applies in all.
		assert.equal(coverageReaches('local', 'user'), false)
	})
})

describe('classifying a rule as read-only or mutating', () => {
	// Only rules provably read-only are ever recommended for promotion, because
	// promoting a mutating rule stops it prompting in every project at once.
	it('calls a safelisted inspection command read-only', () => {
		assert.equal(classify('Bash', 'git status', CFG), 'yes')
		assert.equal(classify('Bash', 'kubectl get pods', CFG), 'yes')
		assert.equal(classify('Bash', 'aws s3 list-buckets', CFG), 'yes')
	})

	it('calls a command containing a mutating verb mutating, even if it starts benign', () => {
		assert.equal(classify('Bash', 'git status && git push', CFG), 'no')
		assert.equal(classify('Bash', 'terraform apply', CFG), 'no')
	})

	it('treats an output redirect as mutating, since it writes a file', () => {
		assert.equal(classify('Bash', 'echo hi > out.txt', CFG), 'no')
	})

	it('refuses to call a broad wildcard read-only even when its command family is mostly safe', () => {
		// `git *` spans `git push` and `git reset --hard`. This is the rule the
		// issue specifically asked never to be treated as promotable.
		assert.equal(classify('Bash', 'git *', CFG), 'unknown')
	})

	it('calls bare Bash mutating, because it is every command there is', () => {
		assert.equal(classify('Bash', null, CFG), 'no')
	})

	it('calls a read-only tool read-only regardless of its specifier', () => {
		assert.equal(classify('Read', 'anything', CFG), 'yes')
		assert.equal(classify('WebSearch', null, CFG), 'yes')
	})

	it('calls a writing tool mutating', () => {
		assert.equal(classify('Edit', 'src/*', CFG), 'no')
	})

	it('leaves MCP tools unknown, because a tool name does not reveal its effect', () => {
		assert.equal(classify('mcp__linear__list_issues', null, CFG), 'unknown')
		assert.equal(classify('mcp__linear__create_issue', null, CFG), 'unknown')
	})

	it('leaves an unrecognised command unknown rather than guessing', () => {
		assert.equal(classify('Bash', 'mycli frobnicate', CFG), 'unknown')
	})

	// Every case below came from running the audit against a real repo, where
	// substring matching on the mutating verbs produced nonsense.
	describe('mutating verbs are matched per token, not as substrings', () => {
		it('does not read `codecommit` as the verb `commit`', () => {
			assert.equal(classify('Bash', 'aws codecommit list-repositories *', CFG), 'yes')
		})

		it('does not read `mcp` as the verb `cp`', () => {
			assert.equal(classify('Bash', 'claude mcp get *', CFG), 'unknown')
		})

		it('does not read `list-recovery-points-by-resource` as a mutating subcommand', () => {
			assert.equal(classify('Bash', 'aws backup list-recovery-points-by-resource *', CFG), 'yes')
		})

		it('still catches a bare mutating verb', () => {
			assert.equal(classify('Bash', 'aws s3 rm *', CFG), 'no')
			assert.equal(classify('Bash', 'git push origin main', CFG), 'no')
		})

		it('still catches a hyphenated mutating subcommand', () => {
			assert.equal(classify('Bash', 'aws ec2 terminate-instances *', CFG), 'no')
			assert.equal(classify('Bash', 'aws s3api put-object *', CFG), 'no')
			assert.equal(classify('Bash', 'aws cloudformation delete-stack *', CFG), 'no')
		})

		it('catches a mutating verb written with the prefix wildcard syntax', () => {
			// `Bash(cmd:*)` is Claude Code's prefix form; the suffix must not
			// hide the verb from the tokeniser.
			assert.equal(classify('Bash', 'aws s3 rm:*', CFG), 'no')
		})

		it('catches a mutating verb after a shell operator', () => {
			assert.equal(classify('Bash', 'git status && git push', CFG), 'no')
			assert.equal(classify('Bash', 'ls | xargs rm', CFG), 'no')
		})
	})
})

describe('reads that are safe to run but not safe to stop being asked about', () => {
	// The read-only safelist answers "does this change state". Promotion needs a
	// second answer: "is it safe to never be asked again, in every project".
	// These come apart on exfiltration, which is what this axis exists for.
	it('flags a secret read that mutates nothing', () => {
		assert.equal(isSensitive('Bash', 'aws secretsmanager get-secret-value *', CFG), true)
		assert.equal(isSensitive('Bash', 'aws ssm get-parameter --with-decryption *', CFG), true)
		assert.equal(isSensitive('Bash', 'aws iam get-credential-report', CFG), true)
		assert.equal(isSensitive('Bash', 'aws sts get-session-token', CFG), true)
	})

	it('flags credential material behind other CLIs', () => {
		assert.equal(isSensitive('Bash', 'kubectl get secret my-secret -o yaml', CFG), true)
		assert.equal(isSensitive('Bash', 'gh auth token', CFG), true)
		assert.equal(isSensitive('Bash', 'vault kv get secret/prod', CFG), true)
		// `claude mcp get <server>` prints the server's env block verbatim.
		assert.equal(isSensitive('Bash', 'claude mcp get aws-knowledge', CFG), true)
	})

	it('flags whole-environment dumps and credential files', () => {
		assert.equal(isSensitive('Bash', 'env', CFG), true)
		assert.equal(isSensitive('Bash', 'cat .env.production', CFG), true)
		assert.equal(isSensitive('Bash', 'cat ~/.aws/credentials', CFG), true)
		assert.equal(isSensitive('Bash', 'cat id_rsa', CFG), true)
	})

	it('flags a rule broad enough to reach a secret, even if it names none', () => {
		// `aws * get-*` reads as read-only and covers `get-secret-value`. The
		// rule inherits the restriction of everything it can reach.
		assert.equal(isSensitive('Bash', 'aws * get-*', CFG), true)
		assert.equal(classify('Bash', 'aws * get-*', CFG), 'yes')
	})

	it('leaves ordinary reads alone', () => {
		assert.equal(isSensitive('Bash', 'aws organizations list-accounts', CFG), false)
		assert.equal(isSensitive('Bash', 'aws glue get-databases:*', CFG), false)
		assert.equal(isSensitive('Bash', 'aws controltower get-landing-zone:*', CFG), false)
		assert.equal(isSensitive('Bash', 'git status', CFG), false)
	})

	it('refuses to promote a family containing a sensitive read, however read-only it looks', () => {
		const fams = families(
			scenario({ local: ['Bash(aws organizations list-accounts)', 'Bash(aws secretsmanager get-secret-value *)'] }),
		)
		const aws = fams.find((x) => x.name === 'Bash:aws')!
		assert.equal(aws.sensitive, true)
		assert.equal(aws.recommendation, 'keep')
		assert.match(aws.reason, /credential|secret/i)
	})

	it('never suggests a wildcard broad enough to cover a credential read', () => {
		// `aws * get-*` reads as read-only and covers `get-secret-value`.
		// This hole was caught before release; the test keeps it shut.
		const s = suggestWildcards(
			scenario({ local: ['Bash(aws glue get-databases *)', 'Bash(aws dlm get-lifecycle-policies *)'] }),
			CFG,
		)
		assert.equal(s.some((w) => w.wildcard === 'Bash(aws * get-*)'), false)
	})

	it('still suggests the wildcards that cannot reach a secret', () => {
		const s = suggestWildcards(
			scenario({ local: ['Bash(aws sns list-topics *)', 'Bash(aws organizations list-accounts *)'] }),
			CFG,
		)
		assert.equal(s.some((w) => w.wildcard === 'Bash(aws * list-*)'), true)
	})
})

describe('extending the safelist from project config', () => {
	it('adds project-specific read-only commands', () => {
		const cfg = extendConfig(defaultConfig(), { readonlyBash: ['mycli show *'] })
		assert.equal(classify('Bash', 'mycli show users', cfg), 'yes')
	})

	it('only ever extends, so a project cannot delete a mutating marker', () => {
		const cfg = extendConfig(defaultConfig(), { mutatingMarkers: [] })
		assert.equal(classify('Bash', 'terraform apply', cfg), 'no')
	})

	it('ignores a config that is not an object', () => {
		assert.deepEqual(extendConfig(defaultConfig(), 'nonsense'), defaultConfig())
	})
})

describe('reading a settings file', () => {
	it('collects allow, deny and ask separately', () => {
		const rules = rulesFrom(
			{ permissions: { allow: ['Read'], deny: ['Bash(rm *)'], ask: ['Edit(//etc/*)'] } },
			'user',
			CFG,
		)
		assert.deepEqual(rules.map((r) => [r.list, r.raw]), [
				['allow', 'Read'],
				['deny', 'Bash(rm *)'],
				['ask', 'Edit(//etc/*)'],
			])
	})

	it('skips a non-string entry instead of failing the whole file', () => {
		const rules = rulesFrom({ permissions: { allow: ['Read', 42, null] } }, 'user', CFG)
		assert.deepEqual(rules.map((r) => r.raw), ['Read'])
	})

	it('returns nothing for a settings file with no permissions block', () => {
		assert.deepEqual(rulesFrom({ model: 'opus' }, 'user', CFG), [])
	})
})

describe('what the audit reports', () => {
	it('flags the same rule listed twice in one file', () => {
		const f = analyze(scenario({ local: ['Bash(npm test)', 'Bash(npm test)'] }), CFG)
		assert.deepEqual(f.duplicatesInScope, [
			{ scope: 'local', list: 'allow', rule: 'Bash(npm test)', count: 2 },
		])
	})

	it('flags a rule that appears in two scopes, and says the local copy is the safe one to drop', () => {
		const f = analyze(scenario({ project: ['WebSearch'], local: ['WebSearch'] }), CFG)
		assert.equal(f.crossScopeRedundant.length, 1)
		assert.deepEqual(f.crossScopeRedundant[0]!.scopes, ['project', 'local'])
		assert.equal(f.crossScopeRedundant[0]!.safeToRemove, 'local')
	})

	it('refuses to name a safe copy when the duplication is between user and project', () => {
		// Neither is safe to delete unilaterally: the project copy is shared.
		const f = analyze(scenario({ user: ['WebSearch'], project: ['WebSearch'] }), CFG)
		assert.equal(f.crossScopeRedundant[0]!.safeToRemove, null)
		assert.match(f.crossScopeRedundant[0]!.note!, /collaborator|anyone else/i)
	})

	it('flags a local rule already covered by a user wildcard as safe to drop', () => {
		const f = analyze(scenario({ user: ['Bash(git *)'], local: ['Bash(git status)'] }), CFG)
		const hit = f.subsumed.find((s) => s.rule === 'Bash(git status)')!
		assert.equal(hit.coveredBy, 'Bash(git *)')
		assert.equal(hit.safeToRemove, true)
	})

	it('flags a user rule covered by a local wildcard as NOT safe to drop', () => {
		// The local wildcard only applies in this one repo, so deleting the user
		// rule would lose the grant everywhere else.
		const f = analyze(scenario({ user: ['Bash(kubectl get pods)'], local: ['Bash(kubectl *)'] }), CFG)
		const hit = f.subsumed.find((s) => s.rule === 'Bash(kubectl get pods)')!
		assert.equal(hit.safeToRemove, false)
	})

	it('reports each subsumption once, however many duplicate copies exist', () => {
		const f = analyze(
			scenario({ user: ['Bash(git *)'], local: ['Bash(git status)', 'Bash(git status)'] }),
			CFG,
		)
		assert.equal(f.subsumed.filter((s) => s.rule === 'Bash(git status)').length, 1)
	})

	it('flags an allow rule that a deny rule overrides, since deny always wins', () => {
		const f = analyze(
			scenario({ user: { permissions: { allow: ['Bash(git *)'], deny: ['Bash(git push *)'] } } }),
			CFG,
		)
		assert.equal(f.allowDenyConflicts.length, 1)
		assert.equal(f.allowDenyConflicts[0]!.allow, 'Bash(git *)')
		assert.equal(f.allowDenyConflicts[0]!.deny, 'Bash(git push *)')
	})

	it('does not compare an allow rule against a deny rule for a different tool', () => {
		const f = analyze(
			scenario({ user: { permissions: { allow: ['Read'], deny: ['Bash(rm *)'] } } }),
			CFG,
		)
		assert.deepEqual(f.allowDenyConflicts, [])
	})

	it('finds nothing to report on a tidy set of rules', () => {
		const f = analyze(scenario({ user: ['WebSearch'], local: ['Bash(terraform apply)'] }), CFG)
		assert.deepEqual(f.duplicatesInScope, [])
		assert.deepEqual(f.crossScopeRedundant, [])
		assert.deepEqual(f.subsumed, [])
		assert.deepEqual(f.allowDenyConflicts, [])
	})
})

describe('suggesting a wildcard that would replace several rules', () => {
	it('proposes a safelisted wildcard once two or more distinct rules fall under it', () => {
		const s = suggestWildcards(
			scenario({ local: ['Bash(gh issue view *)', 'Bash(gh pr view *)'] }),
			CFG,
		)
		assert.ok(s.some((w) => w.wildcard === 'Bash(gh * view*)'))
	})

	it('does not count one rule twice just because it sits in two scopes', () => {
		// Two copies of the same rule is a redundancy problem, not a folding one.
		const s = suggestWildcards(
			scenario({ project: ['Bash(gh issue view *)'], local: ['Bash(gh issue view *)'] }),
			CFG,
		)
		assert.deepEqual(s, [])
	})

	it('never proposes a wildcard that is not on the read-only safelist', () => {
		// Three read-only git rules must not produce `Bash(git *)`, which would
		// also grant `git push`. Only patterns written down in advance qualify.
		const s = suggestWildcards(
			scenario({ local: ['Bash(git status)', 'Bash(git diff)', 'Bash(git log)'] }),
			CFG,
		)
		assert.equal(s.some((w) => w.wildcard === 'Bash(git *)'), false)
	})

	it('never proposes a pattern that begins with a wildcard', () => {
		const s = suggestWildcards(scenario({ local: ['Bash(foo --help)', 'Bash(bar --help)'] }), CFG)
		assert.equal(s.some((w) => w.wildcard.startsWith('Bash(*')), false)
	})
})

describe('recommending what to promote', () => {
	it('recommends promoting a family whose every allow rule is provably read-only', () => {
		const fams = families(scenario({ local: ['Bash(gh issue view *)', 'Bash(gh pr list *)'] }))
		const gh = fams.find((x) => x.name === 'Bash:gh')!
		assert.equal(gh.recommendation, 'promote-to-user')
	})

	it('recommends keeping a family that contains anything mutating', () => {
		const fams = families(scenario({ local: ['Bash(aws s3 list-buckets)', 'Bash(aws s3 rm *)'] }))
		assert.equal(fams.find((x) => x.name === 'Bash:aws')!.recommendation, 'keep')
	})

	it('asks rather than deciding when the effect cannot be determined', () => {
		const fams = families(scenario({ local: ['mcp__linear__list_issues'] }))
		assert.equal(fams.find((x) => x.name === 'mcp__linear')!.recommendation, 'ask')
	})

	it('leaves a family alone when it is already entirely at user scope', () => {
		const fams = families(scenario({ user: ['Bash(gh issue view *)'] }))
		const gh = fams.find((x) => x.name === 'Bash:gh')!
		assert.equal(gh.recommendation, 'keep')
		assert.match(gh.reason, /already at user scope/i)
	})

	it('does not recommend promotion on the strength of deny rules alone', () => {
		const fams = families(scenario({ local: { permissions: { deny: ['Bash(rm -rf *)'] } } }))
		assert.equal(fams.find((x) => x.name === 'Bash:rm')!.recommendation, 'keep')
	})
})

describe('the tidied lists the skill writes back', () => {
	it('removes duplicates and orders rules by tool then specifier', () => {
		const sorted = sortRules(
			scenario({ local: ['Read', 'Bash(npm test)', 'Bash(npm test)', 'Bash(gh pr list)'] }),
		)
		assert.deepEqual(sorted.local.allow, [
			'Bash(gh pr list)',
			'Bash(npm test)',
			'Read',
		])
	})

	it('leaves a scope with no rules as empty lists rather than omitting it', () => {
		const sorted = sortRules(scenario({ local: ['Read'] }))
		assert.deepEqual(sorted.project, { allow: [], deny: [], ask: [] })
	})

	it('keeps allow, deny and ask in their own lists', () => {
		const sorted = sortRules(
			scenario({ user: { permissions: { allow: ['Read'], deny: ['Bash(rm *)'] } } }),
		)
		assert.deepEqual(sorted.user.allow, ['Read'])
		assert.deepEqual(sorted.user.deny, ['Bash(rm *)'])
	})
})
