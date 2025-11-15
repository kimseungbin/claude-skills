# Create config-template.yaml for git-hooks-setup

**Priority:** Low
**Type:** Configuration Template
**Skill:** git-hooks-setup
**Estimated Time:** 20 minutes

## Problem

The `git-hooks-setup` skill has an inline configuration example in SKILL.md but no separate template file for users to copy.

## Current State

- ✅ Configuration section exists in SKILL.md (lines 202-225)
- ✅ Inline example config provided
- ❌ No separate `config-template.yaml` file

## Task

Create `skills/git-hooks-setup/config-template.yaml`

## Content to Create

Based on the inline example in SKILL.md, create a comprehensive template:

```yaml
# Git Hooks Setup Configuration
# Copy this file to .claude/config/git-hooks.yaml in your project
# This configuration customizes git hooks for your project

# Project name (used in hook messages)
project: my-project

# Hook Types to Generate
# Uncomment the hooks you want to create
hooks:
  - pre-commit      # Run before commit
  # - commit-msg    # Validate commit message format
  # - pre-push      # Run before push
  # - post-merge    # Run after merge
  # - post-checkout # Run after checkout

# Pre-Commit Hook Configuration
pre_commit:
  # Commands to run before committing
  checks:
    - name: TypeScript Type Check
      command: tsc --noEmit
      enabled: true
      file_patterns: ['*.ts', '*.tsx']

    - name: ESLint
      command: npm run lint
      enabled: true
      file_patterns: ['*.ts', '*.tsx', '*.js', '*.jsx']

    - name: Prettier Format Check
      command: npm run format:check
      enabled: true
      file_patterns: ['*.ts', '*.tsx', '*.js', '*.jsx', '*.json', '*.md']

    # - name: Unit Tests
    #   command: npm test
    #   enabled: false
    #   file_patterns: ['*.ts', '*.tsx']

  # Skip hook with --no-verify
  allow_skip: true

# Commit Message Hook Configuration
commit_msg:
  # Validate commit message format
  format: conventional  # 'conventional', 'custom', or 'none'

  # For conventional commits
  conventional:
    types: [feat, fix, docs, style, refactor, test, chore, ci]
    max_subject_length: 72
    require_scope: false
    require_ticket: false  # Set to true to require ticket number
    # ticket_pattern: '^[A-Z]+-\d+' # Regex for ticket format (e.g., JIRA-123)

  # For custom format
  # custom:
  #   pattern: '^(feat|fix|docs): .{1,72}$'
  #   error_message: 'Commit message must start with feat:, fix:, or docs:'

# Pre-Push Hook Configuration
pre_push:
  checks:
    - name: Run All Tests
      command: npm test
      enabled: false  # Disabled by default (can be slow)

    - name: Build Check
      command: npm run build
      enabled: true

    # - name: Integration Tests
    #   command: npm run test:integration
    #   enabled: false

# File Patterns
# Define which files trigger which hooks
file_patterns:
  typescript: ['*.ts', '*.tsx']
  javascript: ['*.js', '*.jsx']
  style: ['*.css', '*.scss', '*.less']
  config: ['*.json', '*.yaml', '*.yml']
  documentation: ['*.md']

# Project Detection
# Override automatic detection if needed
detection:
  # language: typescript    # typescript, javascript, python, etc.
  # framework: nestjs       # nestjs, react, vue, etc.
  # package_manager: npm    # npm, yarn, pnpm

# Notifications
notifications:
  on_failure: true   # Show detailed error messages
  on_success: false  # Show success messages (can be noisy)
```

## File Location

Create at: `skills/git-hooks-setup/config-template.yaml`

## Update Reference in SKILL.md

After creating the template, update SKILL.md to reference it:

```markdown
For project-specific requirements, create `.claude/config/git-hooks.yaml`:

See `config-template.yaml` for a complete example with all options.

\`\`\`yaml
project: my-project
hooks:
  - pre-commit
  - commit-msg
# ... (abbreviated example)
\`\`\`
```

## Update README.md Task

When implementing task #02 (Add README.md for git-hooks-setup), reference this config template:

```markdown
### Configuration Example

See `config-template.yaml` for a complete configuration template.

Quick example:
\`\`\`yaml
project: my-project
hooks:
  - pre-commit
pre_commit:
  checks:
    - name: TypeScript Check
      command: tsc --noEmit
\`\`\`
```

## Acceptance Criteria

- [ ] File created at `skills/git-hooks-setup/config-template.yaml`
- [ ] Contains comprehensive configuration options
- [ ] Includes all hook types (pre-commit, commit-msg, pre-push)
- [ ] Comments explain each section
- [ ] Examples for TypeScript, JavaScript, and other languages
- [ ] Conventional commit configuration included
- [ ] File patterns documented
- [ ] SKILL.md updated to reference the template
