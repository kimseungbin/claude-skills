# Git Hooks Troubleshooting Guide

Common issues when working with git hooks and how to resolve them.

## Hook Not Running

### Symptom

Commits succeed without any hook output. No formatting, linting, or validation occurs.

### Diagnosis

```bash
# Check if hooks path is configured
git config core.hooksPath
```

### Solutions

**If output is empty or wrong**:

```bash
# Configure hooks path
git config core.hooksPath .githooks

# Verify
git config core.hooksPath  # Should output: .githooks
```

**If output is correct but hooks still don't run**:

1. **Verify `.githooks/` directory exists**:

    ```bash
    ls -la .githooks/
    # Should show pre-commit, commit-msg, etc.
    ```

2. **Check hook file permissions**:

    ```bash
    ls -l .githooks/
    # Should show -rwxr-xr-x (executable)
    ```

3. **Make hooks executable if needed**:
    ```bash
    chmod +x .githooks/*
    ```

**If hooks still don't run**:

- Check git version: `git --version` (need 2.9+)
- Try running hook manually: `.githooks/pre-commit`
- Check for shell errors in hook script

## Permission Denied Errors

### Symptom

```
permission denied: .githooks/pre-commit
```

### Root Cause

Hook scripts don't have execute permissions.

### Solution

```bash
# Make all hooks executable
chmod +x .githooks/*

# Verify permissions (should show -rwxr-xr-x)
ls -l .githooks/
```

**For all files in `.githooks/`**, you should see:

```
-rwxr-xr-x  1 user  group  1234 Nov  5 14:00 pre-commit
-rwxr-xr-x  1 user  group   567 Nov  5 14:00 commit-msg
```

The `x` in `-rwxr-xr-x` means executable.

## Hook Fails on Build/Lint/Test Errors

### Symptom

Commit is blocked with error messages like:

```
❌ Linting failed. Fix the issues above.
❌ Type checking failed. Fix type errors above.
❌ Build failed. Fix compilation errors above.
```

### Expected Behavior

**This is working correctly!** Hooks are preventing you from committing broken code.

### Solutions

#### Solution 1: Fix the Issues (Recommended)

```bash
# Fix formatting automatically
npm run format

# Check linting errors
npm run lint

# Fix auto-fixable linting issues
npm run lint:fix

# Check type errors
npm run type-check

# Verify build works
npm run build
```

Then commit again:

```bash
git add -u  # Stage fixes
git commit -m "Your message"
```

#### Solution 2: Bypass Temporarily (Use Sparingly)

```bash
# Skip hooks for this commit only
git commit --no-verify -m "WIP: Your message"

# Or use shorthand
git commit -n -m "WIP: Your message"
```

**Warning**: Only use `--no-verify` when:

- Committing work-in-progress (fix later)
- Emergency hotfix (fix issues immediately after)
- You understand the consequences

**Best practice**: Fix issues instead of bypassing. Hooks catch problems before CI/CD.

## Hook is Too Slow

### Symptom

Pre-commit hook takes more than 30 seconds to complete, slowing down development.

### Diagnosis

Time the hook:

```bash
time git commit --allow-empty -m "test"
```

Identify slow checks in hook output.

### Solutions

#### Solution 1: Remove Slow Checks from Pre-commit

Move expensive checks (>10s) to pre-push:

**Slow checks to move**:

- Full test suite → pre-push
- E2E tests → pre-push
- Docker build → pre-push or CI
- CDK synth/deploy → pre-push or CI

**Keep in pre-commit** (fast checks):

- Prettier (< 5s)
- ESLint auto-fix (< 10s)
- TypeScript type-check (< 10s)

#### Solution 2: Run Tests for Changed Files Only

Instead of full test suite:

```bash
# Fast: only test changed files
jest --findRelatedTests --bail $(git diff --cached --name-only)

# Slow: all tests
jest
```

#### Solution 3: Optimize Build

- Use incremental builds
- Cache dependencies
- Skip source maps in hooks

## Build Artifacts Left Behind

### Symptom

After a failed commit, you find `dist/`, `build/`, or `.tsbuildinfo` directories that weren't there before.

### Root Cause

Hook script ran build validation but failed before cleanup step.

### Solution

**Manual cleanup**:

