---
name: github-sub-issues
description: Create GitHub issues and manage sub-issue relationships
allowed-tools: Read, Glob, Bash, AskUserQuestion
---

# GitHub Sub-Issues

Create GitHub issues and establish parent-child relationships using GitHub's native sub-issues API.

## Workflow

1. **Ask user** for issue details and parent (if applicable) using AskUserQuestion
2. **Create issue** via `gh issue create`
3. **Get node IDs** for parent and child issues
4. **Link as sub-issue** via GraphQL mutation with `GraphQL-Features: sub_issues` header
5. **Output** issue URL and hierarchy visualization

## Commands

```bash
# Create issue
gh issue create --title "<title>" --body "<body>" --label "<labels>"

# Get node ID
gh issue view <number> --json id -q '.id'

# Link sub-issue
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
mutation { addSubIssue(input: {issueId: "<parent_id>", subIssueId: "<child_id>"}) { subIssue { number } } }'
```

## Validation

Before linking, check:
- Parent exists: `gh issue view <num> --json state`
- Sub-issue count < 100
- Nesting depth < 8
- Child has no existing parent (or ask to reassign)

See `samples/graphql/` for validation query examples.

## Constraints

| Limit | Value |
|-------|-------|
| Sub-issues per parent | 100 |
| Nesting depth | 8 levels |
| Parents per issue | 1 |

## Output Format

```
Created #50 as sub-issue of #42
https://github.com/owner/repo/issues/50
```