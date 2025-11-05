# Testing Git Hooks

How to test git hooks effectively before deploying them to your team.

## Why Test Hooks?

-   **Avoid blocking the team**: Broken hooks prevent everyone from committing
-   **Catch edge cases**: Unusual file types, empty commits, merge commits
-   **Verify performance**: Ensure hooks are fast enough (<30s)
-   **Test bypass behavior**: Confirm `--no-verify` works as expected

## Testing Workflow

### Step 1: Test Manually First

Before committing the hook, run it directly:

```bash
# Make hook executable
chmod +x .githooks/pre-commit

# Run hook manually
./.githooks/pre-commit
```

**Check for**:

-   Syntax errors
-   Missing commands (`command not found`)
-   Correct output messages
-   Proper exit codes

### Step 2: Test with Dummy Commit

Create a test commit to trigger the hook:

```bash
# Create trivial change
echo "# Test" >> README.md

# Stage the change
git add README.md

# Try to commit (hook will run)
git commit -m "test: Verify hooks work"

# Undo the test commit
git reset HEAD~1
git restore README.md
```

**Verify**:

-   Hook output appears
-   Hook completes successfully
-   Commit is created (or blocked, if expected)

### Step 3: Test Error Conditions

Intentionally break something to test hook validation:

#### Test Formatting Errors

```bash
# Create file with bad formatting
cat > test.ts <<'EOF'
const x={a:1,b:2};
function foo(){return x;}
EOF

git add test.ts
git commit -m "test: Bad formatting"

# Hook should catch this and auto-fix
# Verify test.ts is properly formatted after hook runs
```

#### Test Linting Errors

```bash
# Create file with lint errors
cat > test.ts <<'EOF'
const unused = 123;
function foo() {
    var x = 1;  // no-var rule
    return x;
}
EOF

git add test.ts
git commit -m "test: Lint errors"

# Verify hook catches errors and provides clear message
```

#### Test Type Errors

```bash
# Create file with type errors
cat > test.ts <<'EOF'
const x: string = 123;  // Type error
EOF

git add test.ts
git commit -m "test: Type error"

# Hook should block commit with clear error message
```

**Cleanup**:

```bash
git reset HEAD
rm test.ts
```

### Step 4: Test with Different File Types

Test hook behavior with various file types:

```bash
# TypeScript file
touch test.ts && git add test.ts

# JavaScript file
touch test.js && git add test.js

# JSON file
touch test.json && git add test.json

# Markdown file
touch test.md && git add test.md

# Try commit
git commit -m "test: Multiple file types"

# Cleanup
git reset HEAD
rm test.*
```

### Step 5: Test Hook Bypass

Verify that `--no-verify` works:

```bash
# Create intentional error
cat > test.ts <<'EOF'
const x: string = 123;  // Type error
EOF

git add test.ts

# Bypass hook (should succeed)
git commit --no-verify -m "test: Bypass hooks"

# Verify commit was created
git log -1 --oneline

# Cleanup
git reset HEAD~1
rm test.ts
```

## Performance Testing

### Measure Hook Execution Time

```bash
# Time the entire hook
time git commit --allow-empty -m "test: Performance"

# Undo test commit
git reset HEAD~1
```

**Targets**:

-   **Pre-commit**: < 30 seconds
-   **Commit-msg**: < 1 second
-   **Pre-push**: < 2 minutes

### Identify Slow Commands

Add timing to hook script temporarily:

```bash
#!/bin/bash
# Temporary: add timing to each command

echo "Timing format..."
time npm run format

echo "Timing lint..."
time npm run lint

echo "Timing type-check..."
time npm run type-check
```

**Optimize if needed**:

-   Move slow checks to pre-push
-   Check only staged files
-   Use parallel execution
-   Enable caching

## Testing Different Scenarios

### Scenario 1: Empty Commit

```bash
# Some hooks should allow empty commits
git commit --allow-empty -m "test: Empty commit"

# Verify hook handles this correctly
git reset HEAD~1
```

### Scenario 2: Merge Commit

```bash
# Create test branch
git checkout -b test-merge
echo "test" > test.txt
git add test.txt
git commit -m "test: Branch commit"

# Merge back
git checkout main
git merge test-merge

# Hooks may run differently on merge commits
# Cleanup
git reset --hard HEAD~1
git branch -D test-merge
rm -f test.txt
```

### Scenario 3: Amended Commit

```bash
# Create commit
echo "test" > test.txt
git add test.txt
git commit -m "test: Initial"

# Amend commit (hook runs again)
echo "more" >> test.txt
git add test.txt
git commit --amend --no-edit

# Cleanup
git reset --hard HEAD~1
rm -f test.txt
```

### Scenario 4: Large Commit

```bash
# Create many files
for i in {1..100}; do
    echo "test $i" > "file$i.ts"
done

git add file*.ts

# Time this commit
time git commit -m "test: Large commit"

# Verify hook performance is acceptable
git reset HEAD~1
rm -f file*.ts
```

### Scenario 5: Binary Files

```bash
# Create binary file
dd if=/dev/urandom of=test.bin bs=1M count=1

git add test.bin
git commit -m "test: Binary file"

# Hooks should skip binary files
git reset HEAD~1
rm test.bin
```

