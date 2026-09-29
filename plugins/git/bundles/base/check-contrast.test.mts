/**
 * Tests for the design-token contrast validator, .githooks/scripts/check-contrast.ts.
 *
 * This file sits beside `.githooks/` rather than inside it: installs copy the whole
 * `base/.githooks/` directory into a project, and the test is not part of what ships.
 *
 * Every case installs the script the way the bundle README does — at
 * `.githooks/scripts/check-contrast.ts`, with its `contrast-limits.yaml` beside it —
 * inside a throwaway git repo, then runs it with `node`. The script resolves its config
 * relative to itself and its sources relative to the repo root, so both halves of that
 * layout are exercised.
 */

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, '.githooks/scripts/check-contrast.ts')
const SAMPLE_CONFIG = path.join(HERE, '.githooks/scripts/contrast-limits.yaml')

const ROOT = mkdtempSync(path.join(tmpdir(), 'check-contrast-'))
after(() => rmSync(ROOT, { recursive: true, force: true }))

let repoCount = 0

interface RepoSpec {
    /** Contents of contrast-limits.yaml. */
    config: string
    /** Files to write, keyed by repo-relative path. */
    files?: Record<string, string>
    /** Paths to `git add`. Defaults to every file in `files`. */
    stage?: string[]
}

/** A git repo with the validator installed. */
function makeRepo({ config, files = {}, stage }: RepoSpec): string {
    const repo = path.join(ROOT, `repo-${repoCount++}`)
    const scripts = path.join(repo, '.githooks/scripts')
    mkdirSync(scripts, { recursive: true })
    spawnSync('git', ['init', '-q', repo])
    cpSync(SCRIPT, path.join(scripts, 'check-contrast.ts'))
    writeFileSync(path.join(scripts, 'contrast-limits.yaml'), config)
    for (const [file, text] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
        writeFileSync(path.join(repo, file), text)
    }
    const toStage = stage ?? Object.keys(files)
    if (toStage.length > 0) spawnSync('git', ['add', '--', ...toStage], { cwd: repo })
    return repo
}

/** Run the validator; returns its exit code and combined output. */
function run(repo: string, ...args: string[]): { code: number | null; out: string } {
    const r = spawnSync('node', ['.githooks/scripts/check-contrast.ts', ...args], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    })
    return { code: r.status, out: r.stdout + r.stderr }
}

/** A minimal contrast-limits.yaml. */
function yaml({
    threshold = 7.0,
    sources = ['src/tokens.css'],
    format = 'css',
    extra = '',
}: { threshold?: number; sources?: string[]; format?: string; extra?: string } = {}): string {
    const list = sources.map((s) => `  - ${s}`).join('\n')
    return `default_threshold: ${threshold}\nsources:\n${list}\nformat: ${format}\n${extra}`
}

/** A `:root` block of CSS custom properties. */
function css(decls: Record<string, string>): string {
    const body = Object.entries(decls)
        .map(([name, value]) => `  --${name}: ${value};`)
        .join('\n')
    return `:root {\n${body}\n}\n`
}

/** Runs the check over one CSS token file and returns the result. */
function checkCss(decls: Record<string, string>, config = yaml()) {
    return run(makeRepo({ config, files: { 'src/tokens.css': css(decls) } }))
}

function passes(r: { code: number | null; out: string }) {
    assert.equal(r.code, 0, `expected exit 0\n${r.out}`)
}

function fails(r: { code: number | null; out: string }) {
    assert.equal(r.code, 1, `expected exit 1\n${r.out}`)
}

function configError(r: { code: number | null; out: string }, reason: string) {
    assert.equal(r.code, 2, `expected exit 2\n${r.out}`)
    assert.match(r.out, new RegExp(reason), r.out)
}

