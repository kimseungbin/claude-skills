---
implementation: frontend
project_types:
  - React
  - Vue
  - Angular
  - Svelte
  - Next.js (app directory)
status: skeleton
---

# Frontend Commit Guide

**Status: Skeleton - needs development**

Commit patterns for frontend projects.

## Type Decision Tree

```
Code Change Made
│
├─ Adds NEW UI feature?
│  └─ YES → feat(scope)
│      ✅ New component, page, feature
│
├─ Fixes UI bug?
│  └─ YES → fix(scope)
│      ✅ Broken layout, incorrect behavior
│
├─ Changes component structure?
│  └─ YES → refactor(scope)
│      ✅ Extract component, reorganize
│
├─ Styling only?
│  └─ Consider: style(scope) or refactor(scope)
│
└─ Tests only?
   └─ YES → test(scope)
```

## Scope Patterns (TODO)

### Monorepo
```
packages/web/      → web
packages/mobile/   → mobile
packages/shared/   → shared
```

### Single-Repo
```
src/components/ → components
src/hooks/      → hooks
src/pages/      → pages
src/utils/      → utils
```

## Examples (TODO)

```
feat(components): Add user profile card
fix(hooks): Correct useAuth state management
refactor(pages): Extract common layout wrapper
```

## Notes

This guide needs development. Consider:
- Component hierarchy (atoms/molecules/organisms)
- Styling approach (CSS modules, Tailwind, etc.)
- State management patterns
- Routing changes