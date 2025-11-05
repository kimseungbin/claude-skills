# Git Hook Templates

Generalized git hook templates that can be adapted to different project types.

## Available Templates

### Pre-commit Hooks

#### `pre-commit-basic.sh`

**For:** Simple TypeScript/JavaScript projects
**Checks:**

- Auto-fix formatting (Prettier)
- Auto-fix linting (ESLint)
- Type checking (TypeScript)

**Use when:** Single-package project with standard tooling

---

#### `pre-commit-aws-cdk.sh`

**For:** AWS CDK infrastructure projects
**Checks:**

- Linting
- CDK synthesis validation
- Build artifact cleanup

**Use when:** Infrastructure-as-code projects using AWS CDK

---

#### `pre-commit-monorepo.sh`

**For:** Monorepo projects (npm workspaces, pnpm, Lerna, Nx)
**Checks:**

- Auto-fix formatting
- Auto-fix linting
- Type checking (all workspaces)
- Build validation (all packages)
- Build artifact cleanup

**Use when:** Multi-package monorepo with shared tooling

---

### Commit-msg Hooks

#### `commit-msg-conventional.sh`

**For:** Projects following Conventional Commits specification
**Validates:**

- Commit message format: `type(scope): subject`
- Valid commit types (feat, fix, docs, etc.)

**Use when:** Team uses Conventional Commits for changelog generation

---

#### `commit-msg-snapshot.sh`

**For:** Projects with visual regression testing
**Validates:**

- UI file changes require snapshot footer
- Enforces `Snapshots: update` or `Snapshots: skip`

**Use when:** Using Playwright, Percy, or Chromatic for visual testing

---

### Helper Functions

#### `helpers.sh`

**Purpose:** Reusable functions for consistent hook output
**Functions:**

- `print_step()` - Step header
- `print_success()` - Success message
- `print_error()` - Error message with exit
- `print_header()` - Hook header
- `print_footer()` - Hook footer

**Usage:**

```bash
#!/bin/sh
. "$(dirname "$0")/helpers.sh"

print_header "Pre-commit"
print_step "Running checks..."
# ... your checks ...
print_success "Check passed"
print_footer
```

## How to Use Templates

### 1. Copy Template

```bash
cp examples/templates/pre-commit-basic.sh .githooks/pre-commit
chmod +x .githooks/pre-commit
```

### 2. Customize for Your Project

Edit the hook file to match your package.json scripts:

```bash
# Replace commands
npm run format     → npm run prettier:fix
npm run lint       → npm run eslint:fix
npm run type-check → tsc --noEmit
```

### 3. Configure Git

```bash
git config core.hooksPath .githooks
```

### 4. Test Hook

```bash
git add .
git commit -m "test: Verify hook works"
```

## Customization Guide

### Adjusting Commands

Replace npm commands with your actual package.json scripts:

```javascript
// package.json
{
  "scripts": {
    "format": "prettier --write .",
    "lint": "eslint --fix .",
    "type-check": "tsc --noEmit"
  }
}
```

### Adding New Checks

Insert between existing steps:

```bash
# Add new check
print_step "Running unit tests..."
if npm test; then
    print_success "Tests passed"
else
    print_error "Tests failed. Fix failing tests."
fi
```

### Removing Checks

Delete or comment out steps you don't need:

```bash
# # 3. Type check (if TypeScript)
# print_step "Type checking..."
# if npm run type-check; then
#     print_success "Type checking passed"
# else
#     print_error "Type checking failed. Fix type errors above."
# fi
```

### Performance Tuning

- **Too slow?** Remove expensive checks (build, tests)
- **Too fast?** Add more thorough validation
- **Target:** Pre-commit should complete in <30 seconds

### Workspace-Specific Checks (Monorepo)

```bash
# Check only frontend
npm run lint --workspace=frontend

# Check changed packages only
changed_packages=$(git diff --cached --name-only | grep "packages/" | cut -d'/' -f2 | sort -u)
for pkg in $changed_packages; do
  npm run lint --workspace=$pkg
done
```

## Best Practices

### ✅ Do

- Auto-fix formatting and linting (fast, helpful)
- Type check before commit (catches errors early)
- Clean build artifacts (avoid committing generated files)
- Provide clear error messages
- Keep pre-commit fast (<30 seconds)

### ❌ Don't

- Run E2E tests in pre-commit (too slow)
- Run integration tests (use pre-push or CI instead)
- Block commits for warnings (only errors)
- Forget to make hooks executable (`chmod +x`)

## Combining Templates

You can combine multiple templates:

### Example: Monorepo + Conventional Commits + Snapshots

```bash
# .githooks/pre-commit
# Use pre-commit-monorepo.sh as base

# .githooks/commit-msg
#!/bin/sh
# Combine both commit-msg templates

# Run conventional commits validation
# ... code from commit-msg-conventional.sh ...

# Run snapshot validation
# ... code from commit-msg-snapshot.sh ...

exit 0
```

## Troubleshooting

### Hook not running

```bash
# Check git config
git config core.hooksPath
# Should output: .githooks

# Fix if needed
git config core.hooksPath .githooks
```

### Permission denied

```bash
# Make hooks executable
chmod +x .githooks/*
```

### Command not found

Check that npm scripts exist in package.json:

```bash
npm run format   # Should not error "missing script"
npm run lint     # Should not error "missing script"
```

## See Also

- **Trip Settle Example:** `../trip-settle/` - Real-world implementation
- **SKILL.md:** Parent documentation for setup and troubleshooting
- **Conventional Commits:** https://www.conventionalcommits.org/
