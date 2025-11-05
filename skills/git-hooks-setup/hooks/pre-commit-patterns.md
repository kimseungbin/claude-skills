# Pre-commit Hook Patterns

Common patterns and best practices for pre-commit hooks, with real-world examples.

## Core Patterns

### Pattern 1: Auto-fix and Stage

**Use case**: Formatting tools that can auto-fix issues (Prettier, ESLint --fix)

```bash
# Run formatter
if npm run format; then
    echo "✅ Code formatting fixed"
    # Stage any auto-fixed changes
    git add -u
else
    echo "❌ Formatting failed"
    exit 1
fi
```

**Why**: Auto-fixes are applied and staged, so the commit includes corrections.

**Works with**: Prettier, ESLint --fix, Black (Python), Gofmt (Go), Rustfmt (Rust)

### Pattern 2: Non-blocking Checks (Progressive Adoption)

**Use case**: Introducing linting to a codebase with many existing errors

```bash
# Show errors but don't block commits
if npm run lint:fix; then
    echo "✅ Linting passed"
    git add -u
else
    echo ""
    echo "⚠️  Linting issues detected (non-blocking for now)"
    echo "   See docs/ROADMAP.md for refactoring plan"
    echo ""
    # TODO: Make blocking after fixing type safety issues
    # exit 1  # <-- Uncomment when ready
fi
```

**Why**:

- Allows development to continue
- Establishes baseline for gradual improvement
- Creates backlog of technical debt
- Prevents new violations from being introduced

**When to use**:

- Existing codebase with many lint errors
- Team is addressing tech debt incrementally
- Need to ship features while improving quality

**When to make blocking**:

- After tech debt addressed
- Before production deployment
- Team consensus reached

**Example from this session**:

The chatbot project had 50 linting errors (unsafe `any` usage, prefer `??` over `||`). We made linting non-blocking to allow development while planning refactoring in Phase 2.

### Pattern 3: Strict Validation

**Use case**: New projects, critical checks that must never fail

```bash
# Type-check is always blocking
if npm run type-check; then
    echo "✅ Type checking passed"
else
    echo "❌ Type checking failed. Fix errors above."
    exit 1
fi
```

**Why**: Catches real errors that break functionality.

**Use for**:

- TypeScript type-check
- Syntax validation
- Critical security checks

### Pattern 4: Conditional Checks

**Use case**: Only run checks when relevant files changed

```bash
# Only run tests if source files changed
if git diff --cached --name-only | grep -qE '\.(ts|js)$'; then
    echo "Running tests for changed files..."
    npm run test -- --findRelatedTests $(git diff --cached --name-only --diff-filter=d)
else
    echo "No source files changed, skipping tests"
fi
```

**Why**: Saves time when only docs or config files changed.

### Pattern 5: Cleanup Trap

**Use case**: Ensure cleanup happens even if hook fails

```bash
#!/bin/bash
set -e

# Setup cleanup trap
cleanup() {
    echo "Cleaning up..."
    rm -rf dist/ build/
}
trap cleanup EXIT

# Run checks
npm run build  # May fail
npm run test   # May fail

# Cleanup runs automatically even if above commands fail
```

**Why**: Prevents build artifacts from polluting working directory.

## Real-World Examples

### Example 1: Simple TypeScript Project

```bash
#!/bin/sh
# .githooks/pre-commit
# Simple TS project: format, lint, type-check

set -e

echo "🎣 Pre-commit: Running checks..."

# 1. Auto-fix formatting
echo "▶ Formatting..."
npm run format
git add -u

# 2. Auto-fix linting
echo "▶ Linting..."
npm run lint:fix
git add -u

# 3. Type-check (blocking)
echo "▶ Type checking..."
npm run type-check || exit 1

echo "✅ All checks passed!"
exit 0
```

### Example 2: Monorepo with Multiple Packages

```bash
#!/bin/sh
# .githooks/pre-commit
# Monorepo: workspace-level checks

set -e

echo "🎣 Pre-commit: Monorepo checks..."

# 1. Format all workspaces
echo "▶ Formatting all packages..."
npm run format --workspaces
git add -u

# 2. Lint all workspaces
echo "▶ Linting all packages..."
npm run lint:fix --workspaces
git add -u

# 3. Type-check all workspaces
echo "▶ Type checking all packages..."
npm run type-check --workspaces || exit 1

echo "✅ All packages passed!"
exit 0
```

### Example 3: Progressive Adoption (This Session's Pattern)

```bash
#!/bin/sh
# .githooks/pre-commit
# Chatbot project: format (strict), lint (non-blocking), type-check (strict)

set -e

echo "=========================================="
echo "🎣 Git Hook: Pre-commit (Chatbot)"
echo "=========================================="
echo ""

print_step() {
    echo "▶ $1"
    echo "------------------------------------------"
}

print_success() {
    echo "✅ $1"
    echo ""
}

print_error() {
    echo ""
    echo "❌ $1"
    echo "=========================================="
    echo "💡 Tip: Fix the issues above and try again"
    echo "   Or use --no-verify to skip hooks (not recommended)"
    echo "=========================================="
    exit 1
}

# 1. Auto-fix formatting with Prettier
print_step "Auto-fixing code formatting with Prettier..."
if npm run format; then
    print_success "Code formatting fixed"
    git add -u
else
    print_error "Code formatting failed. Check the errors above."
fi

# 2. Auto-fix linting with ESLint (non-blocking)
print_step "Auto-fixing linting issues with ESLint..."
if npm run lint:fix; then
    print_success "Linting issues fixed"
    git add -u
else
    echo ""
    echo "⚠️  Linting issues detected (non-blocking for now)"
    echo "   See docs/ROADMAP.md for type safety refactoring plan"
    echo ""
    # TODO: Make this blocking after fixing type safety issues
    # print_error "Linting failed. Fix the issues above."
fi

# 3. Type check all workspaces
print_step "Type checking all workspaces..."
if npm run type-check; then
    print_success "Type checking passed"
else
    print_error "Type checking failed. Fix type errors above."
fi

echo "=========================================="
echo "✅ All pre-commit checks passed!"
echo "=========================================="
echo "💡 Passing: format ✅ lint ⚠️ type-check ✅"
echo "   Future: build validation, commit-msg format"
echo "=========================================="
echo ""

exit 0
```

