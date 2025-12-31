---
name: claude-md-refactoring
description: |
    Use this skill when user wants to refactor CLAUDE.md to separate AI instructions from human documentation.
allowed-tools: Read, Edit, Write, Glob
---

# CLAUDE.md Refactoring Skill

You are helping refactor CLAUDE.md to make it focused and useful for Claude Code (AI), not humans.

## Core Principles

### Audience Separation

- **CLAUDE.md**: Instructions for AI assistants (Claude Code)
    - Commands, file paths, technical constraints
    - Workflow steps, tool usage patterns
    - What to do, where to find things

- **README.md**: Brief information for humans (quick start)
    - High-level project overview (1-2 paragraphs)
    - Quick start guide
    - Key features summary
    - Links to detailed documentation in docs/

- **Inline comments**: First choice for code documentation
    - Explain complex logic, edge cases, non-obvious decisions
    - Keep close to the code it describes

- **docs/**: For content that can't be inline
    - Covers broader scope than a single file
    - Requires diagrams (Mermaid, architecture drawings)
    - Not directly related to code (processes, decisions)
    - Use subdirectories for categorization (docs/features/, docs/guides/)

- **Skills**: Step-by-step guidance for AI execution
    - Multi-step workflows (30+ lines) that Claude executes
    - Complex how-to guides for Claude Code to follow
    - Reference materials with examples for tool usage

### CLAUDE.md as Index

CLAUDE.md should act as a concise pointer to detailed content elsewhere:
- Skills for executable workflows
- docs/ for comprehensive guides
- README.md for human context

Keep instructions brief with references, not inline content. A well-structured CLAUDE.md is a navigation hub, not a documentation dump.

### Content Classification (Quick Reference)

| Content Type | Destination |
|--------------|-------------|
| Philosophy, "why" explanations | README.md |
| Comprehensive guides (>100 lines) | docs/ |
| Executable workflows (>30 lines) | Skill |
| Commands, paths, constraints | CLAUDE.md |
| Duplicates existing content | Remove |

See `decision-tree.md` for detailed classification flowchart and edge cases.

## Refactoring Process

### Step 1: Analyze CLAUDE.md

Read through CLAUDE.md **sequentially from top to bottom**. Identify the **FIRST** issue you encounter:

1. **Human-oriented content**: Philosophy, motivation, narratives
2. **Verbose sections**: Topics >30 lines that could be skills
3. **Redundant content**: Information already in README.md
4. **Unclear AI instructions**: Vague or confusing guidance

**IMPORTANT**: Only identify ONE issue at a time. Stop after finding the first problem.

### Step 2: Propose Refactoring

Present finding using format in `templates.md` (Refactoring Opportunity Template).
Include: section name, issue type, content preview, recommended action, rationale.

### Step 3: Get User Approval

**DO NOT make any changes without explicit user approval.**

Ask: "Should I proceed with this refactoring? (yes/no/modify)"

Wait for user response before continuing.

### Step 4: Execute Refactoring

Execute based on destination. Always update CLAUDE.md after moving content.

| Destination | Key Actions | Example |
|-------------|-------------|---------|
| README.md | Adapt to human-friendly tone, <50 lines/section | Example 1 |
| docs/ | Create `docs/GUIDE.md`, link from README | Example 2 |
| Skill | Create `.claude/skills/[name]/SKILL.md` with frontmatter (kebab-case) | Example 2 |
| Condense | Imperative tone, remove narrative | Example 3 |
| Remove | Verify no unique info lost | - |

See `examples.md` for detailed before/after transformations.

### Step 5: Verify Changes

After refactoring:

1. Check CLAUDE.md reads clearly for AI consumption
2. Verify README.md maintains human-friendly tone
3. If created skill, test that description is clear
4. Ensure no broken references

### Step 6: Report Completion

Provide summary using format in `templates.md` (Completion Report Template).
Include: changes made, files modified, before/after comparison, next steps.

## Quality Checklist

Before completing any refactoring, verify:

- [ ] CLAUDE.md uses imperative, instruction-focused language
- [ ] No philosophical "why" explanations remain in CLAUDE.md
- [ ] Human-oriented content is in README.md with appropriate context
- [ ] Skills have clear names and descriptions
- [ ] File paths and commands remain accurate
- [ ] Cross-references are correct
- [ ] No information was lost in the process

## Reference Materials

- `templates.md`: Output formats for proposals and completion reports
- `examples.md`: Before/after transformations for each refactoring type
- `decision-tree.md`: Classification flowchart and edge cases

## Important Reminders

- **One topic at a time**: Never refactor multiple sections simultaneously
- **Get approval first**: Always wait for user confirmation
- **Preserve critical info**: Don't remove technical constraints or commands
- **Maintain consistency**: Follow existing patterns in README and skills
- **Test references**: Verify skill names and file paths are correct
