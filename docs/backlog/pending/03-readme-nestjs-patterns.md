# Add README.md for nestjs-patterns

**Priority:** High
**Type:** Documentation
**Skill:** nestjs-patterns
**Estimated Time:** 1 hour

## Problem

The `nestjs-patterns` skill is missing user-facing documentation (README.md).

## Current State

```
skills/nestjs-patterns/
└── SKILL.md           ✅
```

Missing: README.md

## Task

Create `skills/nestjs-patterns/README.md`

## Content Requirements

### Overview Section
- What the skill does: NestJS-specific patterns and best practices
- Focus areas: Repository pattern, DI, testing, ESM configuration
- Target audience: NestJS developers

### When to Use Section
- Implementing repository pattern with abstract classes
- Setting up dependency injection
- Configuring testing strategies
- Working with ESM modules in NestJS

### Key Patterns Covered

1. **Abstract Class Repository Pattern**
   - Type-safe repository interfaces
   - BaseRepository implementation
   - Avoiding @Injectable() on abstract classes

2. **Dependency Injection Configuration**
   - Proper DI setup
   - Module configuration
   - Provider patterns

3. **Configuration Management**
   - Exporting constants separately from ConfigService
   - Test-friendly configuration
   - Avoiding duplicate configuration

4. **Testing Strategies**
   - Unit testing with DI
   - Mocking ConfigService
   - Test module setup

5. **ESM Configuration**
   - tsconfig.json setup
   - Module resolution
   - Import/export patterns

### Installation Instructions
- Git submodule setup
- Symlink creation
- Optional: Configuration file setup

### Usage Examples

#### Example 1: Repository Pattern
```
User: "Set up a repository pattern for my NestJS service"
Skill: [Shows abstract class pattern with TypeORM example]
```

#### Example 2: Testing Setup
```
User: "How do I test my service that uses ConfigService?"
Skill: [Shows configuration constant export pattern]
```

### Anti-Patterns to Avoid
- Using @Injectable() on abstract classes
- Duplicate configuration
- Tight coupling to ConfigService in tests

## Template Reference

Use the README.md template from `docs/backlog/readme.md` (original version) as a starting point.

## Acceptance Criteria

- [ ] File created at `skills/nestjs-patterns/README.md`
- [ ] Contains all required sections
- [ ] Follows template structure
- [ ] Lists all 5 key patterns
- [ ] Includes usage examples
- [ ] Anti-patterns section included
- [ ] Installation instructions included
