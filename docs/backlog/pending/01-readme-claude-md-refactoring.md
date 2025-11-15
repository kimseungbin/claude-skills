# Add README.md for claude-md-refactoring

**Priority:** High
**Type:** Documentation
**Skill:** claude-md-refactoring
**Estimated Time:** 1 hour

## Problem

The `claude-md-refactoring` skill is missing user-facing documentation (README.md).

## Current State

```
skills/claude-md-refactoring/
├── SKILL.md               ✅
├── decision-tree.md       ✅
└── examples.md            ✅
```

Missing: README.md

## Task

Create `skills/claude-md-refactoring/README.md`

## Content Requirements

### Overview Section
- What the skill does: CLAUDE.md maintenance and refactoring
- Purpose: Keep CLAUDE.md focused on AI instructions by moving content to appropriate locations
- Regular maintenance: Use whenever CLAUDE.md grows too large or needs reorganization

### When to Use Section
- CLAUDE.md is getting too long (>300-500 lines)
- Human-oriented content is mixed with AI instructions
- Documentation needs better organization
- Initial project setup with CLAUDE.md
- Regular maintenance to keep CLAUDE.md lean and focused

### Key Features
- Sequential refactoring (one issue at a time)
- Content classification rules
- Decision tree for determining where content belongs
- Support for docs/ directory organization

### Installation Instructions
- Git submodule setup
- Symlink creation
- Optional: Configuration for custom refactoring preferences

### Usage Example
```
User: "Refactor my CLAUDE.md"
Skill: [Analyzes CLAUDE.md, finds first issue, proposes refactoring]
```

### Reference to Supporting Files
- Link to decision-tree.md
- Link to examples.md

## Template Reference

Use the README.md template from `docs/backlog/readme.md` (original version) as a starting point.

## Acceptance Criteria

- [ ] File created at `skills/claude-md-refactoring/README.md`
- [ ] Contains all required sections
- [ ] Follows template structure
- [ ] Explains recurring maintenance use of skill
- [ ] Clarifies when to use (CLAUDE.md getting too large, needs reorganization)
- [ ] Links to decision-tree.md and examples.md
- [ ] Installation instructions included
