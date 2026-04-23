---
name: commit-config
description: Set up and update commit message configuration. Compares project config with latest samples and suggests updates.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Glob
  - ToolSearch
  - AskUserQuestion
---

# Commit Config

Sets up and updates commit message configuration.

## Workflow

### Step 1: Detect Context

Use **Bash** to check if a project config already exists:

```bash
test -f .claude/config/git/commit/main.yaml && echo "EXISTS" || echo "NEW"
```

- **NEW** → Initial setup (go to Step 2)
- **EXISTS** → Update flow (go to Step 6)

### Step 2: Ask Language Preference

Use AskUserQuestion:

```
What language should commit messages use?
- English (Recommended) — All parts in English
- Mixed — Subject and body in Korean, type/scope in English
- All Korean — Everything in Korean including type/scope
```

**Language rules by option:**

| Part | English | Mixed | All Korean |
|------|---------|-------|------------|
| Type | `feat` | `feat` | `기능` |
| Scope | `auth` | `auth` | `인증` |
| Subject | `Add user login` | `사용자 로그인 추가` | `사용자 로그인 추가` |
| Body | English | Korean | Korean |
| Footer keywords | `BREAKING CHANGE:` | `BREAKING CHANGE:` | `주요 변경:` |

Add to config:

```yaml
language: en  # en, mixed, or ko
```

### Step 3: Ask Config Complexity

Use AskUserQuestion:

```
How detailed should the commit config be?
- Simple (Recommended) — 5 core types (feat, fix, refactor, docs, chore)
- Full — All types (adds perf, test, style, build, ci)
- Custom — Pick which types to include
```

If **Custom** is selected, follow up with AskUserQuestion using `multiSelect: true`:

```
Which commit types do you want to use? (select all that apply)
- feat — New feature or capability
- fix — Bug fix
- refactor — Code change (neither bug fix nor feature)
- docs — Documentation only
- chore — Maintenance, tooling, dependencies
- perf — Performance improvement
- test — Adding or updating tests
- style — Code style changes (formatting)
- build — Build system or dependency changes
- ci — CI/CD configuration changes
```

### Step 4: Ask Project Scopes

Run `ls -d */` to discover top-level directories. Also check for `packages/*/`, `apps/*/`, `src/*/`, etc.

Suggest scopes based on actual directory names found. Use these examples as reference for common project types:

**Backend:**
```
auth, api, db, middleware, config, docs
```

**Frontend:**
```
components, hooks, pages, store, utils, styles
```

**Monorepo:**
```
frontend, backend, shared, tools, config, docs
```

**Infrastructure (CDK/Terraform):**
```
service, database, network, deployment, config, docs
```

**Fullstack:**
```
client, server, shared, config, docs
```

Present discovered scopes via AskUserQuestion to confirm:

```
Based on your project structure, here are suggested scopes:
- [scopes derived from actual directories]

Add, remove, or confirm?
```

After scopes are confirmed, ask which scopes have a dominant commit type using AskUserQuestion with `multiSelect: true`:

```
Any scopes that almost always use a specific type?
Select scopes to assign a default_type (or skip):
- git → chore (hooks, config are maintenance)
- docs → docs (documentation only)
- tools → chore (developer tooling)
- [skip] — decide type per commit
```

For each selected scope, set `default_type` in the generated config. The commit skill will use this as the pre-selected type, skipping type deliberation unless the change clearly contradicts it.

### Step 5: Generate Config

1. Run `mkdir -p .claude/config/git/commit`
2. Generate config with selected types, language, and scopes
3. Write to `.claude/config/git/commit/main.yaml`
4. Go to Step 9

### Step 6: Read Version Information (Update Flow)

```
1. Read plugin version: claude-skills/plugins/git/.claude-plugin/plugin.json → "version" field
2. Read config version: .claude/config/git/commit/main.yaml → "plugin_version" field
3. Display version comparison
```

### Step 7: Compare Configs

Load sample and project configs:

```
Sample: claude-skills/plugins/git/config/samples/{type}-main.yaml
Project: .claude/config/git/commit/main.yaml
```

Identify differences:
1. **New fields in sample** — Fields added in newer version
2. **Removed fields** — Fields no longer used
3. **Changed structure** — Reorganized sections
4. **Updated values** — Default values changed

### Step 8: Present and Apply Updates

Use AskUserQuestion to present options:

```
Config Update Review (v1.0.0 → v1.1.0)

New fields available:
- `footer.deployment_safety` - Deployment safety footers

Which updates do you want to apply?
[ ] Add new fields with defaults
[ ] Update structural changes
[ ] Keep current config (only bump plugin_version)
```

For each selected update:
1. Show the change that will be made
2. Apply the edit
3. Update the plugin_version field to match the plugin's version

### Step 9: Summary

```
✓ Config created/updated at .claude/config/git/commit/main.yaml

Settings:
- Language: Korean (subject + body)
- Project type: simple
- Scopes: app, config, docs
```

## Non-Destructive Updates

**NEVER remove** user customizations:
- Custom scopes
- Custom types
- Project-specific patterns
- Custom footer conventions

Only add new fields or update structure while preserving user values.

## Manual Review Flag

If structural changes are too complex for automatic update:

```
⚠️ Manual review recommended

The following changes require manual review:
- [describe complex change]

Sample config: claude-skills/plugins/git/config/samples/{type}-main.yaml
Your config: .claude/config/git/commit/main.yaml

Please compare and update manually, then set plugin_version to match the plugin version
```