---
name: github-issue-writer
description: Write structured GitHub issues (incidents, deployments, features)
allowed-tools: Read, Glob, AskUserQuestion
---

# GitHub Issue Writer

Write well-structured GitHub issues for incidents, deployment issues, or feature planning.

## Workflow

1. Check `.github/ISSUE_TEMPLATE/` for matching templates (Glob)
2. If found, read and follow the GitHub template structure
3. If not, check `.claude/config/github-issue-writer.yaml`
4. **Use AskUserQuestion** to ask priority (recommend based on context):
   - P0: Critical, immediate action required
   - P1: High, address soon
   - P2: Medium, normal priority (default)
   - P3: Low, when time permits
5. Add priority label (e.g., `priority-p2`) to issue
6. Generate issue using template or built-in sections

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