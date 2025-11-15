# Add Configuration Section to nestjs-patterns

**Priority:** Medium
**Type:** Documentation
**Skill:** nestjs-patterns
**Estimated Time:** 45 minutes

## Problem

The `nestjs-patterns` skill is missing a "Project-Specific Configuration" section in SKILL.md.

## Current State

SKILL.md has:
- ✅ Frontmatter
- ✅ Pattern descriptions
- ✅ Code examples
- ✅ Anti-patterns
- ❌ Configuration Section

## Task

Add "Project-Specific Configuration" section to `skills/nestjs-patterns/SKILL.md`

## Placement

Insert at the end of SKILL.md, after all patterns and examples.

## Content to Add

```markdown
## Project-Specific Configuration

⚠️ **CRITICAL: Configuration File Management** ⚠️

This skill is a **git submodule** shared across multiple projects.

**Priority order:**

1. **Project-specific configuration** (PRIMARY): `.claude/config/nestjs-patterns.yaml`
2. **Default configuration** (FALLBACK): Generic NestJS patterns from this skill

**Configuration Pattern:**

- `.claude/skills/nestjs-patterns/` → Symlink to submodule (READ-ONLY, shared)
- `.claude/config/nestjs-patterns.yaml` → Real file in project (WRITABLE, project-specific)

**When to create config:**

1. Check if `.claude/config/nestjs-patterns.yaml` exists
2. If NOT exists, create it when user specifies project-specific patterns
3. If EXISTS, update it with new rules
4. NEVER modify files in the skill directory (it's a submodule!)

**Example config:**

\`\`\`yaml
# NestJS Patterns Configuration
project: my-nestjs-project

# Patterns to use in this project
patterns:
  - repository-pattern        # Use abstract class repository pattern
  - dependency-injection      # Configure DI patterns
  - configuration-management  # Export config constants
  - testing-strategies        # Test setup patterns
  - esm-configuration        # ESM module setup

# Project-specific preferences
preferences:
  repository:
    base_class: BaseRepository
    use_typeorm: true
    use_prisma: false

  testing:
    framework: jest
    coverage_threshold: 80
    mock_config_service: true

  modules:
    type: esm                 # 'esm' or 'commonjs'
    use_path_aliases: true

# Database configuration
database:
  orm: typeorm               # 'typeorm', 'prisma', 'sequelize'
  entities_path: src/entities
  repositories_path: src/repositories

# Code generation preferences
codegen:
  create_tests: true
  create_dto: true
  create_entity: true
  create_repository: true
\`\`\`

**Configuration usage:**

When user asks to create a new service or repository:
1. Read project config to determine patterns to use
2. Apply configured ORM (TypeORM vs Prisma)
3. Use project's testing framework setup
4. Follow ESM or CommonJS module pattern
5. Generate code according to codegen preferences

**When no config exists:**

Use default patterns from this skill (TypeORM + Jest + ESM).
```

## Additional Notes

This configuration is **useful but optional**:
- Default patterns work for standard NestJS projects
- Config helps standardize across team
- Especially useful for:
  - Multi-developer teams
  - Projects with specific ORM choices
  - Custom testing setups
  - Code generation automation

## Template Reference

Use the configuration section template from `docs/backlog/readme.md` (original version) as a guide.

## Acceptance Criteria

- [ ] Configuration section added to SKILL.md
- [ ] Placed at end of file
- [ ] Explains `.claude/config/nestjs-patterns.yaml` pattern
- [ ] Shows comprehensive example config
- [ ] Explains when to create config
- [ ] Documents all configurable options
- [ ] Notes that config is optional but useful
