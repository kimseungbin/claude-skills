---
name: git-hooks-setup
description: |
    Analyze projects and generate custom git hooks tailored to the codebase.
    Use when user asks about git hooks, pre-commit checks, or hook configuration.
---

# Git Hooks Setup & Custom Generation

Generate custom git hooks tailored to your project's needs.

## When to Use This Skill

- User asks about git hooks, pre-commit checks, or hook configuration
- Setting up quality gates for a new project
- Adding validation to existing projects
- Troubleshooting hook issues

## Quick Start Workflow

### 1. Analyze Project

Read `package.json` to identify:

- **Project type**: Monorepo? AWS CDK? Frontend? Backend?
- **Available scripts**: format, lint, type-check, build, test
- **Tech stack**: TypeScript? Testing framework?

**See**: [guides/project-detection.md](guides/project-detection.md) for detailed analysis steps

### 2. Select Template

Based on project type:

- **Monorepo** → `examples/templates/pre-commit-monorepo.sh`
- **AWS CDK** → `examples/templates/pre-commit-aws-cdk.sh`
- **Simple TS/JS** → `examples/templates/pre-commit-basic.sh`

**See**: [decision-tree.md](decision-tree.md) for visual selection guide

### 3. Customize Hook

Adapt template to project's scripts:

```bash
# Include fast checks in pre-commit (<30s):
- Prettier (auto-fix, always)
- ESLint (auto-fix, usually)
- TypeScript type-check (blocking)

# Move slow checks to pre-push (>30s):
- Full test suite
- E2E tests
- Build validation
- Docker builds
```

**See**: [hooks/pre-commit-patterns.md](hooks/pre-commit-patterns.md) for common patterns

### 4. Handle Existing Issues

If project has many linting errors, make checks **non-blocking initially**:

```bash
if npm run lint:fix; then
    success
else
    warn "⚠️ Linting issues (non-blocking for now)"
    # TODO: Make blocking after refactoring
fi
```

**See**: [hooks/pre-commit-patterns.md#pattern-2-non-blocking-checks](hooks/pre-commit-patterns.md#pattern-2-non-blocking-checks-progressive-adoption)

### 5. Setup & Test

```bash
# Create hooks directory
mkdir -p .githooks

# Write hook script
cat > .githooks/pre-commit << 'EOF'
# ... hook content ...
EOF

# Make executable
chmod +x .githooks/pre-commit

# Configure git
git config core.hooksPath .githooks

# Test
git commit --allow-empty -m "test: Verify hooks"
git reset HEAD~1
```

**See**: [guides/setup-guide.md](guides/setup-guide.md) for complete setup

**See**: [guides/testing-hooks.md](guides/testing-hooks.md) for testing strategies

### 6. Document Choices

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

## Quick Reference

### Project Type Detection

- **Monorepo**: `workspaces` in package.json, `lerna.json`, `pnpm-workspace.yaml`
- **AWS CDK**: `aws-cdk-lib` in dependencies, `cdk.json` exists
- **TypeScript**: `tsconfig.json` exists, `typescript` in devDependencies
- **Frontend**: React/Vue/Svelte/Angular in dependencies
- **Backend**: NestJS/Express/Fastify in dependencies

### Available Tooling (Check package.json scripts)

- **Formatting**: `format`, `format:check`, `prettier`
- **Linting**: `lint`, `lint:fix`, `eslint`
- **Type checking**: `type-check`, `tsc`
- **Building**: `build`, `compile`
- **Testing**: `test`, `test:unit`, `test:e2e`

### Performance Rules

- **< 5s**: Always include in pre-commit
- **5-30s**: Include if important
- **> 30s**: Move to pre-push or CI

## Detailed Guides

- **Setup & Verification**: [guides/setup-guide.md](guides/setup-guide.md)
- **Project Analysis**: [guides/project-detection.md](guides/project-detection.md)
- **Hook Selection**: [decision-tree.md](decision-tree.md)
- **Common Patterns**: [hooks/pre-commit-patterns.md](hooks/pre-commit-patterns.md)
- **Testing Hooks**: [guides/testing-hooks.md](guides/testing-hooks.md)
- **Troubleshooting**: [guides/troubleshooting.md](guides/troubleshooting.md)

## Examples

- **Templates**: [examples/templates/](examples/templates/)
    - `pre-commit-basic.sh` - Simple TypeScript/JavaScript project
    - `pre-commit-monorepo.sh` - Multi-package workspace
    - `pre-commit-aws-cdk.sh` - AWS CDK infrastructure
    - `commit-msg-conventional.sh` - Conventional commits validation
    - `commit-msg-snapshot.sh` - Visual regression test validation
- **Real Implementations**: [examples/implementations/](examples/implementations/)
    - `monorepo-nestjs-cdk/` - Chatbot project with NestJS + CDK

## Key Principles

1. **Analyze first**: Understand project structure and available tooling
2. **Keep it fast**: Pre-commit should complete in <30 seconds
3. **Auto-fix when possible**: Prettier, ESLint --fix
4. **Progressive adoption**: Make checks non-blocking if needed, document improvement plan
5. **Test thoroughly**: Test hooks before sharing with team
6. **Document decisions**: Add git hooks section to project roadmap

## Common Patterns

### Auto-fix and Stage

```bash
npm run format
git add -u  # Stage auto-fixed changes
```

### Non-blocking Checks

```bash
if npm run lint:fix; then
    success
else
    warn "Issues detected (non-blocking)"
fi
```

### Strict Validation

```bash
npm run type-check || exit 1
```

See [hooks/pre-commit-patterns.md](hooks/pre-commit-patterns.md) for complete pattern library.

## Project-Specific Configuration

For project-specific requirements, create `.claude/config/git-hooks.yaml`:

```yaml
pre_commit:
    blocking:
        - format
        - type-check
    non_blocking:
        - lint # TODO: Make blocking after refactoring

    skip:
        - build # Too slow

commit_msg:
    require_conventional: true

pre_push:
    - test:e2e
    - docker:build
```

The skill will read this config and generate appropriate hooks.

## Troubleshooting

See [guides/troubleshooting.md](guides/troubleshooting.md) for common issues:

- Hook not running
- Permission denied errors
- Hook too slow
- Build artifacts left behind
- Windows-specific issues
