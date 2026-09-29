/**
 * Tests for the conventional.sh commit-msg hook.
 *
 * Every case installs the hook the way the bundle README does — `.githooks/commit-msg`
 * beside a copy of the base bundle's `lib/` — inside a throwaway git repo, then runs it
 * with `/bin/bash`, the interpreter its shebang names. On macOS that is bash 3.2, the
 * oldest shell the hook meets in practice.
 *
 * The shipped config samples are used verbatim as fixtures. They are what
 * `commit-config` writes into a project, so a hook that cannot read them validates
 * nothing on any real install.
 */

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(HERE, 'conventional.sh')
const LIB = path.join(HERE, '../../base/.githooks/lib')
const SAMPLES = path.join(HERE, '../../../config/samples')

const ROOT = mkdtempSync(path.join(tmpdir(), 'commit-msg-hook-'))
after(() => rmSync(ROOT, { recursive: true, force: true }))

let repoCount = 0

/** A git repo with the hook installed and, optionally, a commit config. */
function makeRepo(config?: string): string {
    const repo = path.join(ROOT, `repo-${repoCount++}`)
    mkdirSync(path.join(repo, '.githooks'), { recursive: true })
    spawnSync('git', ['init', '-q', repo])
    cpSync(HOOK, path.join(repo, '.githooks/commit-msg'))
    cpSync(LIB, path.join(repo, '.githooks/lib'), { recursive: true })
    if (config !== undefined) {
        mkdirSync(path.join(repo, '.claude/config/git/commit'), { recursive: true })
        writeFileSync(path.join(repo, '.claude/config/git/commit/main.yaml'), config)
    }
    return repo
}

function sample(name: string): string {
    return readFileSync(path.join(SAMPLES, name), 'utf8')
}

/** Run the hook on a message; returns its exit code and combined output. */
function run(repo: string, message: string): { code: number | null; out: string } {
    const msgFile = path.join(repo, 'COMMIT_EDITMSG')
    writeFileSync(msgFile, message)
    const r = spawnSync('/bin/bash', [path.join(repo, '.githooks/commit-msg'), msgFile], {
        cwd: repo,
        encoding: 'utf8',
    })
    return { code: r.status, out: r.stdout + r.stderr }
}

function accepts(repo: string, message: string) {
    const r = run(repo, message)
    assert.equal(r.code, 0, `expected accept: ${JSON.stringify(message)}\n${r.out}`)
}

function rejects(repo: string, message: string, reason: string) {
    const r = run(repo, message)
    assert.equal(r.code, 1, `expected reject: ${JSON.stringify(message)}\n${r.out}`)
    assert.match(r.out, new RegExp(reason), r.out)
}

describe('simple-main.yaml sample (flat scopes)', () => {
    const repo = makeRepo(sample('simple-main.yaml'))

    it('accepts a configured type and scope', () => accepts(repo, 'feat(app): Add login\n'))
    it('accepts a scopeless subject', () => accepts(repo, 'docs: Fix typo\n'))
    it('rejects a type the config does not list', () => rejects(repo, 'perf(app): Cache pages\n', 'Unknown type: perf'))
    it('rejects a scope the config does not list', () => rejects(repo, 'feat(api): Add route\n', 'Unknown scope: api'))
    it('names the config file as the source of the allowed types', () => {
        const r = run(repo, 'bogus: nonsense\n')
        assert.equal(r.code, 1)
        assert.match(r.out, /from .*\.claude\/config\/git\/commit\/main\.yaml/)
    })
})

describe('nested-scope samples', () => {
    for (const [file, scope] of [
        ['infrastructure-main.yaml', 'cloudfront'],
        ['monorepo-main.yaml', 'backend'],
    ] as const) {
        const repo = makeRepo(sample(file))

        it(`${file}: accepts a configured scope`, () => accepts(repo, `fix(${scope}): Handle timeout\n`))
        it(`${file}: rejects a nested field name as a scope`, () =>
            rejects(repo, 'fix(description): Handle timeout\n', 'Unknown scope: description'))
        it(`${file}: rejects a pattern entry as a scope`, () =>
            rejects(repo, 'fix(patterns): Handle timeout\n', 'Unknown scope: patterns'))
    }
})

