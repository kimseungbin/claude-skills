# Git Hooks Decision Tree

Quick visual guide for selecting and configuring git hooks for your project.

Every hook named here ships in `bundles/hooks/` and needs `bundles/base/.githooks/` copied first. See [bundles/README.md](../bundles/README.md) for copy-paste recipes.

## Step 1: Choose a Pre-commit Bundle

```
Is it a monorepo (workspaces, lerna, nx)?
├─ YES → pre-commit/monorepo.sh
│         - Prettier + ESLint auto-fix on staged files
│         - Type-checks and builds all workspaces
│         - Cleans build artifacts before and after
│
└─ NO
   │
   ├─ CSS / design system with tokens (Stylelint)?
   │  └─ YES → pre-commit/with-stylelint.sh
   │            - Prettier + ESLint auto-fix on staged files
   │            - Stylelint on staged CSS
   │            - WCAG contrast check when a token file is staged
   │            - Type check
   │
   └─ NO → pre-commit/basic.sh
           - Prettier + ESLint auto-fix on staged files
           - Type check
```

All three run `npm run type-check` and block on failure, so the project needs that script (`tsc --noEmit` for TypeScript). `monorepo.sh` also runs `npm run build`.

AWS CDK projects (`cdk.json`, `aws-cdk-lib`) add `pre-push/cdk-safety.sh` on top — see Step 5.

## Step 2: Choose Pre-commit Checks

**Rule**: Only include checks that complete in <30 seconds

### Always Include (Fast)

- ✅ **Prettier** (auto-fix, always fast)
    - `npm run format` or `prettier --write`
    - Auto-stage only the fixed files with `git add -- <changed-files>`

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
│  │  └─ YES → commit-msg/conventional.sh
│  │           - Validates the subject line: type(scope)!: subject
│  │           - Types and scopes from .claude/config/git/commit/main.yaml
│  │           - Standard Conventional Commits types when no config exists
│  │
│  └─ Other rules (ticket IDs, required footers)?
│     └─ Write a custom commit-msg hook
│
└─ NO → Skip commit-msg hook
```

`conventional.sh` reads the same config as the commit skill, so generate it with `Skill(git:commit-config)` when the project has its own types or scopes. Full rules: [commit-msg/README.md](../bundles/hooks/commit-msg/README.md).

## Step 5: Choose Pre-push Checks

**Rule**: Include expensive checks (>30s) here

### AWS CDK → `pre-push/cdk-safety.sh`

- `npm run build` and `npm run lint:check`
- `npm run cdk synth` validation
- `npm run cdk diff` analysis, blocking replacement of fixed-name resources (ECS services, RDS instances, load balancers)
- File size warnings (non-blocking)

Runs only when pushing a deployment branch: `main`, `master`, `staging`, `prod`, `production`, or the list in `.githooks/config/deployment-branches.txt`. Other branches push without checks.

### Common Pre-push Checks

No other pre-push bundle ships; write a custom `.githooks/pre-push` for these.

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

| Project Type                  | Pre-commit                   | Pre-push                | Commit-msg                 |
| ----------------------------- | ---------------------------- | ----------------------- | -------------------------- |
| Single package (TS/JS)        | `pre-commit/basic.sh`        | —                       | `commit-msg/conventional.sh` |
| CSS / design system           | `pre-commit/with-stylelint.sh` | —                     | `commit-msg/conventional.sh` |
| Monorepo                      | `pre-commit/monorepo.sh`     | —                       | `commit-msg/conventional.sh` |
| AWS CDK                       | `pre-commit/basic.sh` (optional) | `pre-push/cdk-safety.sh` | `commit-msg/conventional.sh` |

Frontend and backend frameworks (React, Vue, NestJS, Express) need no bundle of their own — they are single packages or monorepos. Tests have no bundled hook; add them to a custom pre-push (Step 5).

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
