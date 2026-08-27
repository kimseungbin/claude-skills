// plugin_version: 0.1.0
//
// Pure analysis over permission rules. No filesystem, no process — everything
// here takes already-parsed settings objects and returns findings, so the
// reasoning that decides what to delete is testable without touching a real
// settings.json.

import {
	READONLY_BASH,
	READONLY_TOOLS,
	MUTATING_TOOLS,
	MUTATING_MARKERS,
	SENSITIVE_READS,
} from './safelist.ts'

export type Scope = 'user' | 'project' | 'local'
export type ListName = 'allow' | 'deny' | 'ask'
export type Readonly_ = 'yes' | 'no' | 'unknown'

export const SCOPES: Scope[] = ['user', 'project', 'local']
export const LISTS: ListName[] = ['allow', 'deny', 'ask']

export interface Rule {
	raw: string
	scope: Scope
	list: ListName
	tool: string
	/** Text inside the parentheses; null for a bare tool rule like `Read`. */
	spec: string | null
	family: string
	readonly: Readonly_
	/** Reads nothing but credentials and secrets. Independent of `readonly`:
	 *  a rule can be provably non-mutating and still unsafe to promote. */
	sensitive: boolean
}

export interface Config {
	readonlyBash: string[]
	readonlyTools: string[]
	mutatingMarkers: string[]
	sensitiveReads: string[]
}

export function defaultConfig(): Config {
	return {
		readonlyBash: [...READONLY_BASH],
		readonlyTools: [...READONLY_TOOLS],
		mutatingMarkers: [...MUTATING_MARKERS],
		sensitiveReads: [...SENSITIVE_READS],
	}
}

/** Merges a user-supplied config over the built-in safelist. Extends only — a
 *  project can widen what counts as read-only for its own tools, but cannot
 *  delete a mutating marker and quietly make `terraform apply` promotable. */
export function extendConfig(base: Config, raw: unknown): Config {
	const cfg: Config = {
		readonlyBash: [...base.readonlyBash],
		readonlyTools: [...base.readonlyTools],
		mutatingMarkers: [...base.mutatingMarkers],
		sensitiveReads: [...base.sensitiveReads],
	}
	if (!raw || typeof raw !== 'object') return cfg
	const r = raw as Partial<Config>
	if (Array.isArray(r.readonlyBash)) cfg.readonlyBash.push(...r.readonlyBash.filter((x) => typeof x === 'string'))
	if (Array.isArray(r.readonlyTools)) cfg.readonlyTools.push(...r.readonlyTools.filter((x) => typeof x === 'string'))
	if (Array.isArray(r.mutatingMarkers))
		cfg.mutatingMarkers.push(...r.mutatingMarkers.filter((x) => typeof x === 'string'))
	if (Array.isArray(r.sensitiveReads))
		cfg.sensitiveReads.push(...r.sensitiveReads.filter((x) => typeof x === 'string'))
	return cfg
}

// ------------------------------------------------------------ rule parsing

