---
name: Skill Creator
description: Create new Claude Code skills following best practices and standardized structure. Use when user wants to create a new skill or convert documentation into a skill.
---

# Skill Creator

This skill guides the creation of new Claude Code skills, ensuring consistent structure, proper submodule management, and complete documentation.

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

3. **Create the skill in the submodule**:

### Step 1: Create Directory Structure

```bash
# Navigate to claude-skills submodule
cd claude-skills

# Ensure on main branch
git checkout main
git pull origin main

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

⚠️ **CRITICAL: Configuration File Management** ⚠️

This skill is a **git submodule** shared across multiple projects.

**Priority order:**

1. **Project-specific configuration** (PRIMARY): `.claude/config/<skill-name>.md` or `.yaml`
2. **Default configuration** (FALLBACK): Provided by skill or generic behavior

**Configuration Pattern:**

- `.claude/skills/<skill-name>/` → Symlink to submodule (READ-ONLY, shared)
- `.claude/config/<skill-name>.*` → Real file in project (WRITABLE, project-specific)

**When user requests project-specific configuration:**

1. Check if `.claude/config/<skill-name>.*` exists
2. If NOT exists, create it with project-specific settings
3. If EXISTS, update it
4. NEVER modify files in the skill directory (it's a submodule!)

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

### As Git Submodule (Recommended)

```bash
# Add submodule (if not already added)
git submodule add https://github.com/kimseungbin/claude-skills.git claude-skills

# Create symlink
ln -s ../../claude-skills/skills/<skill-name> .claude/skills/<skill-name>

# Create project-specific configuration
mkdir -p .claude/config
# Create .claude/config/<skill-name>.* with project settings
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

1. **Centralized updates**: Implementation guides live in submodule, shared across projects
2. **Project flexibility**: YAML configs allow project-specific overrides (category names, file paths, languages)
3. **Type-specific patterns**: Each project type gets specialized decision trees and examples
4. **Reusability**: New projects copy config template and customize minimally

**When NOT to use Hybrid Pattern:**

- Skill is simple and generic (no project-type variations)
- All logic can be in SKILL.md
- Configuration needs are minimal (simple YAML with 2-3 fields)

4. **Commit the skill to submodule**:

```bash
cd claude-skills

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
- [Key feature 3]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

5. **Create symlink in main project**:

```bash
# Navigate back to main project root
cd /Users/seungbinkim/docuements/dev/fe-infra

# Create symlink
ln -s ../../claude-skills/skills/<skill-name> .claude/skills/<skill-name>

# Verify symlink created
ls -la .claude/skills/
```

6. **Create project-specific configuration (if needed)**:

```bash
# Create config file in main project
# File: .claude/config/<skill-name>.md or .yaml

# Contents based on skill requirements
```

7. **Update main project to reference new submodule commit**:

```bash
# In main project root
git add .claude/skills/<skill-name>  # Symlink
git add .claude/config/<skill-name>.*  # Config (if created)
git add claude-skills  # Updated submodule reference

git status  # Verify changes
```

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
- [ ] Skill is committed to submodule (not main project)
- [ ] Symlink created in main project
- [ ] Project-specific config created (if needed)
- [ ] No nested directories accidentally created

## Common Pitfalls to Avoid

### ❌ Creating Skill in Wrong Location

```bash
# WRONG: Creating in main project
mkdir .claude/skills/my-skill

# CORRECT: Creating in submodule
cd claude-skills && mkdir skills/my-skill
```

### ❌ Nested Submodule Directories

```bash
# Check for accidental nesting
ls -la claude-skills/
# Should NOT see: claude-skills/claude-skills/

# If nested, remove:
rm -rf claude-skills/claude-skills
```

### ❌ Forgetting Symlink

```bash
# Skill exists but not accessible in main project
# MUST create symlink:
ln -s ../../claude-skills/skills/<skill-name> .claude/skills/<skill-name>
```

### ❌ Modifying Skill Files in Main Project

```bash
# WRONG: Editing via symlink (modifies submodule)
nano .claude/skills/<skill-name>/SKILL.md

# CORRECT: Edit in submodule, commit, then update main project
cd claude-skills
nano skills/<skill-name>/SKILL.md
git commit -am "fix(skill-name): Update instructions"
cd ..
git add claude-skills  # Update submodule reference
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
5. **Check symlink**: Verify skill files are accessible

## Post-Creation Workflow

After creating a skill:

1. **Push submodule changes**:
```bash
cd claude-skills
git push origin main
```

2. **Commit main project changes**:
```bash
cd /Users/seungbinkim/docuements/dev/fe-infra
git add claude-skills .claude/skills/<skill-name> .claude/config/<skill-name>.*
git commit -m "feat(tools): Add <skill-name> skill

Add skill for [purpose].

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

3. **Update documentation**:
- Add skill to project README if applicable
- Update CLAUDE.md with new skill reference
- Create skill-specific documentation if needed

## Related Skills

- **conventional-commits**: Use for creating commit messages when committing new skills
- **git-strategy**: Reference for understanding submodule workflow
- **pull-request-management**: Use when creating PRs for skill additions

## Notes

- Skills should be **generic and reusable** across projects
- Project-specific logic goes in **configuration files**, not skills
- Use **submodule pattern** to share skills across repositories
- Always test skill invocation before pushing
- Keep skill instructions **clear and actionable**
- Provide **realistic examples** from actual use cases