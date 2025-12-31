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

- **docs/**: Detailed documentation for humans (comprehensive guides)
    - Multi-page how-to guides (e.g., ADDING_NEW_ENVIRONMENT.md)
    - Comprehensive architectural documentation
    - Planning documents (backlogs, roadmaps, feature specs)
    - Reference materials organized by topic
    - Use subdirectories for categorization (docs/features/, docs/refactoring/)

- **Skills**: Step-by-step guidance for AI execution
    - Multi-step workflows (30+ lines) that Claude executes
    - Complex how-to guides for Claude Code to follow
    - Reference materials with examples for tool usage

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

Once approved, execute based on the refactoring type:

#### For Moving to README.md

1. Read README.md to understand current structure
2. Identify appropriate section (or create new section)
3. Adapt tone to be human-friendly (add context, explain "why")
4. Keep it brief and scannable (< 50 lines per section)
5. Add content to README.md
6. Update CLAUDE.md:
    - Remove human-oriented parts
    - Keep brief AI instruction if needed
    - Add cross-reference to README.md if helpful

See `examples.md` Example 1 for before/after transformation.

#### For Moving to docs/

1. Check if docs/ directory exists (create if needed)
2. Determine appropriate location:
    - Standalone guide: `docs/GUIDE_NAME.md`
    - Categorized: `docs/category/guide-name.md`
    - Planning: `docs/features/`, `docs/refactoring/`
3. Adapt content for detailed documentation:
    - Keep comprehensive step-by-step instructions
    - Include examples, templates, troubleshooting
    - Add table of contents for long documents
4. Create or update the docs file
5. Update README.md to link to the new guide
6. Update CLAUDE.md:
    - Replace verbose section with brief instruction
    - Reference the docs/ file for details

See `examples.md` Example 2 for before/after transformation.

#### For Extracting to Skill

1. Determine skill name (kebab-case, descriptive)
2. Create `.claude/skills/[skill-name]/` directory
3. Create `SKILL.md` with proper frontmatter:
    ```yaml
    ---
    name: skill-name
    description: |
        Clear description of what this skill does and when Claude should use it.
        Include trigger keywords.
    ---
    ```
4. Move content to skill, organizing into sections
5. Update CLAUDE.md to reference the skill with brief context
6. Create supporting files if needed (examples, templates)

**Skill naming conventions**:

- Use kebab-case: `cdk-setup`, `tdd-workflow`, `playwright-testing`
- Be specific and descriptive
- Reflect the domain/task clearly

#### For Condensing/Rewriting

1. Extract key actionable instructions
2. Remove narrative explanations
3. Use imperative tone ("Do X", "Use Y when Z")
4. Keep file paths, commands, constraints
5. Link to README.md or skills for details

See `examples.md` Example 3 for tone transformation examples.

#### For Removing Content

1. Verify content exists in README.md
2. Check no unique information will be lost
3. Remove from CLAUDE.md
4. Optionally add brief cross-reference

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
