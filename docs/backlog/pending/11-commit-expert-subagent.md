# Create commit-expert Subagent

**Priority:** Medium
**Type:** New Feature
**Skill:** conventional-commits (replacement)

## Problem

The `conventional-commits` skill shares context with the main conversation, which can lead to context pollution in long sessions. Additionally, the skill lacks commit history analysis and smart ordering features.

## Current State

```
skills/conventional-commits/
├── SKILL.md                    ✅ (323 lines)
├── infrastructure.md           ✅ (696 lines)
├── templates/                  ✅ (11 files)
├── hooks/                      ✅ (2 files)
└── ...                         (30 files total)
```

Missing: Subagent with isolated context and enhanced capabilities

## Task

Create a Claude Code subagent at `.claude/agents/commit-expert.md` that:
1. Provides context isolation (separate from main conversation)
2. Preserves all 9-step workflow from SKILL.md
3. Adds commit history analysis (learn from project patterns)
4. Adds smart commit ordering (deps → features → tests)

## Content Requirements

### Subagent Configuration
- name: commit-expert
- tools: Bash, Read, Glob, Grep, Edit
- model: sonnet
- permissionMode: acceptEdits

### System Prompt Sections (~520 lines)
1. Identity & Expertise (50 lines)
2. Configuration Loading (40 lines)
3. Core 9-Step Workflow (100 lines)
4. History Analysis Enhancement (60 lines)
5. Smart Commit Ordering Enhancement (50 lines)
6. Embedded Decision Trees (150 lines)
7. Quality Standards (50 lines)
8. Examples (20 lines)

### Invocation
Users invoke directly via `Task(subagent_type="commit-expert")`

### Documentation Update
Update `CLAUDE.md` to document the new subagent

## Migration Strategy

Gradual migration:
1. Create subagent (parallel operation with skill)
2. Test on various commit scenarios
3. Update documentation
4. Deprecate skill after testing period

## Acceptance Criteria

- [ ] Backlog item created at `docs/backlog/pending/11-commit-expert-subagent.md`
- [ ] Subagent created at `.claude/agents/commit-expert.md`
- [ ] System prompt includes all 9 workflow steps
- [ ] History analysis feature implemented
- [ ] Smart commit ordering feature implemented
- [x] Subagent invokable via `Task(subagent_type="commit-expert")`
- [ ] CLAUDE.md documents the new subagent
- [ ] Skill kept for fallback (gradual migration)
- [ ] Tested on single-scope and multi-scope commits

## Related Files

- `skills/conventional-commits/SKILL.md` - Source for workflow
- `skills/conventional-commits/templates/main.yaml` - Decision trees
- `skills/conventional-commits/templates/guides/specificity.yaml` - Quality standards
- `.claude/agents/commit-expert.md` - The implemented subagent