## Automated Testing

### Create Test Script

```bash
#!/bin/bash
# test-hooks.sh - Automated hook testing

set -e

echo "Testing git hooks..."

# Test 1: Hook runs on normal commit
echo "Test 1: Normal commit"
echo "test" > test.txt
git add test.txt
git commit -m "test: Normal" || { echo "❌ Test 1 failed"; exit 1; }
git reset --hard HEAD~1
rm -f test.txt
echo "✅ Test 1 passed"

# Test 2: Hook catches formatting errors
echo "Test 2: Formatting errors"
echo "const x={a:1};" > test.ts
git add test.ts
git commit -m "test: Format" || { echo "❌ Test 2 failed"; exit 1; }
# Check if file was auto-formatted
if grep -q "const x = { a: 1 };" test.ts; then
    echo "✅ Test 2 passed (auto-formatted)"
else
    echo "❌ Test 2 failed (not formatted)"
    exit 1
fi
git reset --hard HEAD~1
rm -f test.ts

# Test 3: Hook blocks type errors
echo "Test 3: Type errors"
echo "const x: string = 123;" > test.ts
git add test.ts
if git commit -m "test: Type error" 2>/dev/null; then
    echo "❌ Test 3 failed (should have blocked)"
    git reset --hard HEAD~1
    exit 1
else
    echo "✅ Test 3 passed (blocked correctly)"
fi
rm -f test.ts

# Test 4: Bypass works
echo "Test 4: Bypass with --no-verify"
echo "const x: string = 123;" > test.ts
git add test.ts
git commit --no-verify -m "test: Bypass" || { echo "❌ Test 4 failed"; exit 1; }
git reset --hard HEAD~1
rm -f test.ts
echo "✅ Test 4 passed"

echo "🎉 All tests passed!"
```

### Run Test Suite

```bash
# Make test script executable
chmod +x test-hooks.sh

# Run tests
./test-hooks.sh
```

## Testing for Team Deployment

Before sharing hooks with the team:

### 1. Test on Clean Clone

```bash
# Clone repo to temp location
cd /tmp
git clone /path/to/repo test-repo
cd test-repo

# Setup hooks as new user would
git config core.hooksPath .githooks
chmod +x .githooks/*

# Run tests
./test-hooks.sh
```

### 2. Test on Different Systems

-   **macOS**: Developer machines
-   **Linux**: CI/CD environment
-   **Windows**: Git Bash / WSL

### 3. Test with Different Shells

```bash
# Test with bash
bash .githooks/pre-commit

# Test with sh (POSIX)
sh .githooks/pre-commit

# Test with zsh (if using)
zsh .githooks/pre-commit
```

### 4. Document Test Results

Create `HOOKS.md` in your project:

```markdown
## Testing Results

### Performance

-   Format: 3s
-   Lint: 5s
-   Type-check: 7s
-   **Total**: 15s ✅

### Compatibility

-   ✅ macOS 14 (Sonoma)
-   ✅ Ubuntu 22.04
-   ✅ Windows 11 (Git Bash)

### Test Scenarios

-   ✅ Normal commits
-   ✅ Empty commits
-   ✅ Merge commits
-   ✅ Large commits (100+ files)
-   ✅ Binary files
-   ✅ Bypass with --no-verify
```

## Continuous Testing

### Test After Hook Updates

```bash
# After updating hooks
git pull

# Re-run tests
./test-hooks.sh

# If tests pass, commit
git add .githooks/
git commit -m "test: Verify updated hooks work"
```

### Monitor Hook Failures

Track how often hooks fail in practice:

```bash
# Add to hook script
LOG_FILE=".git/hook-stats.log"
echo "$(date): pre-commit ran" >> $LOG_FILE

# If hook fails
if [ $? -ne 0 ]; then
    echo "$(date): pre-commit failed" >> $LOG_FILE
fi
```

## Debugging Failed Hooks

### Enable Debug Mode

Add debug output to hooks temporarily:

```bash
#!/bin/bash
set -x  # Enable debug mode (prints every command)

npm run format
npm run lint
npm run type-check
```

### Check Hook Output

```bash
# Run hook and save output
./.githooks/pre-commit 2>&1 | tee hook-output.log

# Examine output
cat hook-output.log
```

### Test Individual Commands

```bash
# Test each hook command separately
npm run format
echo "Format exit code: $?"

npm run lint
echo "Lint exit code: $?"

npm run type-check
echo "Type-check exit code: $?"
```

## Best Practices

1. **Test before committing hook script**: Don't commit broken hooks
2. **Test on clean repository**: Ensure setup works for new clones
3. **Measure performance**: Keep hooks fast (<30s)
4. **Test error paths**: Verify hooks catch problems correctly
5. **Test bypass**: Confirm `--no-verify` works
6. **Document results**: Share test results with team
7. **Automate testing**: Create test script for regression testing

## Next Steps

-   Create automated test script
-   Run tests before hook updates
-   Document performance benchmarks
-   Share results with team
-   See [troubleshooting.md](troubleshooting.md) if issues occur
