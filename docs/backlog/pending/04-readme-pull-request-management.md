# Add README.md for pull-request-management

**Priority:** High
**Type:** Documentation
**Skill:** pull-request-management
**Estimated Time:** 1.5 hours

## Problem

The `pull-request-management` skill is missing user-facing documentation (README.md).

## Current State

```
skills/pull-request-management/
├── skill.md               ✅ (will be renamed to SKILL.md)
├── config.template.yaml   ✅
├── examples.md            ✅
└── examples/              ✅
    ├── infrastructure-pr.md
    └── multi-commit-pr.md
```

Missing: README.md

## Task

Create `skills/pull-request-management/README.md`

## Content Requirements

### Overview Section
- What the skill does: PR creation and management
- Template compliance features
- Confidence-based decision making
- Multi-commit analysis

### When to Use Section
- Creating pull requests
- Filling out PR templates
- Analyzing deployment impacts
- Managing environment promotions (DEV → STAGING → PROD)

### Key Features

1. **Template Compliance**
   - Reads project-specific PR templates
   - Validates all required sections
   - Suggests template updates when uncertain

2. **Confidence-Based Decision Making**
   - High confidence: Fill template directly
   - Low confidence: Suggest template improvements
   - Checkbox alternatives for deployment safety

3. **Multi-Commit Analysis**
   - Groups related commits
   - Categorizes changes (feat, fix, docs, etc.)
   - Impact assessment (high/medium/low)

4. **Deployment Impact Analysis**
   - Resource replacement detection
   - Cost impact estimation
   - Service disruption warnings

### Project Configuration
- Explain `.claude/config/pull-request-management.yaml`
- Reference to config.template.yaml
- Example configuration structure
- PR rules and patterns

### Installation Instructions
- Git submodule setup
- Symlink creation
- Configuration file setup (copy from config.template.yaml)

### Usage Examples

#### Example 1: Simple PR
```
User: "Create a PR for my feature branch"
Skill: [Analyzes commits, fills template, creates PR]
```

#### Example 2: Infrastructure PR
```
User: "Create PR for service configuration changes"
Skill: [Detects infrastructure changes, adds deployment checklist]
```

#### Example 3: Multi-Commit PR
```
User: "Create PR with all my commits"
Skill: [Groups commits by type, creates comprehensive summary]
```

### Directory Structure
- Link to examples.md
- Link to examples/ directory
- Reference config.template.yaml

## Template Reference

Use the README.md template from `docs/backlog/readme.md` (original version) as a starting point.

## Related Tasks

- Task #10: Rename skill.md to SKILL.md (should be done first)

## Acceptance Criteria

- [ ] File created at `skills/pull-request-management/README.md`
- [ ] Contains all required sections
- [ ] Follows template structure
- [ ] Explains confidence-based decision making
- [ ] Links to config.template.yaml and examples/
- [ ] Multiple usage examples (simple, infrastructure, multi-commit)
- [ ] Installation instructions included
