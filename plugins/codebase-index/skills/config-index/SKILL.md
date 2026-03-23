---
name: config-index
description: Guides users through documenting config file inheritance patterns in monorepo/workspace projects
version: 0.1.0
---

# Config Index Skill

Walks through discovering and documenting a project's config file inheritance patterns. Produces a CONFIG-INDEX.md that maps each config concern to its files and inheritance model, so Claude can navigate configs without exploration.

## When to Use

- Setting up a new monorepo or workspace project
- When Claude duplicates root config values in workspace configs
- When config inheritance chains are unclear
- After adding a new tool with its own config hierarchy

## Pre-loaded Context

### Config Files Found

!`find . -maxdepth 4 \( -name "tsconfig*.json" -o -name "eslint.config.*" -o -name ".eslintrc*" -o -name "vite.config.*" -o -name "vitest.config.*" -o -name ".prettierrc*" -o -name "prettier.config.*" -o -name ".stylelintrc*" -o -name "jest.config.*" -o -name "webpack.config.*" -o -name "rollup.config.*" -o -name "babel.config.*" -o -name ".babelrc*" -o -name "tailwind.config.*" -o -name "postcss.config.*" -o -name "nx.json" -o -name "turbo.json" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | sort`

### Existing Config Index

!`cat CONFIG-INDEX.md 2>/dev/null || echo "No CONFIG-INDEX.md found"`

## Workflow

### 1. Present Discovery

Review the pre-loaded config files above. Group them by concern (e.g., all tsconfig files together, all eslint files together). Present to the user:

```
Found config files:

  TypeScript: tsconfig.json, packages/api/tsconfig.json, packages/web/tsconfig.json
  ESLint: eslint.config.ts
  Prettier: .prettierrc
  (etc.)
```

If an existing CONFIG-INDEX.md was found, note which concerns are already documented and which are new.

### 2. Ask About Additional Configs

Use **AskUserQuestion** to ask if there are other config concerns not auto-detected. The scan covers common tools but projects may have custom configs (e.g., `.env` inheritance, Docker compose overrides, Terraform modules).

### 3. Walk Through Each Concern

For each config concern (detected + user-added), sequentially:

**3a. Identify Files**

List the files found for this concern. Ask the user to confirm or add any missing files.

**3b. Determine Inheritance Model**

Read the root config file to detect the inheritance pattern. Then confirm with the user. The common models are:

| Model | Description | Example |
|-------|-------------|---------|
| **extends** | Workspace configs extend a root/shared config via `extends` field | tsconfig, .eslintrc (legacy) |
| **flat-override** | Single root config with per-workspace overrides via file globs | ESLint flat config |
| **standalone** | Each workspace has independent config, no shared base | Vite (sometimes) |
| **root-only** | Single root config, no per-workspace files | Prettier, Stylelint |
| **cascading** | Tool auto-merges configs found walking up the directory tree | .npmrc, .editorconfig |
| **custom** | Project-specific pattern — document as-is | — |

**3c. Note Key Details**

For non-obvious setups, capture:
- What the root config provides (e.g., "compiler options, path aliases")
- What workspaces typically override (e.g., "outDir, references")
- Any gaps or inconsistencies worth noting

### 4. Generate CONFIG-INDEX.md

Produce the index file at the project root with this structure:

```markdown
# Config Index

Config inheritance patterns for this project. Claude should read the referenced files
directly — this index provides navigation, not content.

## Index

| Concern | Root | Workspaces | Model |
|---------|------|------------|-------|
| TypeScript | tsconfig.json | packages/*/tsconfig.json | extends |
| ESLint | eslint.config.ts | — | flat-override |
| Prettier | .prettierrc | — | root-only |
| Vite | — | packages/web/vite.config.ts | standalone |

## Details

### TypeScript
- **Model:** extends — all workspace tsconfig.json files extend root
- **Root provides:** compilerOptions (strict, target, moduleResolution), path aliases
- **Workspaces override:** outDir, rootDir, project references
- **Read order:** root tsconfig.json first, then workspace tsconfig.json

### ESLint
- **Model:** flat-override — single root eslint.config.ts with per-workspace `files` globs
- **Root provides:** shared rules, plugin configs
- **Workspace overrides:** rules scoped via files array (e.g., `files: ["packages/web/**"]`)
- **Read order:** eslint.config.ts only (single file)

(etc.)

## Instructions for Claude

1. Before modifying any config, read this index to understand the inheritance chain
2. Read the root config first, then the workspace config
3. Never duplicate values that the root already provides
4. When creating a new workspace config, find the most similar existing workspace as a template
```

### 5. Review and Finalize

Present the generated CONFIG-INDEX.md content to the user for review. Apply any edits they request, then write the final file.

### 6. Update CLAUDE.md Reference

If the project has a CLAUDE.md, suggest adding a reference:

```markdown
## Config Navigation

See `CONFIG-INDEX.md` for config file inheritance patterns. Read it before modifying any config file.
```

## Reference: Common Inheritance Patterns

These examples help Claude guide users through documenting their specific setup.

### tsconfig (extends model)

Root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

Workspace `packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Key:** `extends` field points to root. Workspace only adds what differs.

### ESLint flat config (flat-override model)

Single `eslint.config.ts`:
```typescript
export default [
  { rules: { /* shared rules */ } },
  { files: ["packages/web/**"], rules: { /* web-specific */ } },
  { files: ["packages/api/**"], rules: { /* api-specific */ } },
];
```

**Key:** One file, workspace scoping via `files` globs. No inheritance chain — it's all in one place.

### ESLint legacy (extends model)

Root `.eslintrc.json`:
```json
{ "rules": { "no-console": "warn" } }
```

Workspace `packages/api/.eslintrc.json`:
```json
{ "extends": "../../.eslintrc.json", "rules": { "no-console": "off" } }
```

### Vite (standalone model)

Each workspace has its own `vite.config.ts` with no shared base:
```
packages/web/vite.config.ts    (React plugin, dev server)
packages/docs/vite.config.ts   (MDX plugin, static build)
```

**Key:** No inheritance. If configs start converging, note this as a gap — a shared base may be worth extracting.

### Vitest (standalone or embedded)

Can be standalone or embedded in Vite config:
```
packages/api/vitest.config.ts      (standalone — no Vite dependency)
packages/web/vite.config.ts        (embedded — test config inside Vite config)
```

**Key:** Document which pattern each workspace uses. Mixed approaches are common.

### Prettier / Stylelint (root-only model)

Single root config, no per-workspace files:
```
.prettierrc
.stylelintrc.json
```

**Key:** These tools cascade by default — a single root config applies everywhere. Per-workspace overrides are rare and usually a smell.

### .npmrc / .editorconfig (cascading model)

Tools that walk up the directory tree merging configs:
```
.editorconfig              (root defaults)
packages/api/.editorconfig (workspace overrides merged on top)
```

**Key:** No explicit `extends` — the tool handles merging automatically.

## Project-Specific Configuration

This skill uses the shared codebase-index config at `.claude/config/codebase-index.yaml`:

```yaml
config-index:
  output: CONFIG-INDEX.md    # Output filename (default: CONFIG-INDEX.md)
  extra_patterns:            # Additional config file patterns to scan
    - "*.config.mjs"
    - ".env*"
  exclude_patterns:          # Patterns to skip
    - "**/fixtures/**"
    - "**/templates/**"
```
