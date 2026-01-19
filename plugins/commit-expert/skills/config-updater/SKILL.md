---
name: config-updater
description: Review and update commit-expert config when plugin version changes. Compares project config with latest samples and suggests updates.
allowed-tools:
  - Read
  - Edit
  - Glob
  - AskUserQuestion
---

# Commit Expert Config Updater

Updates project-specific commit-expert configuration when the plugin version changes.

## When to Use

This skill is invoked when:
1. `commit-expert` skill detects a version mismatch between plugin and config
2. User wants to review their config against latest samples
3. User wants to upgrade their config to a new plugin version

## Workflow

### Step 1: Read Version Information

```
1. Read plugin version: claude-skills/plugins/commit-expert/.claude-plugin/plugin.json
2. Read config version: .claude/config/commit-expert/main.yaml
3. Display version comparison
```

### Step 2: Identify Config Type

Determine which sample config the project uses:
- `simple-main.yaml` - Small projects
- `monorepo-main.yaml` - Multi-package projects
- `infrastructure-main.yaml` - IaC projects

Check the `implementation` field or project structure to identify type.

### Step 3: Load Sample and Project Configs

```
Sample: claude-skills/plugins/commit-expert/config/samples/{type}-main.yaml
Project: .claude/config/commit-expert/main.yaml
```

### Step 4: Compare Configs

Identify differences:
1. **New fields in sample** - Fields added in newer version
2. **Removed fields** - Fields no longer used
3. **Changed structure** - Reorganized sections
4. **Updated values** - Default values changed

### Step 5: Present Changes to User

Use AskUserQuestion to present options:

```
Config Update Review (v1.0.0 → v1.1.0)

New fields available:
- `footer.deployment_safety` - Deployment safety footers

Structural changes:
- `types_quick` renamed to `types`

Which updates do you want to apply?
[ ] Add new fields with defaults
[ ] Update structural changes
[ ] Keep current config (only update version)
```

### Step 6: Apply Selected Updates

For each selected update:
1. Show the change that will be made
2. Apply the edit
3. Confirm success

### Step 7: Update Version

After applying changes, update the version field:

```yaml
version: "X.Y.Z"  # Match plugin version
```

### Step 8: Summary

```
✓ Config updated to version X.Y.Z

Changes applied:
- Added footer.deployment_safety
- Renamed types_quick to types

Your config is now compatible with the latest plugin version.
```

## Non-Destructive Updates

**NEVER remove** user customizations:
- Custom scopes
- Custom types
- Project-specific patterns
- Custom footer conventions

Only add new fields or update structure while preserving user values.

## Manual Review Flag

If structural changes are too complex for automatic update:

```
⚠️ Manual review recommended

The following changes require manual review:
- [describe complex change]

Sample config: claude-skills/plugins/commit-expert/config/samples/{type}-main.yaml
Your config: .claude/config/commit-expert/main.yaml

Please compare and update manually, then set version to "X.Y.Z"
```