---
name: file-headers
description: Adds JSDoc file-level summaries so Claude can understand files by reading only headers
version: 0.1.0
---

# File Headers Skill

Adds file-level JSDoc documentation that summarizes a file's purpose, exports, usage, and dependencies. This allows Claude to understand a file by reading only the first ~20-30 lines instead of the entire file.

## When to Use

- After the Stop hook detects reading large files
- For key files that are frequently accessed
- For complex files with many exports
- When onboarding a new codebase

## Workflow

### 1. Identify Target Files

Prioritize files that are:
- Frequently imported by other files
- Large (> 100 lines)
- Complex with multiple exports
- Entry points or service files

Check which files were read excessively (from Stop hook feedback).

### 2. Analyze File Contents

Before adding a header, understand:
- What does this file export?
- How is it typically used?
- What are its dependencies?
- What related files should readers know about?

### 3. Add File Header

#### TypeScript/JavaScript Format

```typescript
/**
 * @fileoverview Authentication service for JWT-based auth
 * @module auth/service
 *
 * @example
 * import { AuthService } from './service';
 * const auth = new AuthService(config);
 * const token = await auth.login({ email, password });
 * const user = await auth.validateToken(token);
 *
 * @exports AuthService - Main service class for authentication
 * @exports AuthConfig - Configuration interface
 * @exports LoginDto - Login request shape
 * @exports TokenPayload - JWT payload structure
 *
 * @dependencies
 * - JwtService from @nestjs/jwt
 * - UserRepository from ../users/repository
 * - ConfigService from @nestjs/config
 *
 * @see ./guard.ts - Route protection guards
 * @see ./dto.ts - All request/response DTOs
 * @see ../users/service.ts - User lookup
 */
```

#### Python Format

```python
"""
Authentication service for JWT-based auth.

Example:
    from auth.service import AuthService

    auth = AuthService(config)
    token = await auth.login(email, password)
    user = await auth.validate_token(token)

Exports:
    AuthService: Main service class for authentication
    AuthConfig: Configuration dataclass
    LoginDto: Login request shape

Dependencies:
    - jwt: Token generation and validation
    - users.repository: User lookup
    - config: Application settings

See Also:
    - auth.guard: Route protection
    - auth.dto: Request/response DTOs
"""
```

### 4. Header Content Guidelines

#### Required Sections

| Section | Purpose |
|---------|---------|
| `@fileoverview` | One-line description of file purpose |
| `@exports` | List main exports with brief descriptions |

#### Recommended Sections

| Section | Purpose |
|---------|---------|
| `@example` | Common usage pattern (most valuable for Claude) |
| `@dependencies` | External imports Claude needs to know about |
| `@see` | Related files for context |
| `@module` | Module path for import statements |

#### Avoid

- Implementation details (algorithms, internal logic)
- Line-by-line documentation
- Frequently changing information (version numbers, dates)
- Redundant information already in function/class docs

### 5. Example Patterns

#### Service File

```typescript
/**
 * @fileoverview User management service - CRUD operations
 * @module users/service
 *
 * @example
 * const user = await userService.create({ email, name });
 * const found = await userService.findById(id);
 * await userService.update(id, { name: 'New Name' });
 *
 * @exports UserService - Main service class
 * @exports CreateUserDto, UpdateUserDto - Input DTOs
 *
 * @dependencies
 * - UserRepository from ./repository
 * - HashService from ../common/hash
 */
```

#### Repository File

```typescript
/**
 * @fileoverview User database operations
 * @module users/repository
 *
 * @example
 * const user = await repo.findByEmail('test@example.com');
 * const users = await repo.findMany({ where: { active: true } });
 *
 * @exports UserRepository - Database access class
 * @exports UserEntity - Database entity type
 *
 * @dependencies
 * - PrismaService from ../database/prisma
 */
```

#### Utility File

```typescript
/**
 * @fileoverview String manipulation utilities
 * @module common/utils/string
 *
 * @example
 * import { slugify, truncate, capitalize } from './string';
 * slugify('Hello World'); // 'hello-world'
 * truncate('Long text...', 10); // 'Long te...'
 *
 * @exports slugify - Convert string to URL-safe slug
 * @exports truncate - Shorten string with ellipsis
 * @exports capitalize - Capitalize first letter
 * @exports camelToSnake - Convert camelCase to snake_case
 */
```

### 6. Target Line Count

Keep headers concise:
- **Minimum**: 10 lines (fileoverview + exports)
- **Ideal**: 15-25 lines (includes example and dependencies)
- **Maximum**: 35 lines (avoid bloat)

## Project-Specific Configuration

Check for `.claude/config/codebase-index.yaml`:

```yaml
headers:
  style: jsdoc              # jsdoc, python, or custom
  max_lines: 25
  include:
    - exports               # Always include
    - example               # Highly recommended
    - dependencies          # Recommended
    - see_also              # Optional
  exclude_patterns:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/mocks/**"
```

## Output

After running this skill:
1. File headers added to target files
2. Existing headers updated if incomplete
3. List of files modified