describe('WCAG 2.1 ratio', () => {
    it('scores black on white at 21:1', () => {
        const r = checkCss({ 'color-body-bg': '#ffffff', 'color-body-text': '#000000' })
        passes(r)
        assert.match(r.out, /body\s+21\.00:1 \/ 7\.0:1\s+PASS/)
    })

    it('scores identical colors at 1:1', () => {
        const r = checkCss({ 'color-body-bg': '#808080', 'color-body-text': '#808080' })
        fails(r)
        assert.match(r.out, /body\s+1\.00:1/)
    })

    it('fails #777 on white just under AA', () => {
        const r = checkCss(
            { 'color-body-bg': '#ffffff', 'color-body-text': '#777777' },
            yaml({ threshold: 4.5 }),
        )
        fails(r)
        assert.match(r.out, /body is 4\.48:1, needs 4\.5:1/)
    })

    it('passes a pair exactly at its threshold', () => {
        // #767676 on white is the conventional lightest AA gray, at 4.54:1.
        passes(checkCss({ 'color-body-bg': '#fff', 'color-body-text': '#767676' }, yaml({ threshold: 4.54 })))
    })

    it('is symmetric in bg and text', () => {
        const light = checkCss({ 'color-a-bg': '#ffffff', 'color-a-text': '#336699' })
        const dark = checkCss({ 'color-a-bg': '#336699', 'color-a-text': '#ffffff' })
        const ratio = (out: string) => out.match(/(\d+\.\d+):1 \//)![1]
        assert.equal(ratio(light.out), ratio(dark.out))
    })
})

describe('hex parsing', () => {
    it('expands 3-digit shorthand per channel', () => {
        const r = checkCss({ 'color-body-bg': '#fff', 'color-body-text': '#000' })
        assert.match(r.out, /21\.00:1/)
    })

    it('treats an opaque 8-digit hex as its 6-digit color', () => {
        const r = checkCss({ 'color-body-bg': '#ffffffff', 'color-body-text': '#000000ff' })
        assert.match(r.out, /21\.00:1/)
    })

    it('expands 4-digit shorthand with alpha', () => {
        const r = checkCss({ 'color-body-bg': '#ffff', 'color-body-text': '#000f' })
        assert.match(r.out, /21\.00:1/)
    })

    it('accepts uppercase hex', () => {
        const r = checkCss({ 'color-body-bg': '#FFFFFF', 'color-body-text': '#000000' })
        assert.match(r.out, /21\.00:1/)
    })

    it('reports a 5-digit hex as unresolved rather than guessing', () => {
        const r = checkCss({ 'color-body-bg': '#fffff', 'color-body-text': '#000' })
        passes(r)
        assert.match(r.out, /skipped body — could not resolve bg=#fffff/)
    })

    it('reports a non-hex literal as unresolved', () => {
        const r = checkCss({ 'color-body-bg': 'rgb(255 255 255)', 'color-body-text': '#000' })
        assert.match(r.out, /skipped body — could not resolve bg=rgb\(255 255 255\)/)
    })
})

describe('translucency', () => {
    it('composites translucent text over its background', () => {
        // 50% black over white flattens to a mid gray at 4.00:1.
        const r = checkCss({ 'color-body-bg': '#ffffff', 'color-body-text': '#00000080' })
        fails(r)
        assert.match(r.out, /body\s+4\.00:1/)
    })

    it('skips a translucent background, whose backdrop is unknown', () => {
        const r = checkCss({ 'color-body-bg': '#ffffff80', 'color-body-text': '#000' })
        passes(r)
        assert.match(r.out, /skipped body — bg=#ffffff80 is translucent; backdrop unknown/)
    })
})

describe('reference resolution', () => {
    it('follows var() aliases to a literal', () => {
        const r = checkCss({
            'neutral-0': '#ffffff',
            'neutral-900': '#000000',
            'color-body-bg': 'var(--neutral-0)',
            'color-body-text': 'var(--neutral-900)',
        })
        passes(r)
        assert.match(r.out, /21\.00:1/)
        assert.match(r.out, /var\(--neutral-0\) → #ffffff/)
    })

    it('follows chained aliases', () => {
        const r = checkCss({
            'base-white': '#fff',
            'surface': 'var(--base-white)',
            'color-body-bg': 'var(--surface)',
            'color-body-text': '#000',
        })
        assert.match(r.out, /var\(--surface\) → var\(--base-white\) → #fff/)
    })

    it('resolves the reference, not the fallback, of var(--x, fallback)', () => {
        const r = checkCss({
            'ink': '#000',
            'color-body-bg': '#fff',
            'color-body-text': 'var(--ink, #ffffff)',
        })
        assert.match(r.out, /21\.00:1/)
    })

    it('skips a reference to an undefined token', () => {
        const r = checkCss({ 'color-body-bg': 'var(--missing)', 'color-body-text': '#000' })
        passes(r)
        assert.match(r.out, /skipped body — could not resolve bg=var\(--missing\) \(undefined\)/)
    })

    it('skips a circular reference instead of hanging', () => {
        const r = checkCss({
            'a': 'var(--b)',
            'b': 'var(--a)',
            'color-body-bg': 'var(--a)',
            'color-body-text': '#000',
        })
        passes(r)
        assert.match(r.out, /skipped body — .*\(circular\)/)
    })
})

describe('pair coverage', () => {
    it('skips a role with only bg defined', () => {
        const r = checkCss({ 'color-body-bg': '#fff', 'color-body-fg': '#000' })
        passes(r)
        assert.match(r.out, /skipped body — only bg is defined/)
    })

    it('skips a role with only text defined', () => {
        const r = checkCss({ 'color-body-text': '#000' })
        assert.match(r.out, /skipped body — only text is defined/)
    })

    it('checks hyphenated role names as one role', () => {
        const r = checkCss({ 'color-surface-raised-bg': '#fff', 'color-surface-raised-text': '#000' })
        assert.match(r.out, /surface-raised\s+21\.00:1/)
    })

    it('fails the run when any one pair fails', () => {
        const r = checkCss({
            'color-body-bg': '#fff',
            'color-body-text': '#000',
            'color-muted-bg': '#fff',
            'color-muted-text': '#aaa',
        })
        fails(r)
        assert.match(r.out, /1 pair\(s\) below their contrast threshold/)
        assert.match(r.out, /muted is \d+\.\d+:1/)
        assert.doesNotMatch(r.out, /body is/)
    })

    it('summarises the pairs and skips it checked', () => {
        const r = checkCss({ 'color-a-bg': '#fff', 'color-a-text': '#000', 'color-b-bg': '#fff' })
        assert.match(r.out, /checked 1 pair\(s\) in 1 file\(s\), 1 skipped/)
    })
})

describe('per-role thresholds', () => {
    const decls = {
        'color-body-bg': '#ffffff',
        'color-body-text': '#767676',
        'color-brand-bg': '#ffffff',
        'color-brand-text': '#767676',
    }

    it('lets a role override default_threshold', () => {
        const r = checkCss(decls, yaml({ extra: 'roles:\n  brand: 4.5\n' }))
        fails(r)
        assert.match(r.out, /brand\s+4\.54:1 \/ 4\.5:1\s+PASS/)
        assert.match(r.out, /body is 4\.54:1, needs 7\.0:1/)
    })

    it('omits a role set to off', () => {
        const r = checkCss(decls, yaml({ threshold: 4.5, extra: 'roles:\n  body: off\n' }))
        passes(r)
        assert.doesNotMatch(r.out, /body/)
        assert.match(r.out, /brand/)
    })

    it('reads thresholds written with trailing comments and quotes', () => {
        const r = checkCss(decls, yaml({ extra: "roles:\n  brand: '4.5'  # identity\n  body: 4.5 # AA\n" }))
        passes(r)
    })
})

describe('scss format', () => {
    it('reads $color-<role>-bg/-text and follows $ aliases', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['src/theme.scss'], format: 'scss' }),
            files: {
                'src/theme.scss': '$white: #fff;\n$color-body-bg: $white;\n$color-body-text: #000;\n',
            },
        })
        const r = run(repo)
        passes(r)
        assert.match(r.out, /body\s+21\.00:1/)
        assert.match(r.out, /\$white → #fff/)
    })
})

describe('json format', () => {
    it('reads nested bg/text keys, naming the role by its key path', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['tokens.json'], format: 'json' }),
            files: {
                'tokens.json': JSON.stringify({ color: { surface: { raised: { bg: '#fff', text: '#000' } } } }),
            },
        })
        const r = run(repo)
        passes(r)
        assert.match(r.out, /color-surface-raised\s+21\.00:1/)
    })

    it('reads W3C design tokens with $value', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['tokens.json'], format: 'json' }),
            files: {
                'tokens.json': JSON.stringify({
                    body: { $type: 'color', bg: { $value: '#fff' }, text: { $value: '#777' } },
                }),
            },
        })
        const r = run(repo)
        fails(r)
        assert.match(r.out, /body is 4\.48:1/)
    })

    it('skips a W3C alias rather than passing it', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['tokens.json'], format: 'json' }),
            files: { 'tokens.json': JSON.stringify({ body: { bg: '{base.white}', text: '#000' } }) },
        })
        const r = run(repo)
        passes(r)
        assert.match(r.out, /skipped body — could not resolve bg=\{base\.white\}/)
    })

    it('rejects invalid JSON as an input error', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['tokens.json'], format: 'json' }),
            files: { 'tokens.json': '{ not json' },
        })
        configError(run(repo), 'tokens\\.json is not valid JSON')
    })
})

