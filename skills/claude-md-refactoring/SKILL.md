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

- **README.md**: Information for humans (developers, contributors)
  - Philosophy, motivation, "why we do this"
  - Project narratives, team guidelines
  - Setup stories, architectural decisions

- **Skills**: Step-by-step guidance that's too detailed for CLAUDE.md
  - Multi-step workflows (30+ lines)
  - Complex how-to guides
  - Reference materials with examples

### Content Classification Rules

**Move to README.md** if the content:
- Explains "why" instead of "what" or "how"
- Uses narrative/storytelling tone
- Targets human understanding/motivation
- Discusses team philosophy or culture

**Extract to Skill** if the content:
- Exceeds ~30 lines
- Contains step-by-step instructions
- Includes multiple examples/templates
- Needs supporting reference files

**Keep in CLAUDE.md** if the content:
- Provides direct AI instructions
- Lists commands/file locations
- Defines technical constraints
- References skills/commands to use

**Remove entirely** if:
- Duplicates README.md content
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
- [ ] Human-oriented content (move to README.md)
- [ ] Overly verbose (extract to skill)
- [ ] Redundant (remove/condense)
- [ ] Unclear AI instructions (rewrite)

**Current Content** (preview):
```
[Show 5-10 lines of problematic content]
```

**Recommended Action**:
[Specific recommendation: where to move, what to extract, how to condense]

**Rationale**:
[Brief explanation of why this needs refactoring]
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
4. Add content to README.md
5. Update CLAUDE.md:
   - Remove human-oriented parts
   - Keep brief AI instruction if needed
   - Add cross-reference to README.md if helpful

**Example transformation**:
```markdown
# Before (CLAUDE.md)
We use TDD because it helps us build confidence in our code and
creates a safety net for refactoring. This philosophy ensures...

# After (CLAUDE.md)
All features must follow TDD workflow. See `.claude/skills/tdd-workflow/workflow.yaml`

# Moved to README.md
## Development Philosophy
### Why Test-Driven Development?
We adopted TDD because it provides confidence and safety when refactoring...
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