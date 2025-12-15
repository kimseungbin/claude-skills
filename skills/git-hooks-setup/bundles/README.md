# Git Hooks Bundles

Ready-to-use git hooks packages. Copy to your project and configure.

## Quick Start

```bash
# 1. Copy base bundle (required)
cp -r bundles/base/.githooks/ .githooks/

# 2. Choose hooks for your project type
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional-config.sh .githooks/commit-msg  # Recommended

# 3. Make executable
chmod +x .githooks/*

# 4. Configure git
git config core.hooksPath .githooks

# 5. Create config (for conventional-config.sh)
# See .claude/config/conventional-commits/main.yaml
```

## Bundle Structure

```
bundles/
├── base/                     # REQUIRED: Copy first
│   └── .githooks/
│       ├── lib/              # Shared library functions
│       │   ├── colors.sh
│       │   ├── output.sh
│       │   └── utils.sh
│       ├── scripts/          # Helper scripts
│       │   ├── check-file-sizes.sh
│       │   └── file-size-limits.yaml
│       └── README.md
│
├── hooks/                    # OPTIONAL: Pick what you need
│   ├── pre-commit/
│   │   ├── basic.sh          # Simple TS/JS projects
│   │   ├── monorepo.sh       # Workspace-aware hooks
│   │   └── README.md
│   ├── pre-push/
│   │   ├── cdk-safety.sh     # AWS CDK safety checks
│   │   └── README.md
│   └── commit-msg/
│       ├── conventional-config.sh  # Config-based validation (Recommended)
│       ├── conventional.sh         # Hardcoded English types
│       ├── skill-enforcement.sh    # Enforce Claude skill usage
│       └── README.md
│
└── README.md                 # This file
```

## Project Type Recipes

### Standard Project (Recommended)

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional-config.sh .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg
git config core.hooksPath .githooks
```

**What you get:**
- Auto-fix formatting and linting on commit
- Type checking before commit
- Config-based commit message validation (supports any language)

**Requires:** `.claude/config/conventional-commits/main.yaml` with `types_quick` and `scopes_quick`

### AWS CDK Infrastructure Project

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-push/cdk-safety.sh .githooks/pre-push
cp bundles/hooks/commit-msg/conventional-config.sh .githooks/commit-msg
chmod +x .githooks/pre-push .githooks/commit-msg
git config core.hooksPath .githooks
```

**What you get:**
- CDK synthesis validation before push
- CloudFormation change analysis
- Fixed-name resource replacement detection
- Config-based commit validation

### Monorepo Project

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-commit/monorepo.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional-config.sh .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg
git config core.hooksPath .githooks
```

**What you get:**
- Workspace-aware formatting and linting
- Build validation across all packages
- Artifact cleanup
- Config-based commit validation

### Simple Project (No Config)

For quick setup without config files, use hardcoded English types:

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/conventional.sh .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg
git config core.hooksPath .githooks
```

**What you get:**
- Standard English commit types (feat, fix, docs, etc.)
- No config file needed

### Claude Code Team Project

```bash
cp -r bundles/base/.githooks/ .githooks/
cp bundles/hooks/pre-commit/basic.sh .githooks/pre-commit
cp bundles/hooks/commit-msg/skill-enforcement.sh .githooks/commit-msg
chmod +x .githooks/pre-commit .githooks/commit-msg
git config core.hooksPath .githooks
```

**What you get:**
- Standard pre-commit checks
- Enforces use of conventional-commits skill
- Ensures consistent commit quality

## Customization

### Deployment Branches

By default, deployment branches are: `main`, `master`, `staging`, `prod`, `production`.

To customize, create `.githooks/config/deployment-branches.txt`:

```
main
develop
release
```

### File Size Limits

Edit `.githooks/scripts/file-size-limits.yaml`:

```yaml
limits:
  ts: 8192      # 8KB
  md: 15360     # 15KB

exclude:
  - node_modules
  - dist
```

### npm Scripts

Most hooks expect these npm scripts:

```json
{
  "scripts": {
    "format": "prettier --write .",
    "lint": "eslint --fix .",
    "lint:check": "eslint .",
    "type-check": "tsc --noEmit",
    "build": "tsc"
  }
}
```

Adjust hook commands if your scripts have different names.

## Verifying Installation

```bash
# Check git config
git config core.hooksPath
# Should output: .githooks

# Check hooks are executable
ls -la .githooks/

# Test pre-commit
git add .
git commit -m "test: Verify hooks"
# Should see hook output

# Reset if testing
git reset HEAD~1
```

## Troubleshooting

### Hooks not running

```bash
git config core.hooksPath .githooks
chmod +x .githooks/*
```

### "command not found" errors

Ensure npm scripts exist in package.json.

### Bypass (emergency)

```bash
git commit --no-verify
git push --no-verify
```

## Updating Bundles

When the submodule updates with new bundle versions:

```bash
# In your project
cd claude-skills  # or your submodule path
git pull origin main

# Re-copy updated files
cp -r skills/git-hooks-setup/bundles/base/.githooks/lib/ ../.githooks/lib/
cp -r skills/git-hooks-setup/bundles/base/.githooks/scripts/ ../.githooks/scripts/
```

Consider using a setup script for easier updates.
