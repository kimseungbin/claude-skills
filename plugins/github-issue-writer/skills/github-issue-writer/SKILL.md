---
name: github-issue-writer
description: Write structured GitHub issues (incidents, deployments, features)
allowed-tools: Read, Glob, AskUserQuestion
---

# GitHub Issue Writer

Write well-structured GitHub issues for incidents, deployment issues, or feature planning.

## Workflow

1. Check `.github/ISSUE_TEMPLATE/` for templates (Glob)
2. If not found, prompt user to run `Skill(setup-issue-templates)` first
3. **Use AskUserQuestion** to ask issue type:
   - Incident: Runtime issues, outages
   - Deployment Issue: CI/CD, deployment failures
   - Feature: Planned features, backlog
   - Refactoring: Tech debt, code cleanup
   - Fix: Bug fixes
4. Read and follow the matching template structure
5. **Use AskUserQuestion** to ask priority (recommend based on context):
   - P0: Critical, immediate action required
   - P1: High, address soon
   - P2: Medium, normal priority (default)
   - P3: Low, when time permits
6. **Use AskUserQuestion** to ask about issue hierarchy:
   - Standalone: No parent or sub-issues
   - Has parent: Link as sub-issue of existing issue
   - Needs sub-issues: Plan to break down into child issues
7. Add priority label (e.g., `priority-p2`) to issue
8. Generate issue following template
9. If hierarchy selected, invoke `Skill(github-sub-issues)` to manage relationships

## Issue Types

| Type | Use Case |
|------|----------|
| Incident | Runtime issues, outages |
| Deployment Issue | CI/CD, deployment failures |
| Feature | Planned features, backlog |
| Refactoring | Tech debt, code cleanup |
| Fix | Bug fixes |

## Formatting

- Use `> [!WARNING]`, `> [!TIP]`, `> [!IMPORTANT]` callouts
- Use mermaid flowcharts for timelines and dependencies
- Use `<details>` for technical deep-dives
- Use tables for comparisons