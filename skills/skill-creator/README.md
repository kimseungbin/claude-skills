# Skill Creator

A meta-skill for creating new Claude Code skills following best practices and standardized structure.

## Overview

This skill guides the entire process of creating a new skill, from planning to deployment:

- **Skill planning**: Understand requirements and structure
- **File creation**: Generate SKILL.md, README.md, and optional files
- **Submodule management**: Properly create skills in the submodule
- **Symlink setup**: Connect skills to main project
- **Configuration**: Set up project-specific config files
- **Quality checks**: Verify completeness and correctness

## When to Use This Skill

Use this skill when:

- Creating a new skill from scratch
- Converting existing documentation into a skill
- Standardizing an existing skill structure
- Learning the skill creation process
- Ensuring best practices are followed

## What This Skill Creates

### Required Files

1. **SKILL.md**: Core skill instructions for Claude Code
   - Frontmatter with name and description
   - Detailed instructions section
   - Example workflows
   - Configuration guidance

2. **README.md**: User-friendly documentation
   - Overview and features
   - Usage examples
   - Installation instructions
   - Integration notes

### Optional Files

3. **decision-tree.md**: Visual decision flow (for complex skills)
4. **examples.md**: Detailed walkthroughs (for workflow-heavy skills)
5. **config.template.[md|yaml]**: Configuration template for projects

## Key Features

### Submodule-First Approach
- Creates skills in `claude-skills` submodule (shared across projects)
- Prevents accidental nesting or directory issues
- Ensures proper git separation

### Configuration Pattern
- Skill files in submodule (read-only, generic)
- Project config in `.claude/config/` (writable, specific)
- Clear separation of concerns

### Quality Assurance
- Pre-commit checklist
- Common pitfall prevention
- Naming and description guidelines
- Integration testing steps

### Complete Workflow
- Skill creation → Commit to submodule → Create symlink → Configure project

## Usage Examples

### Create New Skill

```
User: "Help me create a new skill for managing AWS CDK deployments"

Skill:
1. Asks about skill requirements (triggers, tasks, config needs)
2. Plans structure (name: "cdk-deployment", files needed)
3. Creates directory in claude-skills/skills/cdk-deployment/
4. Generates SKILL.md with deployment instructions
5. Generates README.md with overview
6. Creates symlink in main project
7. Commits to submodule
8. Updates main project reference
```

### Convert Documentation to Skill

```
User: "Convert our git-strategy.md into a skill"

Skill:
1. Reviews existing documentation
2. Extracts actionable workflows
3. Creates skill structure (git-strategy)
4. Moves project-specific parts to config
5. Keeps generic instructions in SKILL.md
6. Sets up proper file structure
7. Commits and links
```

## Installation

This skill is part of the claude-skills submodule:

```bash
# Skill is already available if submodule exists
ls .claude/skills/skill-creator

# If missing, create symlink
ln -s ../../claude-skills/skills/skill-creator .claude/skills/skill-creator
```

## Skill Creation Process

### 1. Planning Phase
- Define skill purpose and triggers
- Identify required configuration
- Plan file structure

### 2. Creation Phase
- Create directory in submodule
- Generate SKILL.md with instructions
- Generate README.md with documentation
- Add optional files if needed

### 3. Integration Phase
- Commit skill to submodule
- Create symlink in main project
- Set up project-specific config
- Update main project submodule reference

### 4. Testing Phase
- Verify skill invocation
- Test trigger phrases
- Validate configuration reading
- Run through examples

## Common Pitfalls Avoided

### ❌ Wrong Location
Skill prevents creating skills in main project instead of submodule

### ❌ Nested Directories
Skill checks for and prevents `claude-skills/claude-skills/` nesting

### ❌ Missing Symlink
Skill ensures symlink is created and verified

### ❌ Incomplete Metadata
Skill validates frontmatter completeness

### ❌ Poor Naming
Skill enforces naming conventions (kebab-case, descriptive)

## Templates Provided

### SKILL.md Template
Complete template with:
- Frontmatter structure
- Instructions format
- Example workflow patterns
- Configuration guidance
- Integration notes

### README.md Template
User-friendly template with:
- Overview section
- Feature highlights
- Usage examples
- Installation guide
- Contributing guidelines

## Quality Checklist

The skill provides a pre-commit checklist:
- [ ] SKILL.md has proper frontmatter
- [ ] Instructions are clear and actionable
- [ ] Examples are realistic
- [ ] Configuration pattern documented
- [ ] README.md is user-friendly
- [ ] Symlink created correctly
- [ ] No nested directories
- [ ] Skill committed to submodule

## Integration with Other Skills

Works well with:
- **conventional-commits**: Creates commit messages for new skills
- **git-strategy**: References submodule workflow
- **pull-request-management**: Creates PRs for skill additions

## Best Practices

### Skill Design
- Keep skills **generic and reusable**
- Use configuration files for **project-specific logic**
- Provide **clear, actionable instructions**
- Include **realistic examples**

### Naming
- Use **kebab-case** (git-strategy, skill-creator)
- Be **descriptive** (1-3 words)
- No prefixes (claude-, skill-, etc.)

### Description
- **One-line summary** (50-100 chars)
- **Include triggers** ("Use when...")
- **Action-oriented** (start with verb)
- **Specific** (mention key capabilities)

## Post-Creation Workflow

After skill creation:

1. Push submodule changes
2. Commit main project changes
3. Update project documentation
4. Test skill invocation
5. Create PR if needed

## Contributing

When improving this skill:

1. Test with real skill creation scenarios
2. Update templates based on patterns
3. Add common pitfalls as discovered
4. Keep checklist comprehensive
5. Document edge cases

## Notes

- This is a **meta-skill** (creates other skills)
- Follows the same patterns it teaches
- Self-referential documentation
- Regularly updated based on new patterns

## License

Part of the claude-skills collection. Shared across multiple projects via git submodule.