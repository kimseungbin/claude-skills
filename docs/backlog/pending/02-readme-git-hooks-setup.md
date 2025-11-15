# Add README.md for git-hooks-setup

**Priority:** High
**Type:** Documentation
**Skill:** git-hooks-setup
**Estimated Time:** 1.5 hours

## Problem

The `git-hooks-setup` skill is missing user-facing documentation (README.md).

## Current State

```
skills/git-hooks-setup/
├── SKILL.md           ✅
├── decision-tree.md   ✅
├── examples/          ✅
│   ├── pre-commit-typescript.sh
│   ├── pre-commit-python.sh
│   └── commit-msg.sh
├── guides/            ✅
│   ├── pre-commit.md
│   ├── commit-msg.md
│   ├── pre-push.md
│   └── common-hooks.md
└── hooks/             ✅
```

Missing: README.md

## Task

Create `skills/git-hooks-setup/README.md`

## Content Requirements

### Overview Section
- What the skill does: Automated git hooks generation
- Project type detection capabilities
- Custom hooks tailored to project needs

### When to Use Section
- Setting up new project
- Adding quality gates
- Enforcing commit message standards
- Pre-push validation

### Key Features
- **Automatic Project Detection**: TypeScript, Python, etc.
- **Hook Templates**: Pre-commit, commit-msg, pre-push
- **Customization**: Project-specific validation rules
- **Examples Included**: Reference implementations

### Project Configuration
- Explain `.claude/config/git-hooks.yaml` pattern
- Show example configuration structure
- Link to config template (once created in task #08)

### Installation Instructions
- Git submodule setup
- Symlink creation
- Hook directory setup (`git config core.hooksPath .githooks`)

### Usage Examples

#### Example 1: TypeScript Project
```
User: "Set up git hooks for my TypeScript project"
Skill: [Detects tsconfig.json, creates pre-commit with tsc --noEmit]
```

#### Example 2: Custom Validation
```
User: "Add pre-commit hook to check for TODOs"
Skill: [Creates custom hook with grep pattern]
```

### Directory Structure
- Link to examples/ directory
- Link to guides/ directory
- Explain hooks/ template structure

## Template Reference

Use the README.md template from `docs/backlog/readme.md` (original version) as a starting point.

## Acceptance Criteria

- [ ] File created at `skills/git-hooks-setup/README.md`
- [ ] Contains all required sections
- [ ] Follows template structure
- [ ] Links to examples/, guides/, and decision-tree.md
- [ ] Configuration section included
- [ ] Installation instructions with core.hooksPath setup
- [ ] Multiple usage examples
