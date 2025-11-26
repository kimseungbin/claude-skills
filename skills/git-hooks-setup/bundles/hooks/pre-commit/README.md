# Pre-commit Hooks

Pre-commit hooks run before each commit to validate code quality.

## Available Hooks

### `basic.sh`

**For:** Simple TypeScript/JavaScript projects

**Checks:**
- Auto-fix formatting (Prettier)
- Auto-fix linting (ESLint)
- Type checking (TypeScript)

**Required npm scripts:**
```json
{
  "scripts": {
    "format": "prettier --write .",
    "lint": "eslint --fix .",
    "type-check": "tsc --noEmit"
  }
}
```

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

**Required npm scripts:**
```json
{
  "scripts": {
    "format": "prettier --write .",
    "lint": "eslint --fix .",
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