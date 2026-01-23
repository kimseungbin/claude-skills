# Codebase Index Plugin

A Claude Code plugin that improves navigation efficiency by detecting unnecessary exploration and providing tools to build codebase knowledge.

## Problem

When Claude doesn't know where code lives, it:
- Spawns Explore agents to search the codebase
- Reads many files looking for the right one
- Uses Glob/Grep to hunt for patterns
- Wastes context and time on discovery

## Solution

This plugin provides:

1. **Stop Hook** — Detects when Claude had to explore/read excessively and prompts for CLAUDE.md improvements
2. **maintain-index Skill** — Creates and maintains index files mapping features to file paths
3. **file-headers Skill** — Adds JSDoc file summaries so Claude can read headers instead of entire files

## Installation

See [Claude Code Plugin Discovery](https://code.claude.com/docs/en/discover-plugins.md)

## Components

### Stop Hook

Automatically triggers after Claude finishes responding. Analyzes the session transcript to detect:

| Signal | Threshold | Meaning |
|--------|-----------|---------|
| Explore agent | > 0 | Claude didn't know where to look |
| Read calls | > 5 | Claude was searching through files |
| Lines read | > 500 | Claude read large files instead of headers |
| Glob/Grep | > 3 | Claude was hunting for patterns |

When thresholds are exceeded, Claude is prompted to suggest CLAUDE.md improvements.

### maintain-index Skill

Creates index files (e.g., `src/INDEX.md`) that map features to file paths:

```markdown
## Authentication
- src/auth/service.ts - Main auth service, JWT handling
- src/auth/guard.ts - Route guards, permission checks
- src/middleware/jwt.ts - JWT validation middleware

## User Management
- src/users/service.ts - CRUD operations
- src/users/dto.ts - Request/response types
```

**For large codebases:** When INDEX.md gets too large, use hierarchical indexing. The root INDEX.md points to `index.ts` barrel files in first-depth directories:

```markdown
## Modules
- src/auth/index.ts - Authentication module
- src/users/index.ts - User management module
- src/billing/index.ts - Billing and payments
```

Each `index.ts` then exports the module's public API, which Claude can read to understand available exports without exploring the full directory.

**Invoke:** `Skill(maintain-index)`

### file-headers Skill

Adds JSDoc file-level documentation so Claude can understand a file by reading only the first ~20 lines:

```typescript
/**
 * @fileoverview Authentication service for JWT-based auth
 * @module auth/service
 *
 * @example
 * const auth = new AuthService(config);
 * const token = await auth.login({ email, password });
 *
 * @exports AuthService - Main service class
 * @exports AuthConfig - Configuration interface
 * @exports LoginDto - Login request shape
 *
 * @dependencies
 * - JwtService from ./jwt
 * - UserRepository from ../users/repository
 *
 * @see ./guard.ts - For route protection
 * @see ./dto.ts - For all DTOs
 */
```

**Invoke:** `Skill(file-headers)`

## How It Works Together

1. **Detection**: Stop hook notices Claude explored excessively
2. **Suggestion**: Claude suggests what to add to CLAUDE.md or index files
3. **Indexing**: User invokes `maintain-index` to update index files
4. **Headers**: User invokes `file-headers` to add summaries to key files
5. **Future**: Next time, Claude reads index/headers instead of exploring

## Configuration

Create `.claude/config/codebase-index.yaml` for project-specific settings:

```yaml
# Thresholds for stop hook
thresholds:
  explore_count: 0      # Any Explore agent usage triggers
  read_count: 5         # More than 5 reads triggers
  lines_read: 500       # More than 500 total lines read triggers
  glob_grep_count: 3    # More than 3 searches triggers

# Index file settings
index:
  filename: INDEX.md    # Or .index.yaml, DIRECTORY.md, etc.
  locations:            # Where to create index files
    - src/
    - lib/

# File header settings
headers:
  style: jsdoc          # jsdoc, markdown, or custom
  max_lines: 25         # Target header size
  include:
    - exports
    - example
    - dependencies
    - see_also
```

## File Structure

```
codebase-index/
├── .claude-plugin/
│   └── plugin.json       # Plugin manifest
├── hooks/
│   └── hooks.json        # Stop hook configuration
├── skills/
│   ├── maintain-index/
│   │   └── SKILL.md      # Index maintenance skill
│   └── file-headers/
│       └── SKILL.md      # File header skill
└── README.md             # This file
```

## Requirements

- Claude Code CLI
- jq (for hook script JSON parsing)
- Bash shell

## License

MIT