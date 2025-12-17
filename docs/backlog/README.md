# Skills Repository Backlog

This backlog tracks improvements and missing components for the skills repository based on skill-creator compliance review.

## Quick Status

**Review Date:** November 15, 2024
**Total Tasks:** 11
**Pending:** 10
**Completed:** 1

## Organization

This backlog is organized into two directories:

- **`pending/`** - Tasks not yet implemented (10 items)
- **`completed/`** - Completed tasks (1 item)

## Pending Tasks

### High Priority (4 tasks)

Documentation files needed for user-facing skill information:

1. **[Add README.md for claude-md-refactoring](pending/01-readme-claude-md-refactoring.md)**
   - Priority: High | Time: 1 hour
   - Missing user-facing documentation

2. **[Add README.md for git-hooks-setup](pending/02-readme-git-hooks-setup.md)**
   - Priority: High | Time: 1.5 hours
   - Missing user-facing documentation

3. **[Add README.md for nestjs-patterns](pending/03-readme-nestjs-patterns.md)**
   - Priority: High | Time: 1 hour
   - Missing user-facing documentation

4. **[Add README.md for pull-request-management](pending/04-readme-pull-request-management.md)**
   - Priority: High | Time: 1.5 hours
   - Missing user-facing documentation

### Medium Priority (3 tasks)

Configuration documentation for project-specific customization:

5. **[Add Configuration Section to claude-md-refactoring](pending/05-config-section-claude-md-refactoring.md)**
   - Priority: Medium | Time: 30 minutes
   - Missing project config documentation

6. **[Add Configuration Section to nestjs-patterns](pending/06-config-section-nestjs-patterns.md)**
   - Priority: Medium | Time: 45 minutes
   - Missing project config documentation

New feature - Claude Code subagent:

11. **[Create commit-expert Subagent](pending/11-commit-expert-subagent.md)**
    - Priority: Medium
    - Replace conventional-commits skill with isolated subagent

### Low Priority (3 tasks)

Template files for easier project setup:

7. **[Create config-template.yaml for cdk-expert](pending/07-config-template-cdk-expert.md)**
   - Priority: Low | Time: 15 minutes
   - Extract inline example to template file

8. **[Create config-template.yaml for git-hooks-setup](pending/08-config-template-git-hooks-setup.md)**
   - Priority: Low | Time: 20 minutes
   - Create comprehensive config template

9. **[Create config-template.md for git-strategy](pending/09-config-template-git-strategy.md)**
   - Priority: Low | Time: 30 minutes
   - Create git strategy documentation template

## Task Summary by Skill

| Skill | Tasks | Status |
|-------|-------|--------|
| claude-md-refactoring | 2 tasks | #01 README, #05 Config section |
| git-hooks-setup | 2 tasks | #02 README, #08 Config template |
| nestjs-patterns | 2 tasks | #03 README, #06 Config section |
| pull-request-management | 1 task | #04 README |
| cdk-expert | 1 task | #07 Config template |
| git-strategy | 1 task | #09 Config template |
| conventional-commits | 1 task | #11 Subagent replacement |

## Estimated Total Time

- **High Priority:** 5 hours
- **Medium Priority:** 1.25 hours
- **Low Priority:** 1 hour

**Total:** ~7.25 hours of work

## Quick Wins

Start with these for immediate impact:

1. ✅ ~~**Task #10** - Rename skill.md (5 minutes)~~ **COMPLETED**
2. **Task #07** - Create cdk-expert config template (15 minutes)
3. **Task #08** - Create git-hooks-setup config template (20 minutes)
4. **Task #09** - Create git-strategy config template (30 minutes)

**Remaining quick wins:** ~1 hour, completes all low-priority tasks

## Compliance Status

Skills reviewed against skill-creator rules:

| Status | Count | Skills |
|--------|-------|--------|
| ✅ Fully Compliant | 5 | conventional-commits, maintaining-documentation, cdk-expert, skill-creator, pull-request-management |
| ⚠️ Partially Compliant | 3 | claude-md-refactoring, git-hooks-setup, nestjs-patterns |
| ✅ Mostly Compliant | 1 | git-strategy |

## Exemplary Skills

Reference these as models when implementing tasks:

- **conventional-commits** - Hybrid pattern, multiple templates, comprehensive docs
- **maintaining-documentation** - Clear separation, config template, implementation guides

## Progress Tracking

To mark a task as complete:

1. Complete the task following the specifications in `pending/<task-file>.md`
2. Move the task file from `pending/` to `completed/`
3. Update this readme with completion status

## Completed Tasks

1. ✅ **[Task #10 - Rename skill.md to SKILL.md](completed/10-rename-skill-md-pull-request-management.md)** - Completed November 15, 2024

## Next Actions

Recommended order:

1. Complete remaining quick wins (Task #07, #08, #09) - ~1 hour
2. Tackle high-priority README files (#01-#04) - ~5 hours
3. Add config sections (#05, #06) - ~1.25 hours

---

**Last Updated:** November 15, 2024
