# Implementation Example: Monorepo with NestJS Backend + AWS CDK Infrastructure

Real-world git hooks implementation from the Slack + Bedrock chatbot project.

## Project Overview

-   **Type**: npm workspaces monorepo
-   **Packages**:
    -   `packages/backend` - NestJS application (Slack bot + Bedrock AI)
    -   `packages/infra` - AWS CDK infrastructure (ECS, VPC, OpenSearch, Redis)
-   **Tech Stack**: TypeScript, NestJS, AWS CDK, ESLint 9, Prettier, Vitest
-   **Team Size**: Individual developer (extendable to team)
-   **Phase**: Week 3 of 24 (early development)

## Hook Configuration

### Pre-commit Hook

**Location**: `.githooks/pre-commit` (see `pre-commit` file in this directory)

**Checks**:

1. **Prettier** (auto-fix, blocking)
    - Command: `npm run format`
    - Time: ~3-5s
    - Result: Auto-stages formatting fixes
2. **ESLint** (auto-fix, **non-blocking**)
    - Command: `npm run lint:fix`
    - Time: ~5-7s
    - Result: Warns about issues but doesn't block
    - **Why non-blocking**: 50 existing type safety errors to address in Phase 2
3. **TypeScript type-check** (blocking)
    - Command: `npm run type-check`
    - Time: ~7-10s
    - Result: Blocks commit on type errors

**Total Time**: ~15-22 seconds ✅

### Future Hooks (Documented)

-   **Commit-msg**: Conventional commits validation (using `conventional-commits` skill)
-   **Pre-push**: Full test suite, build validation, CDK diff for infra changes

See project's `docs/ROADMAP.md` for detailed plans.

## Design Decisions

### Why Non-blocking Linting?

**Problem**: Existing codebase had 50 linting errors:

-   Unsafe `any` usage in AWS SDK and Slack Bolt.js types
-   Prefer `??` over `||` (nullish coalescing)
-   Floating promises in `main.ts`
-   Missing error type assertions

**Solution**: Made linting non-blocking initially to:

1. Allow development to continue (not block team)
2. Establish baseline for gradual improvement
3. Create backlog of technical debt
4. Prevent new violations

**Pattern Used**:

```bash
if npm run lint:fix; then
    success
else
    warn "⚠️ Linting issues detected (non-blocking for now)"
    # TODO: Make blocking after Phase 2 refactoring
fi
```

**When to make blocking**: After completing type safety refactoring in Phase 2.

### Why Skip Build Validation?

**Decision**: Build validation not included in pre-commit.

**Reasons**:

1. **Speed**: Backend build takes ~15s, infra synth takes ~20s
2. **Type-check already runs**: Catches most build issues
3. **CI validates builds**: GitHub Actions runs full build pipeline

**Future**: May add build validation to pre-push hook.

### Why No Tests in Pre-commit?

**Decision**: Tests not included in pre-commit (yet).

**Reasons**:

1. **Tests not yet implemented**: Phase 1 MVP, tests planned for Phase 2+
2. **Keep hooks fast**: Tests can be slow, want pre-commit <30s
3. **CI runs tests**: GitHub Actions will run full test suite

**Future**: Add fast unit tests to pre-push hook when implemented.

## Package.json Scripts

**Root**:

```json
{
    "scripts": {
        "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
        "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
        "lint": "eslint .",
        "lint:fix": "eslint . --fix",
        "type-check": "tsc --noEmit"
    }
}
```

**Backend** (`packages/backend/package.json`):

```json
{
    "scripts": {
        "build": "nest build",
        "start:dev": "nest start --watch",
        "test": "vitest"
    }
}
```

**Infrastructure** (`packages/infra/package.json`):

```json
{
    "scripts": {
        "build": "tsc",
        "synth": "cdk synth",
        "deploy": "cdk deploy --all",
        "diff": "cdk diff"
    }
}
```

## Setup Instructions

**For new team members**:

1. Clone repository

2. Install dependencies:

    ```bash
    npm install
    ```

3. Configure git hooks:

    ```bash
    git config core.hooksPath .githooks
    chmod +x .githooks/*
    ```

