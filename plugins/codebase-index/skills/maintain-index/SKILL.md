---
name: maintain-index
description: Creates and maintains index files mapping features to file paths
version: 0.1.0
---

# Maintain Index Skill

Creates and maintains INDEX.md files that map features and modules to their file locations, enabling efficient navigation without exploration.

## When to Use

- After the Stop hook detects excessive exploration
- When onboarding a new codebase
- After significant refactoring or adding new modules
- When CLAUDE.md is getting too large with file mappings

## Workflow

### 1. Analyze Current State

First, check what index files already exist:

```bash
find . -name "INDEX.md" -o -name "DIRECTORY.md" 2>/dev/null | head -20
```

Check for existing barrel files:

```bash
find . -name "index.ts" -o -name "index.js" 2>/dev/null | grep -v node_modules | head -20
```

### 2. Determine Index Strategy

**Small codebase (< 50 files):** Single `src/INDEX.md`

**Medium codebase (50-200 files):** Root INDEX.md pointing to module index.ts files

**Large codebase (> 200 files):** Hierarchical INDEX.md per major directory

### 3. Create or Update Index

#### Single Index Format

```markdown
# Project Index

## Core
- src/app.ts - Application entry point
- src/config.ts - Configuration loader

## Authentication
- src/auth/service.ts - JWT auth service
- src/auth/guard.ts - Route protection
- src/auth/dto.ts - Login/register DTOs

## Users
- src/users/service.ts - User CRUD
- src/users/repository.ts - Database layer
- src/users/dto.ts - User DTOs
```

#### Hierarchical Index Format (root)

```markdown
# Project Index

For detailed module contents, see each module's index.ts.

## Modules
- src/auth/index.ts - Authentication (JWT, guards, sessions)
- src/users/index.ts - User management (CRUD, profiles)
- src/billing/index.ts - Payments (Stripe, invoices)
- src/notifications/index.ts - Email, SMS, push

## Shared
- src/common/index.ts - Utilities, decorators, types
- src/database/index.ts - DB connection, migrations
```

#### Module index.ts Format

```typescript
/**
 * @module auth
 * @description Authentication module - JWT, guards, sessions
 *
 * @example
 * import { AuthService, JwtGuard } from './auth';
 */

export { AuthService } from './service';
export { JwtGuard, RolesGuard } from './guards';
export { LoginDto, RegisterDto } from './dto';
export type { AuthConfig, JwtPayload } from './types';
```

### 4. Index Content Guidelines

Each entry should include:
- **File path** - Relative from project root
- **Brief description** - What it does (not how)
- **Key exports** (for index.ts) - Main classes/functions

Avoid:
- Implementation details
- Line counts or file sizes
- Frequently changing information

### 5. Maintain Over Time

When adding new files:
1. Add entry to appropriate INDEX.md section
2. Update module index.ts exports if applicable

When removing files:
1. Remove from INDEX.md
2. Update module index.ts

When refactoring:
1. Update file paths in INDEX.md
2. Consider reorganizing sections if structure changed

## Project-Specific Configuration

Check for `.claude/config/codebase-index.yaml`:

```yaml
index:
  filename: INDEX.md        # Or DIRECTORY.md, .index.md
  locations:
    - src/
    - lib/
    - packages/
  exclude:
    - "**/test/**"
    - "**/mocks/**"
```

## Output

After running this skill:
1. INDEX.md files created/updated in appropriate locations
2. Module index.ts files updated with exports and JSDoc
3. Summary of changes made

## Integration with CLAUDE.md

If the project has a CLAUDE.md, add a reference:

```markdown
## Codebase Navigation

See `src/INDEX.md` for file mappings. For module details, check each module's `index.ts`.
```