**Key features**:

- Helpful output with emojis and separators
- Clear distinction between blocking and non-blocking
- Guidance in error messages
- Plans for future enhancements documented in output

### Example 4: AWS CDK Project

```bash
#!/bin/sh
# .githooks/pre-commit
# AWS CDK: format, lint, type-check, cdk diff

set -e

echo "🎣 Pre-commit: AWS CDK checks..."

# 1. Format
npm run format
git add -u

# 2. Lint
npm run lint:fix
git add -u

# 3. Type-check
npm run type-check || exit 1

# 4. CDK synth (validate infrastructure)
echo "▶ Validating CDK stacks..."
cd packages/infra
npm run synth || exit 1
cd ../..

# Clean up CDK output
rm -rf packages/infra/cdk.out

echo "✅ All checks passed!"
exit 0
```

## Advanced Patterns

### Pattern 6: Parallel Checks

**Use case**: Run independent checks in parallel for speed

```bash
#!/bin/bash
# Run multiple checks in parallel

# Start background jobs
npm run lint &
PID_LINT=$!

npm run type-check &
PID_TYPE=$!

npm run test:unit &
PID_TEST=$!

# Wait for all jobs
wait $PID_LINT || exit 1
wait $PID_TYPE || exit 1
wait $PID_TEST || exit 1

echo "✅ All parallel checks passed!"
```

**Why**: Can reduce total time if checks are CPU-independent.

**Caution**: Output can be interleaved and confusing.

### Pattern 7: Staged Files Only

**Use case**: Only validate files being committed

```bash
#!/bin/bash
# Get list of staged TypeScript files
STAGED_TS_FILES=$(git diff --cached --name-only --diff-filter=d | grep -E '\.tsx?$')

if [ -z "$STAGED_TS_FILES" ]; then
    echo "No TypeScript files staged, skipping checks"
    exit 0
fi

# Run ESLint only on staged files
echo "Linting staged files..."
npx eslint $STAGED_TS_FILES --fix

# Stage any fixes
git add $STAGED_TS_FILES

# Type-check entire project (can't do partial)
npm run type-check || exit 1
```

**Why**: Faster for large codebases, only checks what changed.

### Pattern 8: Smart Test Running

**Use case**: Run tests only for changed code

```bash
#!/bin/bash
# Get changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=d)

# Run tests for related files only
if [ -n "$CHANGED_FILES" ]; then
    echo "Running tests for changed files..."
    npx jest --findRelatedTests --bail $CHANGED_FILES
else
    echo "No files changed, skipping tests"
fi
```

**Why**: Much faster than full test suite.

## Performance Optimization

### Make It Fast

Pre-commit hooks should complete in < 30 seconds. If slower:

1. **Remove slow checks**: Move to pre-push or CI
2. **Run in parallel**: Use background jobs
3. **Check only staged files**: Not the entire codebase
4. **Skip tests**: Move to pre-push
5. **Cache results**: Use tool-specific caching

### Measure Performance

```bash
# Time individual checks
time npm run format
time npm run lint
time npm run type-check

# Time entire hook
time ./.githooks/pre-commit
```

**Targets**:

- Formatting: < 5s
- Linting: < 10s
- Type-check: < 10s
- **Total**: < 30s

## Common Mistakes to Avoid

### ❌ Don't: Validate all files

```bash
# Wrong: checks entire codebase
npm run lint
```

### ✅ Do: Validate staged files

```bash
# Right: checks only what's being committed
git diff --cached --name-only | xargs npm run lint --
```

### ❌ Don't: Forget to stage fixes

```bash
# Wrong: fixes not included in commit
npm run lint:fix
# <-- Missing git add -u
```

### ✅ Do: Stage auto-fixes

```bash
# Right: fixes included in commit
npm run lint:fix
git add -u
```

### ❌ Don't: Run slow tests in pre-commit

```bash
# Wrong: E2E tests too slow
npm run test:e2e  # Takes 5 minutes
```

### ✅ Do: Move slow tests to pre-push

```bash
# Right: only fast checks in pre-commit
npm run test:unit --changed  # Takes 5 seconds
```

### ❌ Don't: Fail silently

```bash
# Wrong: errors not visible
npm run lint > /dev/null 2>&1
```

### ✅ Do: Show helpful output

```bash
# Right: clear error messages
if ! npm run lint; then
    echo "❌ Linting failed. Run 'npm run lint:fix' to auto-fix."
    exit 1
fi
```

## Template Reference

See `../examples/templates/` for complete hook templates:

- `pre-commit-basic.sh` - Simple TypeScript/JavaScript project
- `pre-commit-monorepo.sh` - Multi-package workspace
- `pre-commit-aws-cdk.sh` - AWS CDK infrastructure
- `helpers.sh` - Shared helper functions

## Next Steps

- Apply pattern to your project
- Test performance with `time ./.githooks/pre-commit`
- Document choices in project roadmap
- See [../decision-tree.md](../decision-tree.md) for selection logic
