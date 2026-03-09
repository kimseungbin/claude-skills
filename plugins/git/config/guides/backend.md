---
implementation: backend
project_types:
  - Express
  - NestJS
  - FastAPI
  - Django
  - Spring Boot
  - Go servers
status: skeleton
---

# Backend Commit Guide

**Status: Skeleton - needs development**

Commit patterns for backend projects.

## Type Decision Tree

```
Code Change Made
│
├─ Adds NEW API endpoint/feature?
│  └─ YES → feat(scope)
│      ✅ New endpoint, service, integration
│
├─ Fixes API/logic bug?
│  └─ YES → fix(scope)
│      ✅ Incorrect response, broken logic
│
├─ Database migration?
│  └─ Consider context:
│      New table for feature → feat(db)
│      Schema fix → fix(db)
│      Optimization → refactor(db)
│
└─ Changes service structure?
   └─ YES → refactor(scope)
```

## Scope Patterns (TODO)

### Monorepo
```
packages/api/      → api
packages/database/ → db
packages/services/ → services
```

### Single-Repo
```
src/controllers/ → api
src/services/    → services
src/models/      → models
migrations/      → db
```

## Examples (TODO)

```
feat(api): Add user authentication endpoint
fix(services): Correct password validation logic
refactor(models): Extract base entity class
```

## Notes

This guide needs development. Consider:
- API versioning patterns
- Database migration commits
- Authentication/authorization
- External service integrations
- Background jobs/workers