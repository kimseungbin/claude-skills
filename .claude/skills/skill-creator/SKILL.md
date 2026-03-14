---
name: Skill Creator
description: Create new Claude Code skills following best practices and standardized structure. Use when user wants to create a new skill or convert documentation into a skill.
---

# Skill Creator

This skill guides the creation of new Claude Code skills, ensuring consistent structure and complete documentation.

## Instructions

When the user requests to create a new skill:

1. **Understand the skill requirements**:
    - What is the skill's purpose?
    - What triggers should invoke this skill?
    - What specific tasks will it perform?
    - Does it need project-specific configuration?
    - Will it use external tools/APIs?

2. **Plan the skill structure**:
    - Skill name (kebab-case, e.g., `git-strategy`, `skill-creator`)
    - Description (one-line summary for skill invocation)
    - Required configuration files
    - Decision trees or examples needed
    - Integration with other skills

3. **Create the skill**:

### Step 1: Create Directory Structure

```bash
# Create skill directory
mkdir -p skills/<skill-name>
```

### Step 2: Create SKILL.md

**File:** `skills/<skill-name>/SKILL.md`

**Template:**

```markdown
---
name: [Skill Name]
description: [One-line description. Use when user requests X or Y.]
---

# [Skill Name]

[Brief overview of what this skill does]

## Instructions

When the user requests [trigger conditions]:

1. **[First step]**:
    - Sub-step details
    - What to check or validate
    - Project-specific considerations

2. **[Second step]**:
    - Implementation details
    - Commands to run
    - Error handling

3. **[Additional steps as needed]**

## Example Workflows

### [Scenario 1]

```
User: "[Example user request]"

1. [Step-by-step what the skill does]
2. [Include commands run]
3. [Expected outcomes]
```

### [Scenario 2]

[Another example workflow]

## Project Configuration Location

**Priority order:**

1. **Project-specific configuration** (PRIMARY): `.claude/config/<skill-name>.md` or `.yaml`
2. **Default configuration** (FALLBACK): Provided by skill or generic behavior

**Configuration Pattern:**

- Skill files installed via `claude install` (READ-ONLY, shared)
- `.claude/config/<skill-name>.*` → Real file in project (WRITABLE, project-specific)

**When user requests project-specific configuration:**

1. Check if `.claude/config/<skill-name>.*` exists
2. If NOT exists, create it with project-specific settings
3. If EXISTS, update it
4. NEVER modify installed skill files directly

## Integration with Other Skills

[List skills this works well with and how they interact]

## Notes

[Important considerations, edge cases, limitations]
```

### Step 3: Create README.md

**File:** `skills/<skill-name>/README.md`

**Template:**

```markdown
# [Skill Name] Skill

[Brief description]

## Overview

This skill provides [key capabilities]:

- **[Capability 1]**: Description
- **[Capability 2]**: Description
- **[Capability 3]**: Description

## When to Use This Skill

Use this skill when:

- [Use case 1]
- [Use case 2]
- [Use case 3]

## Project Configuration

[Explain configuration structure and requirements]

### Configuration Example

```[format]
[Example configuration content]
```

## Usage Examples

### [Example 1 Title]

```
User: "[User request]"
Skill: [What happens]
```

### [Example 2 Title]

```
User: "[User request]"
Skill: [What happens]
```

## Key Features

### [Feature 1]
- Bullet points explaining feature

### [Feature 2]
- Bullet points explaining feature

## Installation

### Via Claude Code Marketplace

```bash
claude install kimseungbin/claude-skills
```

## Contributing

[Guidelines for improving this skill]

## License

Part of the claude-skills collection.
```

### Step 4: Create Optional Files

**Decision Tree (if applicable):** `skills/<skill-name>/decision-tree.md`

```markdown
# [Skill Name] Decision Tree

## When to Use This Skill

```
[ASCII decision tree diagram]
```

## Decision Points

### [Decision Point 1]
[Explanation]

### [Decision Point 2]
[Explanation]
```

**Examples (if needed):** `skills/<skill-name>/examples.md`

```markdown
# [Skill Name] Examples

## Example 1: [Scenario]

[Detailed walkthrough]

## Example 2: [Scenario]

[Detailed walkthrough]
```

**Configuration Template:** `skills/<skill-name>/config.template.[md|yaml]`

[Template file for project-specific configuration]

### Step 5: Create Implementation Guides (Hybrid Pattern - Optional)

**When to use the Hybrid Pattern:**

Use implementation guides when your skill needs different workflows or patterns for different project types (e.g., CDK vs React vs Python projects).

