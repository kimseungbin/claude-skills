# Commit Types Index

Quick reference for selecting commit type. Read the specific yaml file only when you need edge case clarification.

## Decision Tree

```
What are you doing?
├─ Adding NEW capability? ────────────────────→ feat
├─ Fixing BROKEN behavior? ───────────────────→ fix
├─ Changing CODE STRUCTURE (not behavior)? ───→ refactor
├─ Updating documentation ONLY? ──────────────→ docs
├─ Maintenance, deps, tooling? ───────────────→ chore
```

## Available Types

| Type | Use When | Read Detail When |
|------|----------|------------------|
| `feat` | Adding new capability | Unsure if feat vs chore (infrastructure) |
| `fix` | Correcting broken behavior | Unsure if fix vs refactor |
| `refactor` | Restructuring without behavior change | Unsure if refactor vs fix/feat |
| `docs` | Documentation-only changes | Need examples for doc commits |
| `chore` | Dependencies, tooling, config | Unsure about scope (deps/tools/config) |

## When to Read Detailed Files

Only read the specific type yaml when:
- **feat.yaml**: Infrastructure project, unsure if FOR apps or FOR deployment
- **fix.yaml**: Could be fix or refactor, need decision criteria
- **refactor.yaml**: Could be refactor or fix/feat, need examples
- **docs.yaml**: Multiple doc files changed, need scope guidance
- **chore.yaml**: Need to decide between deps/tools/config scopes

## Files

- `feat.yaml` - New features, infrastructure edge cases
- `fix.yaml` - Bug fixes vs refactor distinction
- `refactor.yaml` - Code restructuring guidance
- `docs.yaml` - Documentation commit patterns
- `chore.yaml` - Maintenance, deps, tooling