describe('config parsing', () => {
    it('reads keys at any indent width, including non-ASCII types', () => {
        const repo = makeRepo("types_quick:\n    기능: '새로운 기능'\n    수정: '버그 수정'\nscopes_quick:\n    인증: '인증'\n")
        accepts(repo, '기능(인증): 로그인 추가\n')
        rejects(repo, 'feat(인증): Add login\n', 'Unknown type: feat')
    })

    it('skips comments and blank lines inside a section', () => {
        const repo = makeRepo('types_quick:\n  # core\n  feat: "x"\n\n  fix: "y"\nscopes_quick:\n  app: "a"\n')
        accepts(repo, 'fix(app): Patch\n')
    })

    it('stops a section at the next top-level key', () => {
        const repo = makeRepo('types_quick:\n  feat: "x"\nformat:\n  pattern: "p"\n')
        rejects(repo, 'format: Something\n', 'Unknown type: format')
    })

    it('accepts any scope when scopes_quick is absent', () => {
        const repo = makeRepo('types_quick:\n  feat: "x"\n')
        accepts(repo, 'feat(anything): Add it\n')
    })

    it('falls back to the standard types when types_quick is absent', () => {
        const repo = makeRepo('scopes_quick:\n  app: "a"\n')
        accepts(repo, 'perf(app): Cache pages\n')
        rejects(repo, 'bogus(app): Nonsense\n', 'Unknown type: bogus')
    })
})

describe('no config', () => {
    const repo = makeRepo()

    it('accepts a standard type with any scope', () => accepts(repo, 'refactor(core): Split module\n'))
    it('rejects a non-standard type', () => rejects(repo, 'bogus: nonsense\n', 'Unknown type: bogus'))
    it('names the standard types as the source', () => {
        const r = run(repo, 'bogus: nonsense\n')
        assert.match(r.out, /from standard Conventional Commits types/)
    })
})

describe('subject shape', () => {
    const repo = makeRepo(sample('simple-main.yaml'))

    it('accepts the breaking-change marker with a scope', () => accepts(repo, 'feat(app)!: Drop v1 API\n'))
    it('accepts the breaking-change marker without a scope', () => accepts(repo, 'feat!: Drop v1 API\n'))
    it('still checks the scope of a breaking change', () =>
        rejects(repo, 'feat(api)!: Drop v1 API\n', 'Unknown scope: api'))
    it('rejects a missing space after the colon', () => rejects(repo, 'feat(app):Add login\n', 'does not match'))
    it('rejects an empty subject', () => rejects(repo, 'feat(app): \n', 'does not match'))
    it('rejects an empty scope', () => rejects(repo, 'feat(): Add login\n', 'does not match'))
    it('rejects prose with no type', () => rejects(repo, 'bad message\n', 'does not match'))
    it('validates only the subject line, not the body', () =>
        accepts(repo, 'feat(app): Add login\n\nnot a conventional line: at all\n'))
    it('skips leading git comments and blank lines', () =>
        accepts(repo, '# Please enter the commit message\n\nfeat(app): Add login\n'))
    it('accepts an empty message, leaving the rejection to git', () => accepts(repo, '# only comments\n\n'))
})

describe('git-generated subjects', () => {
    const repo = makeRepo(sample('simple-main.yaml'))

    for (const subject of [
        "Merge branch 'feature' into main",
        'Merge pull request #12 from owner/branch',
        'Revert "feat(app): Add login"',
        'fixup! feat(app): Add login',
        'squash! feat(app): Add login',
        'amend! feat(app): Add login',
    ]) {
        it(`accepts: ${subject}`, () => accepts(repo, `${subject}\n`))
    }
})
