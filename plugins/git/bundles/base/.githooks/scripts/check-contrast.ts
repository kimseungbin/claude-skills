#!/usr/bin/env node
//
// Design-Token Contrast Check
//
// Computes WCAG 2.1 contrast ratios for `<role>-bg` / `<role>-text` design-token
// pairs and fails when a pair falls below its configured threshold. Contrast
// regressions are otherwise invisible until a user reports unreadable text.
//
// Usage:
//   .githooks/scripts/check-contrast.ts                 # every configured source
//   .githooks/scripts/check-contrast.ts --staged        # only sources that are staged
//   .githooks/scripts/check-contrast.ts src/tokens.css  # only the given files
//
// Exit codes:
//   0 - every checked pair meets its threshold (or no configured source changed)
//   1 - at least one pair is below threshold
//   2 - configuration or input error
//
// Requires Node >=22.18 or >=23.6, which strip TypeScript types natively. There
// is no runtime dependency and no transpile step.
//
// Configuration: contrast-limits.yaml, alongside this script.
// See .githooks/README.md for full documentation.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.join(SCRIPT_DIR, 'contrast-limits.yaml')

type Kind = 'bg' | 'text'
type Format = 'css' | 'scss' | 'json' | 'custom'

interface Config {
	defaultThreshold: number
	sources: string[]
	format: Format
	pattern?: string
	roles: Record<string, number | 'off'>
}

interface Rgb {
	r: number
	g: number
	b: number
	a: number
}

/** One `<role>-bg` / `<role>-text` pair as written in the token source. */
interface Pair {
	bg?: string
	text?: string
}

//#############################################
// Terminal styling
//#############################################

const COLOR = process.env.NO_COLOR === undefined && process.stdout.isTTY === true
const paint = (code: string, s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s)
const red = (s: string) => paint('31', s)
const green = (s: string) => paint('32', s)
const yellow = (s: string) => paint('33', s)
const dim = (s: string) => paint('2', s)

//#############################################
// Configuration
//#############################################

/**
 * Strips a trailing YAML comment, leaving `#` alone inside quotes so a custom
 * regex containing `#` survives.
 */
function stripComment(line: string): string {
	let quote: string | null = null
	for (let i = 0; i < line.length; i++) {
		const c = line[i]
		if (quote !== null) {
			if (c === quote) quote = null
		} else if (c === '"' || c === "'") {
			quote = c
		} else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]!))) {
			return line.slice(0, i)
		}
	}
	return line
}

function unquote(value: string): string {
	const t = value.trim()
	const q = t[0]
	if (t.length >= 2 && (q === '"' || q === "'") && t.endsWith(q)) return t.slice(1, -1)
	return t
}

/**
 * Reads contrast-limits.yaml. This handles exactly the shape that file ships
 * with — top-level scalars, one string list, one flat map — rather than being a
 * general YAML parser, so that the script keeps its zero-dependency promise.
 */
function loadConfig(file: string): Config {
	const config: Config = { defaultThreshold: 7, sources: [], format: 'css', roles: {} }
	let section: 'sources' | 'roles' | null = null

	for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
		const line = stripComment(rawLine)
		if (line.trim() === '') continue
		if (!/^\s/.test(line)) section = null

		if (section === 'sources') {
			const item = line.match(/^\s*-\s*(.+)$/)
			if (item) {
				config.sources.push(unquote(item[1]!))
				continue
			}
		}
		if (section === 'roles') {
			const entry = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+)$/)
			if (entry) {
				const value = unquote(entry[2]!)
				config.roles[entry[1]!] = value === 'off' ? 'off' : Number(value)
				continue
			}
		}

		const kv = line.match(/^([a-z_]+)\s*:\s*(.*)$/)
		if (!kv) continue
		const value = unquote(kv[2]!)
		switch (kv[1]) {
			case 'default_threshold':
				config.defaultThreshold = Number(value)
				break
			case 'format':
				config.format = value as Format
				break
			case 'pattern':
				config.pattern = value
				break
			case 'sources':
				section = 'sources'
				break
			case 'roles':
				section = 'roles'
				break
		}
	}
	return config
}