describe('custom format', () => {
    it('uses the configured pattern', () => {
        const pattern = String.raw`--fg-(?<role>[a-z0-9-]+?)-(?<kind>bg|text)\s*:\s*(?<value>[^;\n}]+)`
        const r = checkCss(
            { 'fg-card-bg': '#fff', 'fg-card-text': '#000', 'color-body-bg': '#fff', 'color-body-text': '#fff' },
            yaml({ format: 'custom', extra: `pattern: '${pattern}'\n` }),
        )
        passes(r)
        assert.match(r.out, /card\s+21\.00:1/)
        assert.doesNotMatch(r.out, /body/)
    })

    it('keeps a # inside a quoted pattern', () => {
        const pattern = String.raw`(?<role>[a-z]+)-(?<kind>bg|text)\s*=\s*(?<value>#[0-9a-f]+)`
        const repo = makeRepo({
            config: yaml({ sources: ['tokens.txt'], format: 'custom', extra: `pattern: "${pattern}"\n` }),
            files: { 'tokens.txt': 'body-bg = #ffffff\nbody-text = #000000\n' },
        })
        const r = run(repo)
        passes(r)
        assert.match(r.out, /body\s+21\.00:1/)
    })
})

describe('configuration errors', () => {
    const tokens = { 'src/tokens.css': css({ 'color-body-bg': '#fff', 'color-body-text': '#000' }) }

    it('refuses an empty sources list rather than passing silently', () =>
        configError(run(makeRepo({ config: 'default_threshold: 7\nsources:\nformat: css\n' })), 'no sources configured'))

    it('rejects an unknown format', () =>
        configError(run(makeRepo({ config: yaml({ format: 'less' }), files: tokens })), 'format must be one of'))

    it('requires a pattern for the custom format', () =>
        configError(run(makeRepo({ config: yaml({ format: 'custom' }), files: tokens })), 'no pattern is configured'))

    it('requires every named group in a custom pattern', () =>
        configError(
            run(makeRepo({ config: yaml({ format: 'custom', extra: "pattern: '(?<role>x)(?<value>y)'\n" }), files: tokens })),
            String.raw`named capture group \(\?<kind>`,
        ))

    it('rejects an invalid custom regex', () =>
        configError(
            run(makeRepo({ config: yaml({ format: 'custom', extra: "pattern: '(?<role>['\n" }), files: tokens })),
            'not a valid regular expression',
        ))

    it('rejects a default_threshold of 1 or less', () =>
        configError(run(makeRepo({ config: yaml({ threshold: 1 }), files: tokens })), 'default_threshold must be'))

    it('rejects a non-numeric role threshold', () =>
        configError(run(makeRepo({ config: yaml({ extra: 'roles:\n  body: high\n' }), files: tokens })), 'roles\\.body must be'))
})

