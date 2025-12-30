---
name: Refactoring
about: Document code refactoring or technical debt cleanup
title: ""
labels: refactoring, tech-debt
assignees: ""
---

<!--
INSTRUCTIONS FOR CLAUDE CODE:
- Fill all sections based on user's description
- Use mermaid diagrams for before/after architecture
- Add [!WARNING] for breaking changes, [!IMPORTANT] for migration steps
- Include code examples showing before/after patterns
- Be specific about files and components affected
-->

**Date:** YYYY-MM-DD
**Priority:** P0 / P1 / P2 / P3
**Effort:** S / M / L / XL
**Breaking Change:** Yes / No

## Summary

<!-- 2-3 sentences describing what needs refactoring and why -->

## Current State

<!--
What's wrong with the current implementation?
- Code smells or anti-patterns
- Performance issues
- Maintainability concerns
-->

## Proposed Changes

<!--
What will change?
- Include mermaid diagram for architectural changes
- List affected files/components
- Show before/after code patterns if helpful
-->

## Migration Plan

<!--
How to safely migrate:
- Step-by-step approach
- Backward compatibility considerations
- Rollback strategy if needed
-->

## Acceptance Criteria

<!-- Definition of done -->

- [ ] All tests pass
- [ ] No breaking changes (or documented migration path)
- [ ] Code review approved

## Related Documentation

<!-- Links to relevant docs, ADRs, or related refactoring issues -->