```bash
# Remove build artifacts
rm -rf packages/*/dist
rm -rf packages/*/build
rm -f packages/*/.tsbuildinfo

# Or use project's clean script if available
npm run clean
```

**Prevention**: Ensure hook has cleanup step:

```bash
# In .githooks/pre-commit
npm run build || exit 1

# Always clean up, even if build fails
trap 'npm run clean' EXIT
```

## Hook Works Locally but Not in CI

### Symptom

Commits pass local pre-commit hooks but fail in CI/CD pipeline.

### Common Causes

1. **Hooks bypassed with `--no-verify`**
2. **CI runs checks that hooks don't**
3. **Different environment (Node version, dependencies)**

### Solutions

#### Don't bypass hooks

Avoid using `--no-verify` unless necessary. Fix issues locally.

#### Align hooks with CI

Ensure hooks check the same things as CI:

```bash
# If CI runs these, hooks should too
npm run format:check
npm run lint
npm run type-check
npm run test
```

#### Match environments

- Use same Node version locally and in CI
- Run `npm ci` (clean install) before testing
- Check `.nvmrc` or `.node-version` files

## Hook Runs on Wrong Files

### Symptom

Hook validates files you didn't change, or skips files you did change.

### Causes

1. Hook validates all files instead of staged files
2. `.gitignore` patterns not respected

### Solutions

#### Validate only staged files

Use `git diff --cached` to get staged files:

```bash
# Wrong: checks all files
npm run lint

# Right: checks only staged files
git diff --cached --name-only --diff-filter=d | grep -E '\.(ts|js)$' | xargs npm run lint --
```

#### Respect .gitignore

Use git's file listing instead of filesystem:

```bash
# Right: respects .gitignore
git diff --cached --name-only

# Wrong: includes ignored files
find . -name "*.ts"
```

## Hook Configuration Ignored

### Symptom

You updated `.claude/config/git-hooks.yaml` but hook behavior didn't change.

### Cause

Hook script doesn't read configuration file, or was generated before config existed.

### Solution

Regenerate hooks after config changes:

1. Update config: `.claude/config/git-hooks.yaml`
2. Re-run skill to regenerate hooks
3. Test hooks work with new config

## Multiple Hooks Conflict

### Symptom

You have hooks from multiple sources (Husky, pre-commit framework, custom scripts) and they conflict.

### Diagnosis

```bash
# Check for Husky
ls -la .husky/

# Check for pre-commit framework
cat .pre-commit-config.yaml

# Check custom hooks
ls -la .githooks/
ls -la .git/hooks/
```

### Solution

**Choose one approach**:

1. **Custom hooks** (`.githooks/`) - Simplest, project-specific
2. **Husky** - Popular npm package
3. **pre-commit** - Python-based, language-agnostic

**Remove others**:

```bash
# Remove Husky
npm uninstall husky
rm -rf .husky/

# Remove pre-commit framework
rm .pre-commit-config.yaml

# Use only custom hooks
git config core.hooksPath .githooks
```

## Windows-Specific Issues

### Issue 1: Line Endings (CRLF vs LF)

**Symptom**: Hook scripts fail with syntax errors on Windows.

**Solution**: Ensure hooks use LF line endings:

```bash
# In .gitattributes
.githooks/* text eol=lf
```

### Issue 2: Bash Not Available

**Symptom**: Hooks fail with "bash: command not found"

**Solution**: Use Git Bash (comes with Git for Windows)

### Issue 3: Permissions Not Preserved

**Symptom**: Hooks lose execute permissions after pull.

**Solution**: Git on Windows handles this automatically. If issues persist:

```bash
# Set fileMode to false
git config core.fileMode false
```

## Still Having Issues?

1. **Check hook script manually**: `.githooks/pre-commit`
2. **Look for syntax errors**: `bash -n .githooks/pre-commit`
3. **Run hook directly**: `./.githooks/pre-commit`
4. **Check git config**: `git config --list | grep hook`
5. **Check git version**: `git --version` (need 2.9+)
6. **Ask for help**: Include hook output and error messages

## Next Steps

- Review [setup-guide.md](setup-guide.md) for initial setup
- See [testing-hooks.md](testing-hooks.md) for testing strategies
- Check [../decision-tree.md](../decision-tree.md) for hook selection logic