**Structure:**

```
skills/<skill-name>/
├── SKILL.md                      # Generic workflow (applies to all project types)
├── README.md                     # Human-oriented documentation
├── config-template.yaml          # Template for project-specific configs
├── cdk-infrastructure.md         # CDK-specific implementation guide
├── react-frontend.md             # React-specific implementation guide
└── python-backend.md             # Python-specific implementation guide
```

**Implementation Guide Template:**

**File:** `skills/<skill-name>/<project-type>.md`

```markdown
---
implementation: <project-type>
project_types:
  - [Primary project type]
  - [Related project types]
---

# [Project Type] [Skill Purpose] Guide

This guide provides [project-type]-specific patterns for [skill purpose].

## [Project Type] Categories

[Define categories specific to this project type]

### 1. [Category 1]
**Definition:** [What this category covers]

**Examples:**
- [Example 1]
- [Example 2]

**Sections to Update:**
- [Section 1]
- [Section 2]

### 2. [Category 2]
**Definition:** [What this category covers]

[Continue for all categories...]

## Decision Tree

Use this decision tree to determine [key decisions]:

\```
[ASCII decision tree diagram]
\```

## Key Principles

### Principle 1
[Explanation with examples]

### Principle 2
[Explanation with examples]

## Example Scenarios

### Scenario 1: [Title]

**Code Changes:**
- [Change 1]
- [Change 2]

**[Action] Steps:**
1. [Step 1]
2. [Step 2]

**Result:**
\```
[Expected outcome]
\```

## Common Mistakes

### ❌ [Mistake 1]
[Description of mistake]

**Solution:** [How to fix]

### ❌ [Mistake 2]
[Description of mistake]

**Solution:** [How to fix]
```

**Configuration Template (config-template.yaml):**

```yaml
# Configuration for <skill-name> skill
# Copy this file to .claude/config/<skill-name>.yaml in your project

# Tracks which plugin version this config was created/updated for
plugin_version: "1.0.0"

# Implementation guide to use (required)
# Available: cdk-infrastructure, react-frontend, python-backend
implementation: <project-type>

# Project-specific category names (optional override)
categories:
  category1: "Display Name 1"
  category2: "Display Name 2"

# File paths (optional override)
paths:
  primary_file: "path/to/file"
  secondary_file: "path/to/other/file"

# Language preferences (optional)
languages:
  file1: "en"
  file2: "ko"

# Project-specific notes (optional)
notes: |
  Any special considerations for this project.
```

**SKILL.md Integration:**

In your generic SKILL.md, add logic to load the implementation guide:

```markdown
## Instructions

When the user requests [trigger conditions]:

1. **Load project configuration**:
    - Check `.claude/config/<skill-name>.yaml` for `implementation` field
    - Load corresponding implementation guide (e.g., `cdk-infrastructure.md`)
    - Use guide-specific categories, decision trees, and examples

2. **Follow implementation-specific workflow**:
    - Use decision tree from implementation guide
    - Apply project-type-specific patterns
    - Reference implementation guide examples
```

**Example: maintaining-documentation Skill**

The `maintaining-documentation` skill uses this hybrid pattern:

- **SKILL.md**: Generic documentation maintenance workflow
- **cdk-infrastructure.md**: CDK-specific implementation (infrastructure categories, decision tree)
- **config-template.yaml**: Template for project configs
- **fe-infra project config**: `.claude/config/maintaining-documentation.yaml` with CDK implementation + custom category names in Korean

**Benefits:**

1. **Centralized updates**: Implementation guides are shared across projects via marketplace
2. **Project flexibility**: YAML configs allow project-specific overrides (category names, file paths, languages)
3. **Type-specific patterns**: Each project type gets specialized decision trees and examples
4. **Reusability**: New projects copy config template and customize minimally

**When NOT to use Hybrid Pattern:**

- Skill is simple and generic (no project-type variations)
- All logic can be in SKILL.md
- Configuration needs are minimal (simple YAML with 2-3 fields)

4. **Commit the skill**:

```bash
# Stage the new skill
git add skills/<skill-name>/

# Check what will be committed
git status

# Commit with conventional commit message
git commit -m "feat(skills): Add <skill-name> skill

Add skill for [purpose].

Features:
- [Key feature 1]
- [Key feature 2]
- [Key feature 3]"
```

5. **Create project-specific configuration (if needed)**:

```bash
# In the target project, create config file
# File: .claude/config/<skill-name>.md or .yaml
mkdir -p .claude/config

# Contents based on skill requirements
```

