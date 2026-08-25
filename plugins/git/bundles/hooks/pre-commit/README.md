# Pre-commit Hooks

Pre-commit hooks run before each commit to validate code quality.

## Available Hooks

### `basic.sh`

**For:** Simple TypeScript/JavaScript projects

**Checks:**
- Auto-fix formatting (Prettier)
- Auto-fix linting (ESLint)
- Type checking (TypeScript)

**Runs on staged files only** via `npx prettier --write` and `npx eslint --fix`.

**Required npm scripts:**
```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

**Customizable extensions** (edit variables at the top of the hook):
- `PRETTIER_EXTS` — file extensions for Prettier
- `LINT_EXTS` — file extensions for ESLint

---

### `with-stylelint.sh`

**For:** Projects with CSS/design system that enforce design tokens

**Checks:**
- Auto-fix formatting (Prettier) — staged files only
- Auto-fix linting (ESLint) — staged files only
- CSS linting (Stylelint) — staged files only
- Design-token contrast against WCAG — only when a token file is staged
- Type checking (TypeScript)

**Runs on staged files only** via `npx prettier`, `npx eslint`, and `npx stylelint`.

**Required npm scripts:**
```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

**Use with:** `stylelint-declaration-strict-value` plugin to enforce design token usage.

#### Design-token contrast check

Stylelint can enforce that a color *comes from* a token. It cannot tell you whether that token is still readable. This step closes that gap: it computes WCAG 2.1 contrast ratios for `<role>-bg` / `<role>-text` pairs and fails the commit when a pair drops below its threshold — on the change that caused it, rather than when a user reports unreadable text.

The step is driven entirely by `.githooks/scripts/contrast-limits.yaml`, so the token path lives in one place:

```yaml
default_threshold: 7.0      # WCAG 2.1 AAA; 4.5 for AA
sources:
  - src/tokens.css
format: css                 # css | scss | json | custom
roles:
  button-identity: 4.5      # per-role override
  decorative: off           # exempt entirely
```

Passing `--staged` lets the validator decide for itself whether any configured source is in the commit, so unrelated commits pay nothing and the hook needs no hardcoded path.

**Requires:** Node >=22.18 or >=23.6 — the validator is TypeScript run through Node's native type-stripping, with no runtime dependency and no transpile step. On an older runtime the hook fails with that message rather than a parse dump.

Run it by hand to see every pair, not just the failures:

```bash
node .githooks/scripts/check-contrast.ts            # every configured source
node .githooks/scripts/check-contrast.ts --staged    # only what is staged
node .githooks/scripts/check-contrast.ts src/a.css   # specific files
```

Pairs it reports as *skipped* rather than passed: a role with only one half defined (a renamed `-text` would otherwise silently leave coverage), a translucent background (the backdrop is unknown, so any ratio would be invented), and a reference that dangles or cycles.

---

### `monorepo.sh`

**For:** npm/pnpm/yarn workspaces, Lerna, Nx monorepos

**Checks:**
- Clean build artifacts
- Auto-fix formatting
- Auto-fix linting
- Type check all workspaces
- Build all packages
- Clean artifacts after validation

**Runs format/lint on staged files only** via `npx prettier` and `npx eslint`.

**Required npm scripts:**
```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "build": "npm run build --workspaces"
  }
}
```

**Customization:**
Edit `PACKAGES_DIR` variable if your packages aren't in `packages/`:
```bash
PACKAGES_DIR="apps"  # or "libs", "modules", etc.
```

## Installation

```bash
# 1. Ensure base bundle is copied first
cp -r bundles/base/.githooks/ .githooks/

# 2. Copy desired pre-commit hook
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit

# 3. Make executable
chmod +x .githooks/pre-commit

# 4. Configure git
git config core.hooksPath .githooks
```

## Customization Tips

### Adding a check

```bash
#############################################
# N. Your new check
#############################################
print_step "N/M" "Running your check..."

if npm run your-check 2>&1; then
    print_success_indent "Your check passed"
else
    print_error_indent "Your check failed"
    exit 1
fi
```

### Making a check non-blocking

```bash
if npm run lint 2>&1; then
    print_success_indent "Linting passed"
else
    print_warning_indent "Linting issues (non-blocking)"
    # Don't exit 1 - allow commit to proceed
fi
```

### Skipping slow checks

Move slow checks (tests, full builds) to `pre-push` hook instead.
Pre-commit should complete in <30 seconds.