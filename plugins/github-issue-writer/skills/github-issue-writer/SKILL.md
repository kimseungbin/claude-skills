---
name: github-issue-writer
description: Write structured GitHub issues (incidents, deployments, features)
allowed-tools: Read, Glob
---

# GitHub Issue Writer

Write well-structured GitHub issues for incidents, deployment issues, or feature planning.

## Workflow

1. Check `.github/ISSUE_TEMPLATE/` for matching templates (Glob)
2. If found, read and follow the GitHub template structure
3. If not, check `.claude/config/github-issue-writer.yaml`
4. Generate issue using template or built-in sections below

## Issue Types

| Type | Use Case | Title Prefix |
|------|----------|--------------|
| Incident | Runtime issues, outages | `[Incident]` |
| Deployment Issue | CI/CD, deployment failures | `[Deployment]` |
| Feature | Planned features, backlog | `[Feature]` |
| Refactoring | Tech debt, code cleanup | `[Refactor]` |

## Formatting

- Use `> [!WARNING]`, `> [!TIP]`, `> [!IMPORTANT]` callouts
- Use mermaid flowcharts for timelines and dependencies
- Use `<details>` for technical deep-dives
- Use tables for comparisons