4. Verify setup:
    ```bash
    git config core.hooksPath  # Should output: .githooks
    ```

5. Test hooks:
    ```bash
    git commit --allow-empty -m "test: Verify hooks"
    git reset HEAD~1
    ```

## Hook Output Example

```
==========================================
🎣 Git Hook: Pre-commit (Chatbot)
==========================================

▶ Auto-fixing code formatting with Prettier...
------------------------------------------

> slack-bedrock-chatbot@1.0.0 format
> prettier --write "**/*.{ts,tsx,json,md}"

✅ Code formatting fixed

▶ Auto-fixing linting issues with ESLint...
------------------------------------------

> slack-bedrock-chatbot@1.0.0 lint:fix
> eslint . --fix

⚠️  Linting issues detected (non-blocking for now)
   See docs/ROADMAP.md for type safety refactoring plan

▶ Type checking all workspaces...
------------------------------------------

> slack-bedrock-chatbot@1.0.0 type-check
> tsc --noEmit

✅ Type checking passed

==========================================
✅ All pre-commit checks passed!
==========================================
💡 Passing: format ✅ lint ⚠️ type-check ✅
   Future: build validation, commit-msg format
==========================================
```

## Project Structure

```
chatbot/
├── .githooks/
│   └── pre-commit              # Custom hook script
├── .claude/
│   ├── config/
│   │   └── conventional-commits.yaml  # Project-specific commit rules
│   └── skills/                 # Symlinks to claude-skills submodule
├── packages/
│   ├── backend/                # NestJS application
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── infra/                  # AWS CDK infrastructure
│       ├── lib/
│       ├── package.json
│       └── cdk.json
├── docs/
│   ├── ROADMAP.md              # Documents git hooks roadmap
│   └── ...
├── package.json                # Workspace root
├── tsconfig.base.json          # Shared TS config
└── eslint.config.js            # Shared ESLint config (v9 flat)
```

## Lessons Learned

### What Worked Well

1. **Progressive adoption** ✅
    - Non-blocking linting allowed development to continue
    - Documented technical debt in roadmap
    - Clear plan for making strict later
2. **Helper functions** ✅
    - `print_step`, `print_success`, `print_error` make output clear
    - Helpful error messages guide users
3. **Auto-fix and stage** ✅
    - Prettier/ESLint auto-fixes included in commit
    - No manual `git add` needed after auto-fixes

### What Could Be Better

1. **Performance monitoring**
    - Should add timing output: "Formatting took 3s"
    - Would help identify slow checks
2. **Conditional checks**
    - Could skip checks if no relevant files changed
    - Example: Skip type-check if only `.md` files changed
3. **Parallel execution**
    - Format, lint, type-check are independent
    - Could run in parallel to save time

## Testing

**Manual testing performed**:

-   ✅ Normal commits with various file types
-   ✅ Commits with formatting errors (auto-fixed)
-   ✅ Commits with type errors (blocked)
-   ✅ Hook bypass with `--no-verify`
-   ✅ Performance measurement (~15-22s)

**No automated tests yet** (planned for future).

## References

-   **Project**: Slack + Bedrock chatbot (self-updating knowledge bot)
-   **Roadmap**: `docs/ROADMAP.md` in project root
-   **Commit rules**: `.claude/config/conventional-commits.yaml`
-   **Hook source**: This implementation was created in November 2025 during Phase 1 Week 3

## Applying to Your Project

**If your project is similar** (monorepo, TypeScript, NestJS/CDK):

1. Copy `pre-commit` hook to your `.githooks/`
2. Adjust commands to match your `package.json` scripts
3. Decide which checks should be blocking vs non-blocking
4. Test performance with `time git commit --allow-empty -m "test"`
5. Document decisions in your roadmap

**If your project differs**:

-   Use this as a reference for progressive adoption pattern
-   See `../templates/` for other project types
-   Read `../../decision-tree.md` for selection logic

## Next Steps

-   Implement commit-msg hook for conventional commits
-   Add pre-push hook with tests and build validation
-   Make linting blocking after Phase 2 refactoring
-   Add automated hook testing
-   Consider parallel execution for performance