/** `Bash(git status)` -> { tool: 'Bash', spec: 'git status' }; `Read` -> spec null. */
export function splitRule(raw: string): { tool: string; spec: string | null } {
	const m = /^([^(]+)\((.*)\)$/s.exec(raw.trim())
	if (!m) return { tool: raw.trim(), spec: null }
	return { tool: m[1]!.trim(), spec: m[2]! }
}

/**
 * The group a rule is promoted with. Users think in terms of "my gh rules",
 * not individual patterns, so this is the unit the skill asks about.
 */
export function familyOf(tool: string, spec: string | null): string {
	if (tool.startsWith('mcp__')) {
		const parts = tool.split('__')
		return parts.length >= 2 && parts[1] ? `mcp__${parts[1]}` : tool
	}
	if (tool === 'Bash' && spec) {
		// Skip leading VAR=value assignments so `FOO=1 git status` groups under git.
		const tokens = spec
			.trim()
			.split(/\s+/)
			.filter((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t))
		return `Bash:${tokens[0] ?? '*'}`
	}
	return tool
}

// --------------------------------------------------------- glob matching

const REGEX_META = /[.+?^${}()|[\]\\]/g

export function globToRegex(glob: string): RegExp {
	return new RegExp('^' + glob.replace(REGEX_META, '\\$&').replace(/\*/g, '.*') + '$', 's')
}

/**
 * True when rule `a` already covers everything `b` grants.
 *
 * `b.spec` is tested with its own wildcards left as literal text: a pattern
 * that absorbs the literal `*` also absorbs every string that `*` stands for,
 * so this stays sound while remaining a plain string test.
 */
export function subsumes(a: Rule, b: Rule): boolean {
	if (a.raw === b.raw) return false
	// A bare `mcp__<server>` rule grants every tool on that server, so it
	// covers each `mcp__<server>__<tool>` rule written out separately.
	if (a.tool.startsWith('mcp__') && b.tool.startsWith(`${a.tool}__`)) return true
	if (a.tool !== b.tool) return false
	if (a.spec === null) return true // bare `Read` covers every `Read(...)`
	if (b.spec === null) return false
	return globToRegex(a.spec).test(b.spec)
}

/**
 * True when `a` covers `b`'s argument forms but *not* bare `b` — the case that
 * makes naive folding lossy. `Bash(npm test *)` does not grant `npm test`.
 */
export function nearMiss(a: Rule, b: Rule): boolean {
	if (a.raw === b.raw) return false
	if (a.tool !== b.tool || a.spec === null || b.spec === null) return false
	if (subsumes(a, b)) return false
	return globToRegex(a.spec).test(b.spec + ' x')
}

/**
 * Whether a rule living at `covering` reaches everywhere a rule at `covered`
 * does. Scope reach is not a single ladder: user scope spans every project but
 * only this machine's owner, while project scope spans every collaborator but
 * only this repository. Neither contains the other, so a project rule is never
 * safely deleted on the strength of a user rule — the collaborators would lose
 * a grant they can see in version control.
 */
export function coverageReaches(covering: Scope, covered: Scope): boolean {
	if (covered === 'local') return true // local is the narrowest reach there is
	if (covered === 'project') return covering === 'project'
	return covering === 'user'
}

// ------------------------------------------------------- classification

/**
 * Whether any token of `spec` is a mutating verb.
 *
 * Tokenised rather than substring-matched, because substrings produce absurd
 * false positives on real rule sets: `aws codecommit list-repositories` reads
 * as mutating on `commit`, and `claude mcp get` reads as mutating on `cp`.
 *
 * A token matches when it *is* the marker, or when it is the marker followed
 * by a hyphen — the shape AWS-style CLIs use for their mutating subcommands.
 * Trailing wildcard syntax (`rm:*`, `delete-bucket *`) is stripped first.
 */
export function hasMutatingToken(spec: string, cfg: Config): boolean {
	const tokens = spec
		.toLowerCase()
		.split(/[\s;|&]+/)
		.map((t) => t.replace(/[:*]+$/, ''))
		.filter(Boolean)
	return tokens.some((token) =>
		cfg.mutatingMarkers.some((marker) => token === marker || token.startsWith(`${marker}-`)),
	)
}

/**
 * Whether a rule hands back credential or secret material.
 *
 * Orthogonal to `classify`: `aws secretsmanager get-secret-value` mutates
 * nothing and is still the last rule anyone should stop being asked about.
 */
export function isSensitive(tool: string, spec: string | null, cfg: Config): boolean {
	if (tool !== 'Bash' || spec === null) return false
	const probe = spec.trim().replace(/\s*\*$/, '')
	const own = globToRegex(spec.trim())
	return cfg.sensitiveReads.some(
		(pattern) =>
			// the rule *is* a secret read
			globToRegex(pattern).test(probe) ||
			globToRegex(pattern).test(spec.trim()) ||
			// or it is broad enough to reach one: `aws * get-*` covers
			// `get-secret-value`, so it inherits the same restriction
			own.test(pattern),
	)
}

export function classify(tool: string, spec: string | null, cfg: Config): Readonly_ {
	if (cfg.readonlyTools.includes(tool)) return 'yes'
	if (MUTATING_TOOLS.includes(tool)) return 'no'
	// An MCP tool's effect is not knowable from its name. Conservative by design.
	if (tool.startsWith('mcp__')) return 'unknown'
	if (tool !== 'Bash') return 'unknown'
	if (spec === null) return 'no' // bare `Bash` is every command there is

	const probe = spec.trim().replace(/\s*\*$/, '')
	// A redirect writes a file whatever the command in front of it is.
	if (/[^\s]>>?|>>?\s/.test(spec)) return 'no'
	if (hasMutatingToken(spec, cfg)) return 'no'
	for (const pattern of cfg.readonlyBash) {
		if (globToRegex(pattern).test(probe)) return 'yes'
	}
	return 'unknown'
}

// ---------------------------------------------------------- rule building

/** Turns one parsed settings object into rules. Non-string entries and
 *  missing arrays are skipped rather than throwing — a malformed entry should
 *  not hide the rest of the file. */
export function rulesFrom(settings: unknown, scope: Scope, cfg: Config): Rule[] {
	const perms = (settings as any)?.permissions ?? {}
	const rules: Rule[] = []
	for (const list of LISTS) {
		const entries = perms[list]
		if (!Array.isArray(entries)) continue
		for (const entry of entries) {
			if (typeof entry !== 'string') continue
			const { tool, spec } = splitRule(entry)
			rules.push({
				raw: entry,
				scope,
				list,
				tool,
				spec,
				family: familyOf(tool, spec),
				readonly: classify(tool, spec, cfg),
				sensitive: isSensitive(tool, spec, cfg),
			})
		}
	}
	return rules
}

// -------------------------------------------------------------- findings

export interface Findings {
	duplicatesInScope: { rule: string; scope: Scope; list: ListName; count: number }[]
	crossScopeRedundant: {
		rule: string
		list: ListName
		scopes: Scope[]
		/** Only ever 'local'. Removing a project copy changes behavior for
		 *  collaborators, so it is reported but never marked safe. */
		safeToRemove: Scope | null
		note?: string
	}[]
	subsumed: {
		rule: string
		scope: Scope
		coveredBy: string
		byScope: Scope
		list: ListName
		/** False when the covering rule's reach is narrower than the covered
		 *  rule's, so deleting the covered rule would actually lose access. */
		safeToRemove: boolean
	}[]
	nearMissWildcard: { rule: string; scope: Scope; wildcard: string; byScope: Scope }[]
	allowDenyConflicts: { allow: string; allowScope: Scope; deny: string; denyScope: Scope }[]
	wildcardSuggestions: { wildcard: string; replaces: { rule: string; scope: Scope }[] }[]
}

/**
 * Wildcards worth proposing, drawn *only* from the read-only safelist.
 *
 * The safelist is the whole safety argument: a pattern invented by looking at
 * a common prefix in the user's own rules would happily produce `Bash(git *)`
 * from three read-only git rules, and quietly grant `git push` along with it.
 * A pattern that had to be written down as read-only in advance cannot.
 */
export function suggestWildcards(rules: Rule[], cfg: Config): Findings['wildcardSuggestions'] {
	const allows = rules.filter((r) => r.list === 'allow' && r.tool === 'Bash' && r.spec !== null)
	const out: Findings['wildcardSuggestions'] = []

	for (const pattern of cfg.readonlyBash) {
		// A pattern opening with a wildcard matches far too much to read as an
		// intentional grant, whatever its effect.
		if (pattern.startsWith('*')) continue
		const re = globToRegex(pattern)
		// Reject any pattern broad enough to swallow a credential read. This is
		// what kept `aws * get-*` — which covers `get-secret-value` — from ever
		// being offered again.
		if (cfg.sensitiveReads.some((s) => re.test(s))) continue
		const covered = allows.filter((r) => r.spec !== pattern && re.test(r.spec!))
		// Count distinct rule text: the same rule sitting in two scopes is one
		// rule with a redundancy problem, not two rules worth collapsing.
		const distinct = new Set(covered.map((r) => r.raw))
		if (distinct.size < 2) continue
		out.push({
			wildcard: `Bash(${pattern})`,
			replaces: covered.map((r) => ({ rule: r.raw, scope: r.scope })),
		})
	}
	return out
}

export function analyze(rules: Rule[], cfg: Config): Findings {
	const f: Findings = {
		duplicatesInScope: [],
		crossScopeRedundant: [],
		subsumed: [],
		nearMissWildcard: [],
		allowDenyConflicts: [],
		wildcardSuggestions: suggestWildcards(rules, cfg),
	}

	// exact duplicates inside one file
	const seen = new Map<string, { scope: Scope; list: ListName; rule: string; count: number }>()
	for (const r of rules) {
		const key = `${r.scope} ${r.list} ${r.raw}`
		const hit = seen.get(key)
		if (hit) hit.count++
		else seen.set(key, { scope: r.scope, list: r.list, rule: r.raw, count: 1 })
	}
	for (const entry of seen.values()) {
		if (entry.count > 1) f.duplicatesInScope.push(entry)
	}

	// same rule string present in more than one scope
	const byRule = new Map<string, { list: ListName; rule: string; scopes: Set<Scope> }>()
	for (const r of rules) {
		const key = `${r.list} ${r.raw}`
		if (!byRule.has(key)) byRule.set(key, { list: r.list, rule: r.raw, scopes: new Set() })
		byRule.get(key)!.scopes.add(r.scope)
	}
	for (const entry of byRule.values()) {
		if (entry.scopes.size < 2) continue
		const safeToRemove = entry.scopes.has('local') ? ('local' as const) : null
		f.crossScopeRedundant.push({
			rule: entry.rule,
			list: entry.list,
			scopes: SCOPES.filter((s) => entry.scopes.has(s)),
			safeToRemove,
			note:
				safeToRemove === null
					? 'Both copies are shared or personal-global; dropping the project copy would change behavior for anyone else using this repo. Decide manually.'
					: undefined,
		})
	}

	// wildcard subsumption, and the lossy near-miss case
	const subsumedSeen = new Set<string>()
	const nearMissSeen = new Set<string>()
	for (const b of rules) {
		for (const a of rules) {
			if (a.list !== b.list) continue
			if (subsumes(a, b)) {
				const key = `${b.scope} ${b.list} ${b.raw} ${a.scope} ${a.raw}`
				if (subsumedSeen.has(key)) continue
				subsumedSeen.add(key)
				f.subsumed.push({
					rule: b.raw,
					scope: b.scope,
					coveredBy: a.raw,
					byScope: a.scope,
					list: b.list,
					safeToRemove: coverageReaches(a.scope, b.scope),
				})
			} else if (nearMiss(a, b)) {
				const key = `${b.scope} ${b.raw} ${a.scope} ${a.raw}`
				if (nearMissSeen.has(key)) continue
				nearMissSeen.add(key)
				f.nearMissWildcard.push({ rule: b.raw, scope: b.scope, wildcard: a.raw, byScope: a.scope })
			}
		}
	}

	// deny always wins, so an allow it covers is dead weight at best
	const conflictSeen = new Set<string>()
	for (const d of rules.filter((r) => r.list === 'deny')) {
		for (const a of rules.filter((r) => r.list === 'allow')) {
			if (!(a.raw === d.raw || subsumes(d, a) || subsumes(a, d))) continue
			const key = `${a.scope} ${a.raw} ${d.scope} ${d.raw}`
			if (conflictSeen.has(key)) continue
			conflictSeen.add(key)
			f.allowDenyConflicts.push({ allow: a.raw, allowScope: a.scope, deny: d.raw, denyScope: d.scope })
		}
	}

	return f
}

// -------------------------------------------------------------- families

export interface Family {
	name: string
	rules: { raw: string; scope: Scope; list: ListName; readonly: Readonly_; sensitive: boolean }[]
	scopes: Scope[]
	readonly: Readonly_
	/** Any allow rule in the family reads credentials. Blocks promotion
	 *  regardless of how read-only the family looks. */
	sensitive: boolean
	recommendation: 'promote-to-user' | 'keep' | 'ask'
	reason: string
}

export function families(rules: Rule[]): Family[] {
	const groups = new Map<string, Rule[]>()
	for (const r of rules) {
		if (!groups.has(r.family)) groups.set(r.family, [])
		groups.get(r.family)!.push(r)
	}

	const out: Family[] = []
	for (const [name, members] of groups) {
		const allowMembers = members.filter((m) => m.list === 'allow')
		const belowUser = allowMembers.filter((m) => m.scope !== 'user')
		const classes = new Set(allowMembers.map((m) => m.readonly))

		let readonly: Readonly_ = 'unknown'
		if (classes.size === 1) readonly = [...classes][0]!
		else if (classes.has('no')) readonly = 'no'

		const sensitive = allowMembers.some((m) => m.sensitive)

		let recommendation: Family['recommendation']
		let reason: string
		if (sensitive) {
			recommendation = 'keep'
			reason =
				'Family reads credentials or secrets. Non-mutating, but promoting it means never being asked before a secret is read.'
		} else if (belowUser.length === 0) {
			recommendation = 'keep'
			reason = 'Already at user scope, or contains no allow rules.'
		} else if (readonly === 'yes') {
			recommendation = 'promote-to-user'
			reason = 'Every allow rule in this family is provably read-only.'
		} else if (readonly === 'no') {
			recommendation = 'keep'
			reason = 'Family contains rules that can modify state. Promoting makes them silent everywhere.'
		} else {
			recommendation = 'ask'
			reason = 'Effect cannot be determined from the rule text. Defaults to keeping it where it is.'
		}

		out.push({
			name,
			rules: members.map((m) => ({
				raw: m.raw,
				scope: m.scope,
				list: m.list,
				readonly: m.readonly,
				sensitive: m.sensitive,
			})),
			scopes: SCOPES.filter((s) => members.some((m) => m.scope === s)),
			readonly,
			sensitive,
			recommendation,
			reason,
		})
	}
	return out.sort((a, b) => a.name.localeCompare(b.name))
}

// ----------------------------------------------------------- sorted view

export function sortKey(r: Rule): string {
	return `${r.tool} ${r.spec ?? ''}`
}

/** Each list, deduplicated and grouped by tool then specifier — the shape the
 *  skill writes back when the user accepts the polish step. */
export function sortRules(rules: Rule[]): Record<Scope, Record<ListName, string[]>> {
	const out = {} as Record<Scope, Record<ListName, string[]>>
	for (const scope of SCOPES) {
		out[scope] = { allow: [], deny: [], ask: [] }
		for (const list of LISTS) {
			const members = rules.filter((r) => r.scope === scope && r.list === list)
			const unique = [...new Map(members.map((m) => [m.raw, m])).values()]
			unique.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
			out[scope][list] = unique.map((m) => m.raw)
		}
	}
	return out
}