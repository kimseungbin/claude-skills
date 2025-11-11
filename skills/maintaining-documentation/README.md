# Maintaining Documentation Skill

A Claude Code skill for keeping your entire documentation system (CLAUDE.md, README.md, docs/) synchronized with code changes.

## Overview

This skill ensures documentation never drifts from code by guiding Claude through systematic documentation updates whenever code changes occur.

**Key Capabilities:**
- **Multi-file awareness**: Updates CLAUDE.md, README.md, and docs/ as needed
- **Project-type specific**: Uses implementation guides for different project types (CDK, React, Python, etc.)
- **Prevents drift**: Enforces code + docs in same commit
- **Configurable**: Adapt to your project's documentation structure

## When to Use This Skill

Use this skill when:
- Adding new features, services, or modules
- Refactoring code structure
- Introducing new patterns or conventions
- Changing deployment/build processes
- Creating comprehensive guides

**Automatic triggers:**
- After modifying key infrastructure files
- After adding/removing services or components
- After changing code organization

## Documentation System

This skill manages the complete documentation ecosystem:

| File/Directory | Audience | Purpose |
|----------------|----------|---------|
| **CLAUDE.md** | AI (Claude Code) | Actionable codebase guide |
| **README.md** | Human developers | Project overview, quick start |
| **docs/** | Human developers | Detailed guides, references |

## Project Types Supported

### CDK Infrastructure (`cdk-infrastructure.md`)

For AWS CDK and Infrastructure as Code projects.

**Categories:**
- IaC Code Structure (constructs, stacks, directories)
- Service Infrastructure (deployed services and AWS resources)
- CDK Pipeline Infrastructure (deployment pipeline itself)
- Patterns and Conventions (naming, validation, workflows)

**Examples:** AWS CDK, CloudFormation, Terraform (adaptable)

### React Frontend (Coming Soon)

For React and frontend application projects.

### Python Backend (Coming Soon)

For Python and backend service projects.

## Quick Start

### 1. Install the Skill

```bash
# If using as git submodule
cd .claude/skills
ln -s ../../claude-skills/skills/maintaining-documentation maintaining-documentation
```

### 2. Create Project Configuration

```bash
# Copy config template
cp .claude/skills/maintaining-documentation/config-template.yaml \
   .claude/config/maintaining-documentation.yaml

# Edit config
vim .claude/config/maintaining-documentation.yaml
```

### 3. Set Implementation Type

```yaml
# In .claude/config/maintaining-documentation.yaml
implementation: cdk-infrastructure  # or react-frontend, python-backend
```

### 4. Customize Categories (Optional)

```yaml
categories:
  iac_code_structure: "IaC Code Structure"
  service_infrastructure: "Service Infrastructure"
  # ... etc
```

## Configuration

### Minimal Configuration

```yaml
# .claude/config/maintaining-documentation.yaml
implementation: cdk-infrastructure
```

### Full Configuration

```yaml
implementation: cdk-infrastructure

categories:
  iac_code_structure: "IaC 코드 구조"
  service_infrastructure: "Service Infrastructure"
  pipeline_infrastructure: "CDK Pipeline Infrastructure"
  patterns_conventions: "패턴 및 규칙"

section_mappings:
  service_infrastructure:
    - "Services Managed"
    - "Architecture Overview"

paths:
  claude_md: "CLAUDE.md"
  readme: "README.md"
  docs_dir: "docs/"

languages:
  claude_md: "en"
  readme: "ko"
  docs: "ko"

notes: |
  Project-specific documentation guidelines here.
```

## Usage Example

### Scenario: Adding New Microservice

**You make code changes:**
```typescript
// Add new service to enum
enum ServiceName {
  AUTH = 'auth',
  API = 'api',
  PROFILE = 'profile',  // NEW
}

// Add service configuration
const services = {
  profile: {
    cpu: 1024,
    memory: 2048,
    // ...
  }
}

// Deploy service in stack
new ServiceConstruct(this, 'Profile', { /* ... */ });
```

**Skill guides you to update documentation:**

1. **CLAUDE.md**:
   - Update "Services Managed" table (add profile row)
   - Update "Architecture Overview" (add profile to diagram)

2. **README.md**:
   - Add profile to managed services list

3. **Commit**:
   ```bash
   git commit -m "feat(service): Add profile service

   - Add ServiceName.PROFILE enum
   - Configure profile service
   - Deploy profile service
   - Update CLAUDE.md Services Managed table
   - Update CLAUDE.md Architecture Overview
   - Add profile to README.md managed services"
   ```

## Key Principles

### 1. Code + Documentation in Same Commit

**Never separate code and documentation commits.**

❌ **Wrong:**
```bash
git commit -m "feat: Add feature"
git commit -m "docs: Update docs"
```

✅ **Correct:**
```bash
git commit -m "feat: Add feature

- Implement feature X
- Update CLAUDE.md with feature documentation"
```

### 2. Document Paths, Not Values

**Configuration values change frequently. Document file paths instead.**

❌ **Wrong:**
```markdown
## Services
- auth: 1024 CPU, 2048 memory, 4 tasks
- api: 512 CPU, 1024 memory, 2 tasks
```

✅ **Correct:**
```markdown
## Services

Service configurations in `src/config/config.data.ts`.
```

### 3. Different Audiences, Different Needs

- **CLAUDE.md**: Concise, actionable, imperative for AI
- **README.md**: Friendly, explanatory for humans
- **docs/**: Comprehensive, detailed for deep dives

## Implementation Guides

Implementation guides provide project-type-specific patterns:

### CDK Infrastructure Guide

Located at `cdk-infrastructure.md`, this guide covers:
- Infrastructure categorization (IaC structure, services, pipeline, patterns)
- Decision tree for determining documentation impact
- Configuration principle (don't document values)
- CLAUDE.md section mappings
- Example scenarios
- Verification commands

### Creating New Implementation Guides

To add support for a new project type:

1. Copy `cdk-infrastructure.md` as template
2. Define categories relevant to that project type
3. Create decision tree for documentation impact
4. Provide example scenarios
5. Document project-type-specific patterns

See `skill-creator` skill for guidance.

## Integration

**Works well with:**
- **conventional-commits**: Properly formatted commit messages
- **pull-request-management**: PR creation with documentation updates
- **Project-specific skills**: Chain with domain skills (e.g., `cdk-expert`)

## Common Mistakes

### ❌ Updating Only CLAUDE.md

Updating CLAUDE.md but forgetting README.md or docs/.

**Solution:** Check all documentation files per implementation guide.

### ❌ Creating docs/ Without Links

Creating documentation files but not linking from README.md or CLAUDE.md.

**Solution:** Always add links to documentation indexes.

### ❌ Inconsistent Terminology

Using different terms for the same concept across documentation files.

**Solution:** Establish terminology in implementation guide.

## Troubleshooting

### Skill not found

Ensure symlink exists:
```bash
ls -la .claude/skills/maintaining-documentation
```

### Config not loaded

Check config file location:
```bash
cat .claude/config/maintaining-documentation.yaml
```

### Wrong implementation guide

Verify `implementation` field in config matches available guide:
```bash
ls .claude/skills/maintaining-documentation/*.md
```

## Contributing

To improve this skill:

1. **Add new implementation guides** for different project types
2. **Enhance decision trees** with more comprehensive logic
3. **Add example scenarios** from real projects
4. **Improve verification commands** for accuracy checks

## License

Part of the claude-skills collection.

## Related Skills

- **conventional-commits**: Commit message formatting
- **skill-creator**: Creating new skills
- **cdk-expert**: CDK-specific patterns (when using cdk-infrastructure guide)
