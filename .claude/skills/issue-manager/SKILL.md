---
name: issue-manager
description: Manage and triage marketplace feedback issues on kimseungbin/claude-skills
allowed-tools:
  - Bash
  - Glob
  - Grep
  - Read
  - AskUserQuestion
---

# Issue Manager

Manage marketplace feedback issues filed on `kimseungbin/claude-skills`.

**Target repository:** `kimseungbin/claude-skills`

## Status Labels

Issues are tracked with status labels:

- No `status:*` label → **Unattended** (new, not yet reviewed)
- `status:triaged` → Reviewed and categorized, awaiting action
- `status:in-progress` → Actively being worked on

## Pre-loaded Context

### Open Issues
!`gh issue list -R kimseungbin/claude-skills --label "marketplace-feedback" --state open --json number,title,labels,createdAt,url --limit 50 | jq -r 'def get_label(prefix): [.labels[].name | select(startswith(prefix)) | ltrimstr(prefix)] | first // "—"; def has_status: [.labels[].name | select(startswith("status:"))] | length > 0; def clean_title: .title | gsub("^\\[[^]]*\\] "; ""); def unattended_rows: [.[] | select(has_status | not)]; def attended_rows: [.[] | select(has_status)]; "#### Unattended\n" + (if (unattended_rows | length) == 0 then "\n(none)" else "\n| # | Type | Plugin | Priority | Title | Created |\n|---|------|--------|----------|-------|---------|\n" + (unattended_rows | map("| #\(.number) | \(get_label("type:") | if . == "bug" then "Bug" elif . == "feature" then "Feature" else . end) | \(get_label("plugin:")) | \(get_label("priority:") | if . != "—" then (. | ascii_upcase) else . end) | \(clean_title) | \(.createdAt[:10]) |") | join("\n")) end) + "\n\n#### Attended\n" + (if (attended_rows | length) == 0 then "\n(none)" else "\n| # | Status | Type | Plugin | Priority | Title | Created |\n|---|--------|------|--------|----------|-------|---------|\n" + (attended_rows | map("| #\(.number) | \(get_label("status:")) | \(get_label("type:") | if . == "bug" then "Bug" elif . == "feature" then "Feature" else . end) | \(get_label("plugin:")) | \(get_label("priority:") | if . != "—" then (. | ascii_upcase) else . end) | \(clean_title) | \(.createdAt[:10]) |") | join("\n")) end)'`

## Workflow

### Step 1: Display Issues

Display the pre-loaded issue tables above to the user as-is.

### Step 2: Ask Next Action

After displaying the tables, use **AskUserQuestion** to ask what to do next:

Options depend on the current state:

- **Review unattended issues** — Go through unattended issues one by one for triage (only show if unattended issues exist)
- **Pick a specific issue** — Enter an issue number to focus on
- **Done** — Exit the skill

If the user picks "Review unattended issues", proceed to Step 3.
If the user picks a specific issue number, proceed to Step 3 with that issue.
If the user picks "Done", proceed to Step 4.

### Step 3: Triage Issue

For each issue to triage (sequentially if reviewing all unattended, or just the selected one):

**3a. Fetch and Analyze Issue**

Fetch the full issue using Bash:

```bash
gh issue view {number} -R kimseungbin/claude-skills --json number,title,body,labels,createdAt,url
```

Then analyze the issue and present:

1. **Summary**: `#{number}: {title}` with Type / Plugin / Priority from labels
2. **Issue body**: The full description
3. **Analysis**: Your assessment of the issue:
   - Is the report clear and actionable?
   - If it references specific files/code, do those exist in the repo? (use Glob/Grep to verify)
   - Is it a duplicate of another open issue?
   - For bugs: is the reproduction path plausible?
   - For features: does it align with the project's direction?
   - Your recommendation: triage, not planned, or needs more info

**3b. Ask for Triage Action**

Use **AskUserQuestion**:

- **Triaged** — Valid issue, acknowledged and will address later (`status:triaged`)
- **Not Planned** — Won't fix, out of scope, or duplicate. Close the issue.
- **Skip** — Leave unattended for now, move to next issue

**3c. Assign Priority (Triaged only)**

If the user selected Triaged, check if the issue already has a `priority:*` label. If not, use **AskUserQuestion** to assign one:

- **P0** — Blocks usage entirely
- **P1** — Significant issue, high value
- **P2** — Normal priority (Recommended)
- **P3** — Low impact / nice to have

Apply the selected priority label:

```bash
gh issue edit {number} -R kimseungbin/claude-skills --add-label "priority:{p0-p3}"
```

If the issue already has a priority label, skip this step.

**3d. Apply Action**

- **Triaged**: Add label and confirm.
  ```bash
  gh issue edit {number} -R kimseungbin/claude-skills --add-label "status:triaged"
  ```
  Confirm: `✓ #{number} marked as triaged (P{x})`

- **Not Planned**: Close the issue with reason.
  ```bash
  gh issue close {number} -R kimseungbin/claude-skills --reason "not planned"
  ```
  Confirm: `✓ #{number} closed as not planned`

**3e. Next Issue**

If reviewing multiple issues, move to the next unattended issue and repeat from 3a. After the last issue (or if the user picked a specific issue), display a triage summary and return to Step 2.

### Step 4: Terminate

Display a final summary of all actions taken in this session:

```
Session complete:
  ✓ #3 → triaged (P2)
  ✓ #2 → not planned (closed)
  - #1 → skipped
```

Stop. Do not take further action.