describe('file selection', () => {
    const passing = css({ 'color-body-bg': '#fff', 'color-body-text': '#000' })
    const failing = css({ 'color-body-bg': '#fff', 'color-body-text': '#fff' })

    it('--staged exits quietly when no configured source is staged', () => {
        const repo = makeRepo({
            config: yaml(),
            files: { 'src/tokens.css': failing, 'src/app.ts': '' },
            stage: ['src/app.ts'],
        })
        const r = run(repo, '--staged')
        passes(r)
        assert.equal(r.out, '')
    })

    it('--staged checks a configured source that is staged', () => {
        const repo = makeRepo({ config: yaml(), files: { 'src/tokens.css': failing } })
        fails(run(repo, '--staged'))
    })

    it('expands ** globs against tracked files', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['**/tokens.css'] }),
            files: { 'packages/ui/src/tokens.css': failing, 'tokens.css': passing },
        })
        const r = run(repo)
        fails(r)
        assert.match(r.out, /packages\/ui\/src\/tokens\.css: body/)
        assert.doesNotMatch(r.out, /^\s+tokens\.css: body/m)
    })

    it('keeps * within one path segment', () => {
        const repo = makeRepo({
            config: yaml({ sources: ['src/*.css'] }),
            files: { 'src/nested/tokens.css': failing },
        })
        passes(run(repo))
    })

    it('checks a literal source that is not yet tracked', () => {
        const repo = makeRepo({ config: yaml(), files: { 'src/tokens.css': failing }, stage: [] })
        fails(run(repo))
    })

    it('checks explicit file arguments instead of sources', () => {
        const repo = makeRepo({
            config: yaml(),
            files: { 'src/tokens.css': passing, 'other/theme.css': failing },
        })
        const r = run(repo, 'other/theme.css')
        fails(r)
        assert.match(r.out, /other\/theme\.css: body/)
    })

    it('resolves sources from the repo root when run from a subdirectory', () => {
        const repo = makeRepo({ config: yaml(), files: { 'src/tokens.css': failing } })
        const r = spawnSync('node', ['../.githooks/scripts/check-contrast.ts'], {
            cwd: path.join(repo, 'src'),
            encoding: 'utf8',
            env: { ...process.env, NO_COLOR: '1' },
        })
        assert.equal(r.status, 1, r.stdout + r.stderr)
    })
})

describe('shipped contrast-limits.yaml', () => {
    it('parses and checks src/tokens.css at AAA', () => {
        const repo = makeRepo({
            config: readFileSync(SAMPLE_CONFIG, 'utf8'),
            files: { 'src/tokens.css': css({ 'color-body-bg': '#fff', 'color-body-text': '#595959' }) },
        })
        const r = run(repo)
        passes(r)
        assert.match(r.out, /body\s+7\.00:1 \/ 7\.0:1\s+PASS/)
    })
})
