# Sub-Issues GraphQL Queries

Sample queries for GitHub sub-issues API. All queries require the header:
```
GraphQL-Features: sub_issues
```

## Add Sub-Issue

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
mutation($parentId: ID!, $childId: ID!) {
  addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
    issue { title number }
    subIssue { title number }
  }
}' -f parentId="<PARENT_NODE_ID>" -f childId="<CHILD_NODE_ID>"
```

## Remove Sub-Issue

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
mutation($parentId: ID!, $childId: ID!) {
  removeSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
    issue { title }
    subIssue { title }
  }
}' -f parentId="<PARENT_NODE_ID>" -f childId="<CHILD_NODE_ID>"
```

## Check Sub-Issue Count

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      title
      subIssues { totalCount }
    }
  }
}' -f owner="OWNER" -f repo="REPO" -F number=123
```

## Check Nesting Depth

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      parentIssue {
        number
        parentIssue {
          number
          parentIssue {
            number
            parentIssue {
              number
              parentIssue {
                number
                parentIssue {
                  number
                  parentIssue { number }
                }
              }
            }
          }
        }
      }
    }
  }
}' -f owner="OWNER" -f repo="REPO" -F number=123
```

## Check Existing Parent

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      parentIssue { number title }
    }
  }
}' -f owner="OWNER" -f repo="REPO" -F number=123
```

## List Sub-Issues

```bash
gh api graphql -H "GraphQL-Features: sub_issues" -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      title
      subIssues(first: 100) {
        totalCount
        nodes {
          number
          title
          state
        }
      }
    }
  }
}' -f owner="OWNER" -f repo="REPO" -F number=123
```

## Get Node ID from Issue Number

```bash
gh issue view <number> --json id -q '.id'
```