---
implementation: fullstack
project_types:
  - Next.js
  - Nuxt
  - SvelteKit
  - Remix
  - T3 Stack
status: skeleton
---

# Fullstack Commit Guide

**Status: Skeleton - needs development**

Commit patterns for fullstack frameworks.

## Type Decision Tree

```
Code Change Made
│
├─ Adds NEW feature (frontend + backend)?
│  └─ YES → feat(scope)
│      Consider: One commit or split?
│
├─ API route change?
│  └─ YES → feat/fix/refactor(api)
│
├─ Server component?
│  └─ YES → Use appropriate scope
│
├─ Client component?
│  └─ YES → Use component scope
│
└─ Database + UI change?
   └─ Consider splitting commits
```

## Scope Patterns (TODO)

### Next.js App Directory
```
app/           → app
app/api/       → api
components/    → components
lib/           → lib
server/        → server
```

### T3 Stack
```
src/pages/     → pages
src/server/    → server
src/components/ → components
prisma/        → db
```

## Examples (TODO)

```
feat(api): Add user registration endpoint
feat(components): Add registration form
refactor(server): Extract auth utilities
```

## Notes

This guide needs development. Consider:
- Server vs client components
- API routes vs server actions
- tRPC/GraphQL patterns
- Database + frontend in same commit?