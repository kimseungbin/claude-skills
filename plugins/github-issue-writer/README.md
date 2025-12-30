# GitHub Issue Writer

Write structured GitHub issues with mermaid diagrams and callouts.

## Getting Started

```
Skill(setup-issue-templates)      # First: setup templates for your project
Skill(github-issue-writer)        # Then: write issues
```

## Supported Types

| Type | Use Case |
|------|----------|
| Incident | Runtime issues, outages |
| Deployment Issue | CI/CD, deployment failures |
| Feature | Planned features, backlog |
| Refactoring | Tech debt, code cleanup |
| Fix | Bug fixes |

## Features

- Issue templates in `.github/ISSUE_TEMPLATE/`
- Priority selection via labels (`priority-p0` to `priority-p3`)
- Mermaid diagrams for visualizing flows
- GitHub callouts (`[!WARNING]`, `[!TIP]`, `[!IMPORTANT]`)
- Collapsible `<details>` for technical deep-dives

## Authors

- kimseungbin