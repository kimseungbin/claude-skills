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

## Do NOT Add Redundant References

When creating parent-sub issue relationships, **do NOT** include relationship references in issue bodies:

| Location | What NOT to add | Reason |
|----------|-----------------|--------|
| Parent issue body | "Sub-Issues" section/table listing child issues | GitHub UI natively displays sub-issues |
| Sub-issue body | "Parent: #XXX" line | GitHub UI natively displays parent relationship |

**Rationale:** GitHub's native sub-issues feature (via GraphQL `addSubIssue` mutation) renders these relationships in the issue UI. Adding them to issue bodies creates:
- Redundant information that becomes stale
- Manual maintenance burden when relationships change
- Inconsistency between body text and actual relationships

**Correct approach:**
1. Create issues with their content only (no relationship references)
2. Link them via the GraphQL API
3. Let GitHub's UI handle relationship display

## Output Format

```
Created #50 as sub-issue of #42
https://github.com/owner/repo/issues/50
```