function validateConfig(config: Config): void {
	if (!Number.isFinite(config.defaultThreshold) || config.defaultThreshold <= 1) {
		fail(`default_threshold must be a number greater than 1, got "${config.defaultThreshold}"`)
	}
	if (!['css', 'scss', 'json', 'custom'].includes(config.format)) {
		fail(`format must be one of css, scss, json, custom — got "${config.format}"`)
	}
	if (config.format === 'custom' && config.pattern === undefined) {
		fail('format is "custom" but no pattern is configured')
	}
	if (config.sources.length === 0) {
		// Silence here would read as a pass, so refuse instead.
		fail('no sources configured — list at least one token file under `sources:`')
	}
	for (const [role, threshold] of Object.entries(config.roles)) {
		if (threshold !== 'off' && (!Number.isFinite(threshold) || threshold <= 1)) {
			fail(`roles.${role} must be a number greater than 1 or "off", got "${threshold}"`)
		}
	}
}

function fail(message: string): never {
	console.error(`${red('Error')}: ${message}`)
	console.error(dim(`Config: ${CONFIG_FILE}`))
	process.exit(2)
}

//#############################################
// Color math (WCAG 2.1)
//#############################################

/** Accepts #RGB, #RGBA, #RRGGBB and #RRGGBBAA. */
function parseHex(value: string): Rgb | null {
	const m = value.trim().match(/^#([0-9a-fA-F]{3,8})$/)
	if (!m) return null
	let h = m[1]!
	if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
	if (h.length !== 6 && h.length !== 8) return null
	const channel = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255
	return { r: channel(0), g: channel(2), b: channel(4), a: h.length === 8 ? channel(6) : 1 }
}

function relativeLuminance({ r, g, b }: Rgb): number {
	// WCAG 2.1 specifies the 0.03928 breakpoint; sRGB itself says 0.04045. The
	// difference is immaterial at this precision — match the spec being tested.
	const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
	const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
	return (hi! + 0.05) / (lo! + 0.05)
}

/** Flattens a translucent foreground onto an opaque backdrop. */
function composite(fg: Rgb, backdrop: Rgb): Rgb {
	return {
		r: fg.r * fg.a + backdrop.r * (1 - fg.a),
		g: fg.g * fg.a + backdrop.g * (1 - fg.a),
		b: fg.b * fg.a + backdrop.b * (1 - fg.a),
		a: 1,
	}
}

//#############################################
// Token extraction
//#############################################

const PRESET_PATTERNS: Record<'css' | 'scss', string> = {
	css: '--color-(?<role>[a-z0-9-]+?)-(?<kind>bg|text)\\s*:\\s*(?<value>[^;\\n}]+)',
	scss: '\\$color-(?<role>[a-z0-9-]+?)-(?<kind>bg|text)\\s*:\\s*(?<value>[^;\\n}]+)',
}

function patternFor(config: Config): RegExp {
	const source =
		config.format === 'custom' ? config.pattern! : PRESET_PATTERNS[config.format as 'css' | 'scss']
	let re: RegExp
	try {
		re = new RegExp(source, 'g')
	} catch (error) {
		fail(`pattern is not a valid regular expression: ${(error as Error).message}`)
	}
	for (const group of ['role', 'kind', 'value']) {
		if (!source.includes(`(?<${group}>`)) {
			fail(`pattern must contain a named capture group (?<${group}>...)`)
		}
	}
	return re
}

/**
 * Every declaration in the file, so a pair written as `var(--other-token)` can
 * be followed to the literal it eventually names.
 */
function declarationMap(text: string, format: Format): Map<string, string> {
	const map = new Map<string, string>()
	const re =
		format === 'scss'
			? /(\$[A-Za-z0-9_-]+)\s*:\s*([^;\n}]+)/g
			: /(--[A-Za-z0-9_-]+)\s*:\s*([^;\n}]+)/g
	for (const m of text.matchAll(re)) map.set(m[1]!.trim(), m[2]!.trim())
	return map
}

const REFERENCE = /^(?:var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)|(\$[A-Za-z0-9_-]+))$/

/**
 * Follows `var(--x)` and `$x` indirection to a literal hex. Token files
 * routinely alias — `--color-danger-text: var(--color-neutral-50)` — and
 * treating an alias as unparseable would drop the pair from coverage silently.
 */