## Versioning Convention

All plugin artifacts that users install or copy must include a `plugin_version` marker so the skill can detect outdated configs/scripts at runtime.

**Format by file type:**

| File Type | Marker Format |
|-----------|--------------|
| YAML config | `plugin_version: "X.Y.Z"` (as a field) |
| Bash script | `# plugin_version: X.Y.Z` (as a comment after shebang) |

**Version check in skills:**

Add a `!` pre-executed script in SKILL.md that silently checks the installed version and only warns if outdated:

```markdown
### Version Check
!`if [ -f .claude/config/<skill-name>/main.yaml ]; then cfg_ver=$(grep -m1 'plugin_version:' .claude/config/<skill-name>/main.yaml 2>/dev/null | awk '{print $2}' | tr -d '"'); if [ -n "$cfg_ver" ] && [ "$cfg_ver" != "1.0.0" ]; then echo "VERSION_MISMATCH: config=$cfg_ver, plugin=1.0.0. Run Skill(<plugin>:<config-skill>) to update."; fi; fi`
```

**The version string in `!` scripts is hardcoded** — it ships with the plugin, so it's always the current version. The pre-commit hook in this repo auto-propagates version bumps to all `plugin_version` references when `plugin.json` changes.

**For bash bundles (e.g., git hooks):**

```bash
#!/bin/bash
# plugin_version: 1.0.0
#
# Description of the script
```

The setup skill checks installed scripts against the hardcoded current version and warns if outdated.

## Skill Creation Checklist

Before committing a new skill, verify:

- [ ] SKILL.md has proper frontmatter (name, description)
- [ ] SKILL.md has clear instructions section
- [ ] SKILL.md has example workflows
- [ ] SKILL.md explains configuration file management
- [ ] README.md provides user-friendly overview
- [ ] README.md has installation instructions
- [ ] Examples are clear and realistic
- [ ] Configuration template provided (if applicable)
- [ ] Skill integrates well with existing skills
- [ ] Skill is committed to repository
- [ ] Project-specific config created (if needed)

## Common Pitfalls to Avoid

### ❌ Creating Skill in Wrong Location

```bash
# For shared/distributed skills (part of a plugin):
mkdir plugins/<plugin-name>/skills/<skill-name>

# For project-only skills (not distributed):
mkdir .claude/skills/<skill-name>
```

### ❌ Incomplete Frontmatter

```markdown
# WRONG: Missing fields
---
name: My Skill
---

# CORRECT: Complete metadata
---
name: My Skill
description: Complete one-line description with trigger conditions
---
```

## Skill Naming Conventions

- **Kebab-case**: `git-strategy`, `skill-creator`, `conventional-commits`
- **Descriptive**: Name clearly indicates purpose
- **Concise**: 1-3 words maximum
- **No prefixes**: Don't use `claude-`, `skill-`, etc.

## Description Guidelines

- **One-line summary**: 50-100 characters
- **Include trigger**: "Use when user requests X"
- **Action-oriented**: Start with verb (Manage, Create, Guide, etc.)
- **Specific**: Mention key capabilities

**Examples:**

- ✅ "Create commits following Conventional Commits specification with intelligent multi-commit splitting"
- ✅ "Manage git workflow for environment-based infrastructure deployments with rollback capabilities"
- ❌ "A skill for git" (too vague)
- ❌ "This skill helps with commits" (not action-oriented)

## Integration Testing

After creating a skill, test it:

1. **Invoke the skill**: Try the skill name to see if Claude recognizes it
2. **Test trigger phrases**: Use phrases mentioned in description
3. **Verify configuration**: Ensure project-specific config is read correctly
4. **Test with examples**: Run through example workflows
5. **Check accessibility**: Verify skill files are accessible

## Post-Creation Workflow

After creating a skill:

1. **Push changes**:
```bash
git push origin main
```

2. **Update documentation**:
- Add skill to project README if applicable
- Update CLAUDE.md with new skill reference
- Create skill-specific documentation if needed

## Related Skills

- **conventional-commits**: Use for creating commit messages when committing new skills
- **git-strategy**: Reference for understanding git workflow
- **pull-request-management**: Use when creating PRs for skill additions

## Notes

- Skills should be **generic and reusable** across projects
- Project-specific logic goes in **configuration files**, not skills
- Distribute skills via the Claude Code marketplace
- Always test skill invocation before pushing
- Keep skill instructions **clear and actionable**
- Provide **realistic examples** from actual use cases