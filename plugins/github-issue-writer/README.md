# GitHub Issue Writer

Write structured GitHub issues with sub-issue support, mermaid diagrams, and callouts.

## Getting Started

```
Skill(setup-issue-templates)      # First: setup templates for your project
Skill(github-issue-writer)        # Then: write issues
Skill(github-sub-issues)          # Optional: create and link sub-issues
```

## Supported Types

| Type | Use Case |
|------|----------|
| Incident | Runtime issues, outages |
| Deployment Issue | CI/CD, deployment failures |
| Feature | Planned features, backlog |
| Refactoring | Tech debt, code cleanup |
| Fix | Bug fixes |

## Sub-Issues

Create hierarchical issues with parent-child relationships:

```
Skill(github-sub-issues)          # Create issue and link as sub-issue
```

See `samples/graphql/` for API query examples.

## Features

- Issue templates in `.github/ISSUE_TEMPLATE/`
- Priority selection via labels (`priority-p0` to `priority-p3`)
- Sub-issues with parent-child linking via GraphQL API
- Mermaid diagrams for visualizing flows
- GitHub callouts (`[!WARNING]`, `[!TIP]`, `[!IMPORTANT]`)
- Collapsible `<details>` for technical deep-dives

## Authors

- kimseungbin