function resolveColor(
	value: string,
	declarations: Map<string, string>,
	seen = new Set<string>(),
): { rgb: Rgb | null; trail: string } {
	const v = value.trim()
	const literal = parseHex(v)
	if (literal) return { rgb: literal, trail: v }

	const ref = v.match(REFERENCE)
	if (!ref) return { rgb: null, trail: v }

	const name = ref[1] ?? ref[2]!
	if (seen.has(name)) return { rgb: null, trail: `${v} ${dim('(circular)')}` }
	seen.add(name)

	const next = declarations.get(name)
	if (next === undefined) return { rgb: null, trail: `${v} ${dim('(undefined)')}` }

	const resolved = resolveColor(next, declarations, seen)
	return { rgb: resolved.rgb, trail: `${v} → ${resolved.trail}` }
}

function extractFromText(text: string, config: Config): Map<string, Pair> {
	const pairs = new Map<string, Pair>()
	for (const m of text.matchAll(patternFor(config))) {
		const { role, kind, value } = m.groups as { role: string; kind: string; value: string }
		const entry = pairs.get(role) ?? {}
		entry[kind as Kind] = value.trim()
		pairs.set(role, entry)
	}
	return pairs
}

/** Handles plain `{ role: { bg, text } }` and W3C design tokens (`$value`). */
function extractFromJson(text: string, file: string): Map<string, Pair> {
	const pairs = new Map<string, Pair>()
	let root: unknown
	try {
		root = JSON.parse(text)
	} catch (error) {
		fail(`${file} is not valid JSON: ${(error as Error).message}`)
	}

	const read = (node: Record<string, unknown>, key: Kind): string | undefined => {
		const value = node[key]
		if (typeof value === 'string') return value
		if (value !== null && typeof value === 'object') {
			const wrapped = (value as Record<string, unknown>).$value
			if (typeof wrapped === 'string') return wrapped
		}
		return undefined
	}

	const walk = (node: unknown, trail: string[]): void => {
		if (node === null || typeof node !== 'object' || Array.isArray(node)) return
		const obj = node as Record<string, unknown>

		const bg = read(obj, 'bg')
		const text_ = read(obj, 'text')
		if (bg !== undefined || text_ !== undefined) {
			const role = trail.join('-') || 'root'
			const entry = pairs.get(role) ?? {}
			if (bg !== undefined) entry.bg = bg
			if (text_ !== undefined) entry.text = text_
			pairs.set(role, entry)
		}

		for (const [key, value] of Object.entries(obj)) {
			if (key === 'bg' || key === 'text' || key.startsWith('$')) continue
			walk(value, [...trail, key])
		}
	}

	walk(root, [])
	return pairs
}

//#############################################
// File selection
//#############################################

function git(args: string[]): string[] {
	try {
		// stderr is discarded: outside a repository these calls are expected to
		// fail, and git's own complaint would be noise in the hook output.
		const out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
		return out.split('\n').filter(Boolean)
	} catch {
		return []
	}
}

function repoRoot(): string {
	return git(['rev-parse', '--show-toplevel'])[0] ?? process.cwd()
}

