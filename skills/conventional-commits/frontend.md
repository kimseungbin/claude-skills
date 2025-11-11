---
implementation: frontend
project_types:
  - React
  - Vue
  - Angular
  - Svelte
  - Next.js (app directory)
  - Frontend applications
applicable_to:
  - Monorepo frontend projects
  - Single-repo frontend projects
status: TODO
---

# Frontend Commit Guide

**Status: 🚧 TODO - Skeleton only**

This guide will provide commit message patterns for frontend projects using React, Vue, Angular, Svelte, or other frontend frameworks.

## Type Selection Decision Tree

**TODO:** Create decision tree specific to frontend changes:
- UI components vs state management vs routing
- Styling vs logic vs tests
- Feature development vs bug fixes
- Accessibility improvements
- Performance optimizations

## Scope Selection Pattern

**TODO:** Define frontend-specific scopes:

### Monorepo Projects
- components/ → Which scope?
- hooks/ → Which scope?
- utils/ → Which scope?
- state/ → Which scope?
- pages/ → Which scope?

### Single-Repo Projects
- src/components/ → ?
- src/hooks/ → ?
- public/ → ?

## Common Frontend Anti-patterns

**TODO:** Document frontend-specific anti-patterns:
- Component vs container confusion
- Styling changes (style vs refactor?)
- Test-only commits vs feature commits with tests

## Example Commit Messages

**TODO:** Add frontend-specific examples:
- Component creation
- Hook development
- State management changes
- Routing changes
- Styling updates
- Accessibility fixes

## Notes

This guide needs to be developed. For now, refer to the project's `.claude/config/conventional-commits.yaml` for scope definitions.

If you're implementing this guide, consider:
- How to handle component hierarchy (atoms/molecules/organisms)
- Styling changes (CSS modules, styled-components, Tailwind)
- State management (Redux, Zustand, Context, etc.)
- Routing changes (React Router, Next.js routing)
- UI library integration (MUI, Ant Design, Shadcn)