---
name: claude-md-refactoring
description: |
    Use this skill when the user wants to refactor CLAUDE.md.
    Helps identify human-oriented content to move to README.md,
    lengthy sections to extract into skills, and keeps CLAUDE.md focused on AI instructions.
    Guides one refactoring at a time to prevent overwhelming changes.
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

### Content Classification Rules

**Move to README.md** if the content:

- Explains "why" instead of "what" or "how" (brief version)
- Is a brief project overview or quick start guide
- Targets human understanding/motivation (high-level)
- Discusses team philosophy or culture (summary)
- Is brief enough to keep README.md scannable (< 50 lines per section)

**Move to docs/** if the content:

- Is a comprehensive guide (>100 lines, multi-page documentation)
- Contains detailed step-by-step procedures for humans (not Claude)
- Would make README.md too long or cluttered
- Needs to be organized into subcategories (docs/features/, docs/guides/)
- Is planning/backlog documentation (roadmaps, task lists)
- Is detailed reference material (not a quick overview)
- Benefits from subdirectory organization

**Extract to Skill** if the content:

- Exceeds ~30 lines AND is an executable workflow for Claude
- Contains step-by-step instructions for Claude Code to follow
- Includes multiple examples/templates for Claude's use
- Needs supporting reference files for Claude's execution

**Keep in CLAUDE.md** if the content:

- Provides direct AI instructions
- Lists commands/file locations
- Defines technical constraints
- References skills/commands to use
- Is concise actionable guidance for Claude

**Remove entirely** if:

- Duplicates README.md or docs/ content
- No longer relevant/accurate
- Covered better elsewhere

## Refactoring Process

### Step 1: Analyze CLAUDE.md

Read through CLAUDE.md **sequentially from top to bottom**. Identify the **FIRST** issue you encounter:

1. **Human-oriented content**: Philosophy, motivation, narratives
2. **Verbose sections**: Topics >30 lines that could be skills
3. **Redundant content**: Information already in README.md
4. **Unclear AI instructions**: Vague or confusing guidance

**IMPORTANT**: Only identify ONE issue at a time. Stop after finding the first problem.

### Step 2: Propose Refactoring

Present your finding to the user:

```markdown
## 🔍 Refactoring Opportunity Found

**Section**: [Section name or line range]

**Issue Type**:

- [ ] Human-oriented content (move to README.md or docs/)
- [ ] Overly verbose (extract to skill or move to docs/)
- [ ] Redundant (remove/condense)
- [ ] Unclear AI instructions (rewrite)

**Current Content** (preview):
```

[Show 5-10 lines of problematic content]

```

**Recommended Action**:
[Specific recommendation: where to move (README.md vs docs/), what to extract, how to condense]

**Rationale**:
[Brief explanation of why this needs refactoring and which destination is appropriate]
```

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

**Example transformation**:

```markdown
# Before (CLAUDE.md)

We use TDD because it helps us build confidence in our code and
creates a safety net for refactoring. This philosophy ensures...

# After (CLAUDE.md)

All features must follow TDD workflow. See docs/TDD_GUIDE.md for details.

# Moved to README.md

## Development Philosophy

### Why Test-Driven Development?

We adopted TDD because it provides confidence and safety when refactoring...

For detailed TDD workflow, see [docs/TDD_GUIDE.md](docs/TDD_GUIDE.md).
```

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

**Example transformation**:

```markdown
# Before (CLAUDE.md - 300 lines)

## Adding a New Environment

Follow these detailed steps to add a new environment...
[300 lines of detailed instructions]

# After (CLAUDE.md - 5 lines)

## Adding a New Environment

See [docs/ADDING_NEW_ENVIRONMENT.md](docs/ADDING_NEW_ENVIRONMENT.md) for complete guide.

Quick summary: Update types, config, deployment stack, bootstrap AWS account.

# Created: docs/ADDING_NEW_ENVIRONMENT.md

# Adding a New Environment

Complete step-by-step guide for adding new environments to fe-infra...
[Full 300 lines with examples, troubleshooting, best practices]

# Updated: README.md

## Documentation

- [Adding New Environment](docs/ADDING_NEW_ENVIRONMENT.md) - Complete guide for QA, UAT, etc.
```

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

**Tone transformation**:

```markdown
# Before (narrative)

When you're working with tests, you'll want to make sure you run them
before committing. This helps catch issues early.

# After (imperative)

Run tests before committing. Use `npm test` or package-specific commands.
```

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

Provide summary:

```markdown
## ✅ Refactoring Complete

**Changes Made**:

- [Describe what was changed]

**Files Modified**:

- `CLAUDE.md`: [what changed - moved/removed/condensed]
- `README.md`: [what was added, if applicable]
- `docs/[name].md`: [if comprehensive guide created]
- `.claude/skills/[name]/`: [if skill created]

**Before/After Comparison**:
[Show key before/after snippets if helpful]

**Next Steps**:

- Run `/refactor-claude-md` again to find next opportunity
- Review changes and commit when satisfied
- Continue until CLAUDE.md is fully optimized
```

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

See companion files:

- `examples.md`: Before/after refactoring examples
- `decision-tree.md`: Flowchart for content classification

## Important Reminders

- **One topic at a time**: Never refactor multiple sections simultaneously
- **Get approval first**: Always wait for user confirmation
- **Preserve critical info**: Don't remove technical constraints or commands
- **Maintain consistency**: Follow existing patterns in README and skills
- **Test references**: Verify skill names and file paths are correct
