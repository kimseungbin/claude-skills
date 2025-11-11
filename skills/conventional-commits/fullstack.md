---
implementation: fullstack
project_types:
  - Next.js
  - Nuxt
  - SvelteKit
  - Remix
  - T3 Stack
  - Fullstack frameworks
applicable_to:
  - Fullstack monorepo projects
  - Single-repo fullstack projects
status: TODO
---

# Fullstack Commit Guide

**Status: 🚧 TODO - Skeleton only**

This guide will provide commit message patterns for fullstack projects using Next.js, Nuxt, SvelteKit, Remix, T3 Stack, or other fullstack frameworks.

## Type Selection Decision Tree

**TODO:** Create decision tree specific to fullstack changes:
- Frontend vs backend vs shared code
- API routes vs server components vs client components
- Server-side rendering vs client-side
- Database vs frontend state
- tRPC/GraphQL API changes

## Scope Selection Pattern

**TODO:** Define fullstack-specific scopes:

### Next.js App Directory Structure
- app/ → Which scope?
- app/api/ → api? backend?
- components/ → Which scope?
- lib/ → Which scope?
- server/ → Which scope?

### T3 Stack Structure
- src/pages/ → ?
- src/server/ → ?
- src/components/ → ?
- prisma/ → ?

## Common Fullstack Anti-patterns

**TODO:** Document fullstack-specific anti-patterns:
- Server vs client component confusion
- API routes vs server actions
- Shared code (frontend + backend in same commit?)
- Database schema + frontend changes

## Example Commit Messages

**TODO:** Add fullstack-specific examples:
- API route creation
- Server component development
- Client component with API integration
- tRPC procedure additions
- Database schema + frontend changes
- Server actions

## Notes

This guide needs to be developed. For now, refer to the project's `.claude/config/conventional-commits.yaml` for scope definitions.

If you're implementing this guide, consider:
- How to handle server vs client components
- API routes vs server actions
- tRPC/GraphQL schema changes
- Database migrations with frontend changes
- Shared utilities between frontend and backend
- SSR vs CSR changes