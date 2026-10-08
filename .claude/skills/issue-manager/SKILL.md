---
name: issue-manager
description: Review and analyze open issues on kimseungbin/claude-skills
allowed-tools:
  - Bash
  - Glob
  - Grep
  - Read
  - ToolSearch
  - AskUserQuestion
---

# Issue Manager

Review open issues filed on `kimseungbin/claude-skills`, whether submitted through the `marketplace-feedback` plugin or created directly. This skill reads issues and analyzes them; it leaves labels and issue state untouched.

**Target repository:** `kimseungbin/claude-skills`

## Pre-loaded Context

### Open Issues
!`gh issue list -R kimseungbin/claude-skills --state open --json number,title,labels,createdAt,url --limit 100 | jq -r 'def get_label(prefix): [.labels[].name | select(startswith(prefix)) | ltrimstr(prefix)] | first // "—"; def priority_rank: get_label("priority:") | if . == "—" then 9 else ltrimstr("p") | tonumber end; def clean_title: .title | gsub("^\\[[^]]*\\] "; ""); if length == 0 then "(none)" else "| # | Type | Plugin | Priority | Title | Created |\n|---|------|--------|----------|-------|---------|\n" + (sort_by([priority_rank, .createdAt]) | map("| #\(.number) | \(get_label("type:") | if . == "bug" then "Bug" elif . == "feature" then "Feature" else . end) | \(get_label("plugin:")) | \(get_label("priority:") | if . != "—" then ascii_upcase else . end) | \(clean_title) | \(.createdAt[:10]) |") | join("\n")) end'`

## Workflow

### Step 1: Display Issues

Display the pre-loaded issue table above to the user as-is. It is sorted by priority (P0 first, unprioritized last), then by creation date.

### Step 2: Pick an Issue

Use **AskUserQuestion** to ask which issue to look at. Offer the top three issues from the table as options, plus **Done**. The user can enter any other issue number through the free-text option.

If the user picks an issue, proceed to Step 3. If the user picks **Done**, stop.

### Step 3: Analyze the Issue

Fetch the full issue:

```bash
gh issue view {number} -R kimseungbin/claude-skills --json number,title,body,labels,createdAt,url
```

Then present:

1. **Summary**: `#{number}: {title}` with Type / Plugin / Priority from labels
2. **Issue body**: The full description
3. **Analysis**:
   - Is the report clear and actionable?
   - If it references specific files or code, do those exist in the repo? (verify with Glob/Grep)
   - Is it a duplicate of, or closely related to, another open issue?
   - For bugs: is the reproduction path plausible?
   - For features: does it align with the project's direction?
   - Your assessment: ready to work on, needs more information, or a candidate for closing — with the reason

Return to Step 2.
