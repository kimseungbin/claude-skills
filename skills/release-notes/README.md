# Release Notes Skill

Draft production-focused release notes by analyzing pending commits and filtering for production impact.

## Overview

This skill provides intelligent release note generation that:

- **Analyzes commits**: Compares staging and prod branches to find pending changes
- **Filters for production**: Excludes DEV/QA-only changes, dev tooling, and documentation
- **Checks feature flags**: Identifies changes gated by flags not enabled for production
- **Categorizes changes**: Groups by features, fixes, improvements, and infrastructure
- **Suggests versioning**: Recommends semver version based on change impact

## When to Use This Skill

Use this skill when:

- Preparing a production release
- Asking "What's pending for prod?"
- Drafting release notes for a version
- Determining appropriate version number
- Understanding production impact of pending changes

## How It Works

### 1. Identify Pending Changes

```bash
git log --oneline --first-parent origin/prod..origin/staging
```

Shows merge commits (PRs) not yet released to production.

### 2. Analyze Production Impact

For each PR, the skill checks:

```
Feature Flag Check:
  environments: [dev, qa]           → NOT production
  environments: [..., production]   → AFFECTS production

Environment Condition Check:
  if (env === Environment.DEV)      → DEV only
  if (env === Environment.PROD)     → PROD specific
  No condition                      → Affects all environments
```

### 3. Categorize and Draft

**Production Changes:**
- Features, Improvements, Bug Fixes, Performance, Security

**Non-Production Changes:**
- Infrastructure Code (prep for future), Tooling, Documentation

### 4. Suggest Version

| Change Type | Version | Example |
|-------------|---------|---------|
| Breaking changes | MAJOR | v2.0.0 |
| New features in prod | MINOR | v1.1.0 |
| Bug fixes, code-only | PATCH | v1.0.1 |

## Usage Examples

### Draft Release Notes

```
User: "Draft release notes for the next production release"

Skill:
1. Fetches and compares branches
2. Analyzes PRs for production impact
3. Filters out DEV-only changes
4. Drafts categorized release notes
5. Suggests version number
```

### Check Pending Changes

```
User: "What changes are pending for prod?"

Skill:
1. Lists pending merge commits
2. Summarizes production vs non-production changes
3. Highlights any breaking changes
```

## Key Features

### Production Impact Filtering

The skill intelligently filters changes by:

1. **Feature flag analysis**: Checks if flags are enabled for production
2. **Environment conditionals**: Looks for `Environment.DEV` vs `Environment.PROD`
3. **File path analysis**: Identifies dev-only files (hooks, scripts, tests)
4. **PR description parsing**: Reads impact analysis from PR templates

### Smart Categorization

Changes are grouped into:

- **Production Changes**: Affect running production services
- **Infrastructure Code**: Added but not yet enabled for production
- **Internal Changes**: Tooling, documentation, developer experience

### Version Recommendation

Based on semantic versioning:

- Production features → Minor version bump
- Bug fixes only → Patch version bump
- Breaking changes → Major version bump
- No production changes → Patch or skip release

## Configuration

Create `.claude/config/release-notes.yaml`:

```yaml
# Branch names
branches:
  production: prod
  staging: staging
  development: master

# Feature flags location
feature_flags_path: feature-flags.yaml

# Environment enum values
environments:
  production: production
  staging: stag
  development: dev
  qa: qa
```

## Integration

Works with:

- **GitHub Actions workflow**: `release.yaml` for creating releases
- **conventional-commits skill**: For commit message analysis
- **git-strategy skill**: Follows same branch model
- **pull-request-management skill**: PR descriptions inform analysis

## Workflow with GitHub Actions

1. **Ask Claude Code**: "Draft release notes for next prod release"
2. **Review and adjust**: Modify the draft as needed
3. **Create release**: Go to Actions → "Create Release" → Run workflow
4. **Enter version and notes**: Paste the release notes
5. **Production deploys**: Tag triggers the production pipeline

## License

Part of the claude-skills collection.