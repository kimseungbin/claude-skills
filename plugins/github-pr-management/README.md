# GitHub PR Management

Create and manage GitHub pull requests with interactive content selection, template compliance, and deployment impact analysis.

## Getting Started

```
Skill(pull-request-management)    # Create a PR with interactive title selection
```

## Features

- **Interactive PR Content Selection**: Choose PR title and type via `AskUserQuestion`
- **Template Compliance**: Reads and follows project-specific PR templates
- **Deployment Impact Analysis**: For IaC projects, analyze and categorize impact levels
- **Remote Branch Comparison**: Always compares remote branches for accurate PR analysis
- **Confidence-Based Decision Making**: Asks user when uncertain, suggests template improvements

## Workflow

1. Locate and read the project's PR template
2. Analyze changes (commits, diffs) using remote branches
3. Present title options for user selection
4. Ask about change type and deployment impact (if applicable)
5. Fill out PR template sections
6. Create PR via `gh pr create`

## Sample Templates

See `samples/` for example PR templates:

- `pr-template-iac-example.md` - Full IaC/CDK PR template with deployment impact guide

## Related Plugins

- [github-issue-writer](../github-issue-writer/) - Write structured GitHub issues with sub-issue support

## Authors

- kimseungbin