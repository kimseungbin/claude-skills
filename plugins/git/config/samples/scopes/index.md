# Commit Scopes Index

Quick reference for selecting scope. Read the specific yaml file only when you need pattern matching for complex changes.

## Decision Tree

```
What files changed?
├─ Single component/service? ──────→ Use component name
├─ Configuration files only? ──────→ config
├─ Documentation only? ────────────→ docs or project
├─ Multiple related components? ───→ Use parent scope
└─ Tooling/CI/build files? ────────→ tools, ci, or build
```

## Scope Selection Rules

1. **Be specific**: Use the most specific scope that covers the changes
2. **Avoid generic**: `app`, `code`, `files` are too generic
3. **Match project style**: Check git log for existing scope patterns

## Available Scope Categories

| Category | Use When | Read Detail When |
|----------|----------|------------------|
| `infrastructure` | CDK/Terraform constructs | Multiple construct files changed |
| `configuration` | Config files (.yaml, .json, .env) | Mixed config types |
| `documentation` | Docs, README, CLAUDE.md | Multiple doc locations |
| `tooling` | Scripts, hooks, dev tools | CI vs local tooling |

## When to Read Detailed Files

Only read the specific scope yaml when:
- **infrastructure.yaml**: Multiple CDK constructs, unsure which scope
- **configuration.yaml**: Multiple config file types changed
- **documentation.yaml**: Docs in multiple locations (README, docs/, CLAUDE.md)
- **tooling.yaml**: CI/CD vs local tooling vs build scripts

## Files

- `infrastructure.yaml` - CDK/Terraform/IaC scope patterns
- `configuration.yaml` - Config file scope patterns
- `documentation.yaml` - Documentation scope patterns
- `tooling.yaml` - Tooling and CI/CD scope patterns