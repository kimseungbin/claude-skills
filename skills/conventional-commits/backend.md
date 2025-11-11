---
implementation: backend
project_types:
  - Express
  - NestJS
  - FastAPI
  - Django
  - Spring Boot
  - Go servers
  - Backend applications
applicable_to:
  - Monorepo backend projects
  - Single-repo backend projects
status: TODO
---

# Backend Commit Guide

**Status: 🚧 TODO - Skeleton only**

This guide will provide commit message patterns for backend projects using Express, NestJS, FastAPI, Django, Spring Boot, Go, or other backend frameworks.

## Type Selection Decision Tree

**TODO:** Create decision tree specific to backend changes:
- API endpoints vs business logic vs database
- Authentication vs authorization
- Middleware vs controllers vs services
- Database migrations vs schema changes
- External service integrations

## Scope Selection Pattern

**TODO:** Define backend-specific scopes:

### Monorepo Projects
- packages/api/ → Which scope?
- packages/database/ → Which scope?
- packages/services/ → Which scope?

### Single-Repo Projects
- src/controllers/ → ?
- src/services/ → ?
- src/models/ → ?
- src/middleware/ → ?
- migrations/ → ?

## Common Backend Anti-patterns

**TODO:** Document backend-specific anti-patterns:
- API vs service layer confusion
- Database migrations (feat vs chore?)
- Configuration changes (environment variables)
- External service integrations

## Example Commit Messages

**TODO:** Add backend-specific examples:
- API endpoint creation
- Service layer changes
- Database schema changes
- Middleware additions
- Authentication/authorization changes
- External API integrations

## Notes

This guide needs to be developed. For now, refer to the project's `.claude/config/conventional-commits.yaml` for scope definitions.

If you're implementing this guide, consider:
- How to handle API versioning
- Database migration commits
- Authentication/authorization changes
- External service integrations
- Background jobs/workers
- Caching layer changes