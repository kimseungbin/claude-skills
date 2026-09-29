# Commit-msg Hooks

Commit-msg hooks validate commit messages before finalizing the commit.

## `conventional.sh`

Validates the subject line against Conventional Commits, using the same config the commit skill reads.

```
type(scope)!: subject
```

| Part | Rule |
|------|------|
| `type` | A key of `types_quick` in the config. With no config, or no `types_quick`, the [standard types](#standard-types). |
| `(scope)` | Optional. When `scopes_quick` lists scopes, it must be one of them; otherwise any scope passes. |
| `!` | Optional breaking-change marker, as the commit skill writes it. |
| `subject` | Follows `: ` and is not blank. |

Only the subject line is checked — the body and footers are free-form. Git-generated subjects pass untouched: `Merge …`, `Revert "…"`, `fixup! …`, `squash! …`, `amend! …`.

### Config

The hook reads `.claude/config/git/commit/main.yaml` at the repository root — the file `Skill(git:commit-config)` generates. Keys are read at the first indentation level under each section, so both scope shapes in the samples work:

```yaml
types_quick:
  feat: "New feature or capability"
  fix: "Bug fix"

scopes_quick:
  app: "Application code"          # flat
  deployment:                      # nested — description, patterns and
    description: "CI/CD pipelines" # default_type are not read as scopes
    default_type: "chore"
```

Types and scopes can be in any language (`기능(인증): 로그인 추가`). To add a type or scope, add its key to the config; the hook and the commit skill pick it up together.

### Standard Types

Used when the config lists no types.

| Type       | Description                     |
| ---------- | ------------------------------- |
| `feat`     | New feature                     |
| `fix`      | Bug fix                         |
| `docs`     | Documentation changes           |
| `style`    | Code style changes (formatting) |
| `refactor` | Code refactoring                |
| `perf`     | Performance improvement         |
| `test`     | Adding or updating tests        |
| `build`    | Build system changes            |
| `ci`       | CI/CD changes                   |
| `chore`    | Other changes                   |
| `revert`   | Revert previous commit          |

## Installation

```bash
# 1. Ensure base bundle is copied first
cp -r bundles/base/.githooks/ .githooks/

# 2. Copy the hook
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg

# 3. Make executable
chmod +x .githooks/commit-msg

# 4. Configure git
git config core.hooksPath .githooks
```

## Testing

`conventional.test.mts` runs the hook under `/bin/bash` against the shipped config samples:

```bash
node --test plugins/git/bundles/hooks/commit-msg/conventional.test.mts
```

## Bypassing (Emergency)

```bash
git commit --no-verify -m "emergency: Critical fix"
```
