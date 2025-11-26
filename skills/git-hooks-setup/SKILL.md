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

## Quick Start: Copy Bundles

**Recommended approach**: Copy pre-built bundles instead of generating from scratch.

```bash
# 1. Copy base bundle (required - contains shared lib)
cp -r bundles/base/.githooks/ .githooks/

# 2. Choose hooks for your project
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg

# 3. Make executable
chmod +x .githooks/*

# 4. Configure git
git config core.hooksPath .githooks
```

**See**: [bundles/README.md](bundles/README.md) for complete recipes by project type.

## Available Bundles

### Base Bundle (Required)

Always copy first. Contains shared library functions.

```
bundles/base/.githooks/
├── lib/                    # Shared functions
│   ├── colors.sh           # Terminal colors and symbols
│   ├── output.sh           # Message formatting
│   └── utils.sh            # Utilities
├── scripts/
│   ├── check-file-sizes.sh # File size warnings
│   └── file-size-limits.yaml
└── README.md
```

### Pre-commit Hooks

| Hook | Project Type | Checks |
|------|--------------|--------|
| `basic.sh` | Simple TS/JS | Format, lint, type-check |
| `monorepo.sh` | Workspaces | Workspace-aware + build |

### Pre-push Hooks

| Hook | Project Type | Checks |
|------|--------------|--------|
| `cdk-safety.sh` | AWS CDK | Synth, diff, resource safety |

### Commit-msg Hooks

| Hook | Use Case | Validates |
|------|----------|-----------|
| `conventional.sh` | Conventional Commits | type(scope): subject |
| `skill-enforcement.sh` | Claude Code teams | Skill footer tag |

## Project Type Recipes

### Simple TypeScript Project

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg
git config core.hooksPath .githooks
```

### AWS CDK Project

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-push/cdk-safety.sh .githooks/pre-push
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg
chmod +x .githooks/pre-push .githooks/commit-msg
git config core.hooksPath .githooks
```

### Monorepo Project

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-commit/monorepo.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg
git config core.hooksPath .githooks
```

## Alternative: Custom Generation

If bundles don't fit your needs, generate custom hooks:

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

## Quick Reference

### Project Type Detection

- **Monorepo**: `workspaces` in package.json, `lerna.json`, `pnpm-workspace.yaml`
- **AWS CDK**: `aws-cdk-lib` in dependencies, `cdk.json` exists
- **TypeScript**: `tsconfig.json` exists, `typescript` in devDependencies
- **Frontend**: React/Vue/Svelte/Angular in dependencies
- **Backend**: NestJS/Express/Fastify in dependencies

### Performance Rules

- **< 5s**: Always include in pre-commit
- **5-30s**: Include if important
- **> 30s**: Move to pre-push or CI

## Detailed Resources

### Bundles

- **Bundle Overview**: [bundles/README.md](bundles/README.md)
- **Pre-commit Hooks**: [bundles/hooks/pre-commit/README.md](bundles/hooks/pre-commit/README.md)
- **Pre-push Hooks**: [bundles/hooks/pre-push/README.md](bundles/hooks/pre-push/README.md)
- **Commit-msg Hooks**: [bundles/hooks/commit-msg/README.md](bundles/hooks/commit-msg/README.md)

### Guides

- **Setup & Verification**: [guides/setup-guide.md](guides/setup-guide.md)
- **Project Analysis**: [guides/project-detection.md](guides/project-detection.md)
- **Hook Selection**: [decision-tree.md](decision-tree.md)
- **Common Patterns**: [hooks/pre-commit-patterns.md](hooks/pre-commit-patterns.md)
- **Testing Hooks**: [guides/testing-hooks.md](guides/testing-hooks.md)
- **Troubleshooting**: [guides/troubleshooting.md](guides/troubleshooting.md)

### Legacy Templates

- **Templates**: [examples/templates/](examples/templates/)
- **Real Implementations**: [examples/implementations/](examples/implementations/)

## Key Principles

1. **Copy bundles first**: Use pre-built bundles for common project types
2. **Keep it fast**: Pre-commit should complete in <30 seconds
3. **Auto-fix when possible**: Prettier, ESLint --fix
4. **Progressive adoption**: Make checks non-blocking if needed
5. **Test thoroughly**: Test hooks before sharing with team

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