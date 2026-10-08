# polish-permissions

Audits the `allow` / `deny` / `ask` rules across Claude Code's three settings scopes, then deduplicates them and promotes read-only rules up the scope ladder. It also reports the settings files above the project that never load, and committed rules that read as personal preferences.

Complementary to the built-in `fewer-permission-prompts` skill: that one discovers new rules from transcripts, this one reorganizes what is already there.

## What it finds

- Rules duplicated inside a single file
- Rules present in more than one scope, where the merge makes one copy dead weight
- Narrow rules already covered by a wildcard elsewhere
- `allow` rules that a `deny` rule silently overrides
- Wildcards that *look* foldable but would revoke the bare command
- Safelisted wildcards that would replace several existing rules
- Which tool families are safe to promote to user scope
- Which families read credentials and must never be promoted, however read-only they look
- Settings files above the project — such as `~/.claude/settings.local.json` — that never load for it, with a verdict per rule
- Committed rules that name nothing in the repository and read as one person's preference

## Why scope matters

| Scope | File | Read from | Reaches |
|---|---|---|---|
| User | `~/.claude/settings.json` | home | every project, only you |
| Project | `.claude/settings.json` | the directory the session starts in | only this repo, everyone who clones it |
| Local | `.claude/settings.local.json` | the git root | only this repo, only you |

Claude Code reads settings from no parent directory, so a settings file higher up the tree applies only to sessions started exactly there.

The arrays **merge** across scopes rather than override, and reach is not a straight ladder — user scope is broader in projects, project scope is broader in people. The audit will therefore only ever mark a *local* copy safe to delete: dropping a committed project rule because you happen to have it at user scope would revoke it for everyone else.

## Usage

```
/polish-permissions
```

Or run the audit directly, read-only:

```bash
node plugins/polish-permissions/scripts/audit.ts --cwd .          # human report
node plugins/polish-permissions/scripts/audit.ts --cwd . --json   # structured
```

## Configuration

Optional. `.claude/config/polish-permissions.json` extends the built-in read-only safelist for project-specific tools — see `config/samples/polish-permissions.json`. It extends only; a project cannot make its own deploy command look promotable.

## Development

No dependencies, no install step — the scripts and their tests run on Node's built-in type stripping and `node:test`:

```bash
cd plugins/polish-permissions/scripts
npm test          # node --test
npm run test:watch
```

`scripts/core.test.ts` is written to be read as the specification — each case names the behavior it pins down.

## Installation

```bash
claude install kimseungbin/claude-skills
```