function globToRegExp(glob: string): RegExp {
	// `**/` is parked on NUL while `*` and `?` expand, so the two passes cannot
	// interfere with each other.
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
	const body = escaped
		.replace(/\*\*\//g, '\u0000')
		.replace(/\*/g, '[^/]*')
		.replace(/\?/g, '[^/]')
		.replace(/\u0000/g, '(?:.*/)?')
	return new RegExp(`^${body}$`)
}

/** Expands the configured `sources` globs against tracked files. */
function resolveSources(config: Config): string[] {
	const tracked = git(['ls-files'])
	const matchers = config.sources.map(globToRegExp)
	const matched = tracked.filter((file) => matchers.some((re) => re.test(file)))

	// A literal path that is configured but untracked is still worth checking —
	// a token file added in this very commit has not been tracked before.
	for (const source of config.sources) {
		if (/[*?]/.test(source)) continue
		if (!matched.includes(source) && existsSync(source)) matched.push(source)
	}
	return [...new Set(matched)].sort()
}

//#############################################
// Main
//#############################################

interface Result {
	file: string
	role: string
	bg: string
	text: string
	ratio: number
	threshold: number
	pass: boolean
}

interface Skipped {
	file: string
	role: string
	reason: string
}

function main(): void {
	const args = process.argv.slice(2)
	if (args.includes('--help') || args.includes('-h')) {
		console.log('Usage: check-contrast.ts [--staged | --all | <file>...]')
		console.log('')
		console.log('Options:')
		console.log('  --staged  Check only configured sources that are staged')
		console.log('  --all     Check every configured source (default)')
		console.log('  <file>    Check the given files, ignoring `sources:`')
		process.exit(0)
	}

	if (!existsSync(CONFIG_FILE)) {
		fail(`configuration file not found: ${CONFIG_FILE}`)
	}

	const config = loadConfig(CONFIG_FILE)
	validateConfig(config)

	process.chdir(repoRoot())

	const explicit = args.filter((a) => !a.startsWith('-'))
	let files: string[]
	if (explicit.length > 0) {
		files = explicit
	} else if (args.includes('--staged')) {
		const staged = new Set(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']))
		files = resolveSources(config).filter((f) => staged.has(f))
	} else {
		files = resolveSources(config)
	}

	if (files.length === 0) {
		// Nothing configured changed. Staying quiet keeps unrelated commits fast.
		process.exit(0)
	}

	const results: Result[] = []
	const skipped: Skipped[] = []

	for (const file of files) {
		if (!existsSync(file)) {
			console.error(`${yellow('warning')}: configured source not found: ${file}`)
			continue
		}
		const text = readFileSync(file, 'utf8')
		const pairs =
			config.format === 'json' ? extractFromJson(text, file) : extractFromText(text, config)
		const declarations =
			config.format === 'json' ? new Map<string, string>() : declarationMap(text, config.format)

		for (const [role, pair] of [...pairs.entries()].sort()) {
			const threshold = config.roles[role] ?? config.defaultThreshold
			if (threshold === 'off') continue

			if (pair.bg === undefined || pair.text === undefined) {
				// A renamed half (`-text` → `-fg`) would otherwise drop the role
				// from coverage without a word.
				skipped.push({
					file,
					role,
					reason: `only ${pair.bg === undefined ? 'text' : 'bg'} is defined — the pair is unchecked`,
				})
				continue
			}

			const bg = resolveColor(pair.bg, declarations)
			const text_ = resolveColor(pair.text, declarations)
			if (!bg.rgb || !text_.rgb) {
				const unresolved = !bg.rgb ? `bg=${bg.trail}` : `text=${text_.trail}`
				skipped.push({ file, role, reason: `could not resolve ${unresolved}` })
				continue
			}
			if (bg.rgb.a < 1) {
				// The backdrop behind a translucent background is unknown, so any
				// ratio computed here would be fiction.
				skipped.push({ file, role, reason: `bg=${bg.trail} is translucent; backdrop unknown` })
				continue
			}

			const foreground = text_.rgb.a < 1 ? composite(text_.rgb, bg.rgb) : text_.rgb
			const ratio = contrastRatio(bg.rgb, foreground)
			results.push({
				file,
				role,
				bg: bg.trail,
				text: text_.trail,
				ratio,
				threshold,
				pass: ratio >= threshold,
			})
		}
	}

	report(results, skipped, files)

	const failures = results.filter((r) => !r.pass)
	process.exit(failures.length > 0 ? 1 : 0)
}

function report(results: Result[], skipped: Skipped[], files: string[]): void {
	const width = Math.max(4, ...results.map((r) => r.role.length))

	for (const r of results) {
		const verdict = r.pass ? green('PASS') : red('FAIL')
		const ratio = `${r.ratio.toFixed(2)}:1`.padStart(7)
		console.log(
			`  ${r.role.padEnd(width)}  ${ratio} / ${r.threshold.toFixed(1)}:1  ${verdict}  ${dim(`${r.bg} on ${r.text}`)}`,
		)
	}

	for (const s of skipped) {
		console.log(`  ${yellow('skipped')} ${s.role} — ${s.reason} ${dim(`(${s.file})`)}`)
	}

	const failures = results.filter((r) => !r.pass)
	if (failures.length === 0) {
		const scanned = `${results.length} pair(s) in ${files.length} file(s)`
		console.log(dim(`  checked ${scanned}${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}`))
		return
	}

	console.error('')
	console.error(red(`${failures.length} pair(s) below their contrast threshold:`))
	for (const r of failures) {
		console.error(
			`  ${r.file}: ${r.role} is ${r.ratio.toFixed(2)}:1, needs ${r.threshold.toFixed(1)}:1`,
		)
		console.error(dim(`    bg ${r.bg} / text ${r.text}`))
	}
	console.error('')
	console.error('Darken the text or lighten the background until the ratio clears the threshold.')
	console.error(
		dim('A pair that is intentionally exempt belongs under `roles:` in contrast-limits.yaml.'),
	)
}

main()
