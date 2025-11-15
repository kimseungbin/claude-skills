# Add Configuration Section to claude-md-refactoring

**Priority:** Medium
**Type:** Documentation
**Skill:** claude-md-refactoring
**Estimated Time:** 30 minutes

## Problem

The `claude-md-refactoring` skill is missing a "Project-Specific Configuration" section in SKILL.md.

## Current State

SKILL.md has:
- ✅ Frontmatter
- ✅ Core Principles
- ✅ Refactoring Process
- ✅ Example Workflows
- ❌ Configuration Section

## Task

Add "Project-Specific Configuration" section to `skills/claude-md-refactoring/SKILL.md`

## Placement

Insert after "Example Workflows" section, before end of file (around line 300+).

## Content to Add

### Option 1: Minimal Configuration (Recommended)

```markdown
## Project-Specific Configuration

⚠️ **Note:** This skill works well with default settings for most projects.

This is a **recurring maintenance skill** used to keep CLAUDE.md focused and lean by moving content to appropriate locations (README.md, docs/, or separate skills).

**Why minimal configuration?**
- Generic refactoring rules work for most projects
- Decision tree is universal (human vs AI content)
- Default thresholds (30 lines for skills, 50 lines for README sections) work well

**If you need custom refactoring rules:**

Create `.claude/config/claude-md-refactoring.yaml` with:

\`\`\`yaml
# Optional: Custom refactoring preferences
prefer_docs_over_readme: true  # Move long content to docs/ instead of README.md
min_skill_lines: 50            # Minimum lines before extracting to skill (default: 30)
preserve_sections:
  - "Team Philosophy"          # Sections to keep in CLAUDE.md
  - "Project Values"
\`\`\`

**Optional configuration** may be useful for:
- Custom line count thresholds
- Preserving specific sections in CLAUDE.md
- Project-specific content classification rules
```

### Option 2: Full Configuration Support

```markdown
## Project-Specific Configuration

⚠️ **CRITICAL: Configuration File Management** ⚠️

This skill is a **git submodule** shared across multiple projects.

**Configuration file (optional):** `.claude/config/claude-md-refactoring.yaml`

**When to create:**
- Regular refactoring sessions show patterns that need custom rules
- You want to customize the line count threshold for skill extraction
- You want to preserve certain sections in CLAUDE.md
- Team has specific preferences for docs organization

**Example configuration:**

\`\`\`yaml
# Claude MD Refactoring Configuration
project: my-project

# Refactoring preferences
preferences:
  prefer_docs: true              # Prefer docs/ over README.md for long content
  min_skill_lines: 50            # Lines threshold for skill extraction (default: 30)
  max_readme_section_lines: 50   # Max lines per README section (default: 50)

# Sections to always preserve in CLAUDE.md
preserve_in_claude_md:
  - "Team Philosophy"
  - "Project Values"
  - "Custom AI Instructions"

# Sections to always move to README.md
move_to_readme:
  - "Quick Start"
  - "Installation"

# Sections to always move to docs/
move_to_docs:
  - "Detailed Architecture"
  - "API Documentation"
\`\`\`

**Note:** Most projects work well with default settings. Consider configuration if you use the skill frequently and notice patterns.
```

## Recommendation

Use **Option 1** (Minimal Configuration) since:
- Default thresholds work well for most projects
- Generic rules apply broadly
- You can always add configuration later if needed

## Template Reference

Use the configuration section template from `docs/backlog/readme.md` (original version) as a guide.

## Acceptance Criteria

- [ ] Configuration section added to SKILL.md
- [ ] Placed after Example Workflows section
- [ ] Explains that configuration is optional for this skill
- [ ] Shows example config structure (even if optional)
- [ ] Notes that configuration is useful for frequent/recurring use
