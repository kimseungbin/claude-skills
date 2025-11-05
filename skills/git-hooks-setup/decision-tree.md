# Git Hooks Decision Tree

Quick visual guide for selecting and configuring git hooks for your project.

## Step 1: Analyze Project Type

```
Is it a monorepo (workspaces, lerna, nx)?
├─ YES → Use pre-commit-monorepo.sh template
│         - Handles multiple packages
│         - Workspace-level commands
│         - Per-package validation
│
└─ NO
   │
   ├─ AWS CDK project (cdk.json, aws-cdk-lib)?
   │  └─ YES → Use pre-commit-aws-cdk.sh template
   │            - CDK synth validation
   │            - IAM/security checks
   │            - CloudFormation validation
   │
   └─ NO → Use pre-commit-basic.sh template
           - Single package
           - Standard tooling
           - Simple workflow
```

## Step 2: Choose Pre-commit Checks

**Rule**: Only include checks that complete in <30 seconds

### Always Include (Fast)

- ✅ **Prettier** (auto-fix, always fast)
  - `npm run format` or `prettier --write`
  - Auto-stage fixed files with `git add -u`

### Usually Include (Fast)

- ✅ **ESLint** (auto-fix, usually fast)
  - `npm run lint:fix` or `eslint . --fix`
  - Auto-stage fixed files
  - **Pattern**: Make non-blocking if many existing errors

- ✅ **TypeScript type-check** (fast, no output)
  - `npm run type-check` or `tsc --noEmit`
  - Blocking (catches type errors)

### Consider (Depends on Size)

- ⚠️ **Unit tests for changed files**
  - Fast: `jest --findRelatedTests --bail`
  - Skip if test suite is slow (>10s)

- ⚠️ **Build validation**
  - Fast for small projects
  - Skip for large monorepos (move to pre-push)

### Never Include (Slow)

- ❌ **Full test suite** → Move to pre-push
- ❌ **E2E tests** → Move to pre-push
- ❌ **Docker build** → Move to pre-push or CI
- ❌ **CDK deploy** → Never in hooks, only in CI

## Step 3: Handle Existing Issues

```
Does the project have many existing linting errors?
├─ YES → Make linting non-blocking initially
│        if npm run lint:fix; then
│          success
│        else
│          warn "Linting issues (non-blocking for now)"
│          # TODO: Make blocking after refactoring
│        fi
│
└─ NO → Make linting blocking
        npm run lint:fix || exit 1
```

## Step 4: Choose Commit-msg Validation

```
Do you need commit message validation?
├─ YES
│  │
│  ├─ Conventional Commits format?
│  │  └─ YES → Use commit-msg-conventional.sh
│  │           - Validates type(scope): subject format
│  │           - Checks allowed types/scopes
│  │           - Requires proper formatting
│  │
│  ├─ Visual regression tests (Playwright, Percy)?
│  │  └─ YES → Use commit-msg-snapshot.sh
│  │           - Requires "Snapshots: update" or "Snapshots: skip"
│  │           - Prevents forgotten snapshot updates
│  │           - Only for UI file changes
│  │
│  └─ Custom validation?
│     └─ Write custom commit-msg hook
│
└─ NO → Skip commit-msg hook
```

## Step 5: Choose Pre-push Checks

**Rule**: Include expensive checks (>30s) here

### Common Pre-push Checks

- ✅ **Full test suite**
  - `npm test` or `npm run test:ci`
  - All unit + integration tests

- ✅ **E2E tests** (if applicable)
  - `npm run test:e2e`
  - Docker-based tests
  - Visual regression tests

- ✅ **Build validation**
  - `npm run build` (all packages)
  - Ensures production build works

- ✅ **CDK diff** (for infrastructure changes)
  - `cd packages/infra && npm run diff`
  - Warns about infrastructure changes
  - Prevents accidental deployments

- ✅ **Security checks**
  - Check for sensitive data (API keys, secrets)
  - `npm audit` for vulnerabilities
  - Git history scanning

## Step 6: Document Your Choices

Add to project's `docs/ROADMAP.md` or `DEVELOPMENT.md`:

```markdown
## Git Hooks

### Pre-commit ✅
- Auto-fix formatting (Prettier)
- Auto-fix linting (ESLint, non-blocking)
- Type checking (TypeScript)

### Future Enhancements
- [ ] Make linting blocking after refactoring
- [ ] Add commit-msg validation
- [ ] Add pre-push hook (tests, build)
```

## Quick Decision Matrix

| Project Type          | Pre-commit Template       | Typical Checks                  | Commit-msg      |
| --------------------- | ------------------------- | ------------------------------- | --------------- |
| Simple TS/JS          | pre-commit-basic.sh       | format, lint, type-check        | Optional        |
| Monorepo              | pre-commit-monorepo.sh    | format, lint, type-check        | Recommended     |
| AWS CDK               | pre-commit-aws-cdk.sh     | format, lint, type-check, synth | Recommended     |
| Frontend (React/Vue)  | pre-commit-basic.sh       | format, lint, type-check, test  | snapshot.sh     |
| Backend (Node/NestJS) | pre-commit-basic.sh       | format, lint, type-check, test  | conventional.sh |

## Common Patterns

### Pattern 1: Strict Quality Gates

```bash
# All checks blocking, no mercy
npm run format:check || exit 1
npm run lint || exit 1
npm run type-check || exit 1
npm run test:unit || exit 1
```

**Use when**: New project, team agrees on strict quality

### Pattern 2: Progressive Enhancement

```bash
# Auto-fix what we can, warn about the rest
npm run format  # Auto-fix
npm run lint:fix  # Auto-fix

# Type-check is blocking (catches real errors)
npm run type-check || exit 1
```

**Use when**: Most projects, balances speed and quality

### Pattern 3: Gradual Adoption

```bash
# Format is auto-fixed and blocking
npm run format || exit 1

# Lint shows warnings but doesn't block
npm run lint:fix || echo "⚠️  Lint issues (non-blocking)"

# Type-check is strict
npm run type-check || exit 1
```

**Use when**: Existing project with technical debt

## Example: This Chatbot Project

**Project type**: Monorepo (NestJS backend + AWS CDK infra)

**Chosen hooks**:

- ✅ Pre-commit: format (auto-fix), lint (non-blocking), type-check (blocking)
- 🔄 Future: commit-msg validation (conventional commits)
- 🔄 Future: pre-push (tests, build, CDK diff)

**Rationale**:

- Format/type-check: Fast, catches real issues
- Lint non-blocking: 50 existing errors to fix in Phase 2
- No pre-push yet: Tests not yet implemented

**See**: `examples/implementations/monorepo-nestjs-cdk/`
