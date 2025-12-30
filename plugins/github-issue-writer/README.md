# GitHub Issue Writer

Write structured GitHub issues with mermaid diagrams and callouts.

## Usage

```
Skill(github-issue-writer)        # Write an issue
Skill(setup-issue-templates)      # Setup templates for your project
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

- Mermaid diagrams for visualizing flows
- GitHub callouts (`[!WARNING]`, `[!TIP]`, `[!IMPORTANT]`)
- Collapsible `<details>` for technical deep-dives

## Template Priority

1. `.github/ISSUE_TEMPLATE/` - Uses existing GitHub templates if found
2. `.claude/config/github-issue-writer.yaml` - Plugin config
3. Built-in sections - Default structure

## Configuration

Create `.claude/config/github-issue-writer.yaml`:

```yaml
labels: [incident, retrospective]
metadata: [date, environment, status, severity]
mermaid_diagrams: true
github_callouts: true
title_format: "{component} - {brief_description}"
```

See `samples/` for complete examples.

## Authors

- kimseungbin