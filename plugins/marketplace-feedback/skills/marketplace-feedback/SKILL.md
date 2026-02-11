---
name: marketplace-feedback
description: Submit bug reports and feature requests to the claude-skills marketplace repository
allowed-tools:
  - Bash
  - Read
  - Glob
  - AskUserQuestion
---

# Marketplace Feedback

Submit bug reports and feature requests for plugins in the claude-skills marketplace. Issues are filed directly on the upstream repository with auto-detected plugin context and structured labels.

**Target repository:** `kimseungbin/claude-skills`

## Workflow

### Step 1: Auto-Detect Related Plugin

Determine which plugin the feedback is about.

1. Check the current conversation for recent `Skill(...)` invocations (excluding `marketplace-feedback` itself). The most recently invoked skill is the likely candidate.
2. If a candidate is found, **use AskUserQuestion** to confirm:
   - "It looks like this is about **{plugin-name}**. Is that correct?"
   - Options: Yes (Recommended), No — let me choose
3. If no candidate found, or user says no:
   - Read `${CLAUDE_PLUGIN_ROOT}/../../marketplace.json` to get the list of all available plugins
   - **Use AskUserQuestion** to let user pick from the plugin list
4. Once the plugin is identified, read its `plugin.json` to get the version number:
   - Path: `${CLAUDE_PLUGIN_ROOT}/../../plugins/{plugin-name}/.claude-plugin/plugin.json`

Store the **plugin name** and **plugin version** for later use.

### Step 2: Ask Issue Type

**Use AskUserQuestion:**
- **Bug Report** (Recommended) — Something isn't working as expected
- **Feature Request** — Suggest an improvement or new capability

### Step 3: Gather Details

All details are gathered via **AskUserQuestion** with free-text responses.

**For Bug Reports**, ask sequentially:

1. **Title**: "Briefly describe the bug (this becomes the issue title)"
2. **Description**: "What happened? What did you expect to happen instead?"
3. **Reproduction steps**: "How can we reproduce this? Describe step by step."
4. **Priority** (use AskUserQuestion with options):
   - P2: Minor issue (Recommended)
   - P0: Blocks usage entirely
   - P1: Significant issue, workaround exists
   - P3: Cosmetic / low impact

**For Feature Requests**, ask sequentially:

1. **Title**: "Briefly describe the feature (this becomes the issue title)"
2. **Use case**: "What problem does this solve? Why do you need it?"
3. **Proposed solution**: "How would you like this to work? (Skip if unsure)"
4. **Priority** (use AskUserQuestion with options):
   - P2: Normal priority (Recommended)
   - P1: High value, needed soon
   - P3: Nice to have

### Step 4: Collect Environment Info (Bug Reports Only)

Auto-detect using Bash:

```bash
# Operating system
uname -s -r

# Plugin version (already retrieved in Step 1)
```

### Step 5: Compose & Create Issue

1. Read the appropriate template:
   - Bug report: `${CLAUDE_PLUGIN_ROOT}/samples/issue-bodies/bug-report.md`
   - Feature request: `${CLAUDE_PLUGIN_ROOT}/samples/issue-bodies/feature-request.md`

2. Fill the template placeholders with gathered data.

3. Ensure labels exist (idempotent — safe to run every time):

```bash
# Type label
gh label create "type:bug" --color "d73a49" --description "Bug report" --force -R kimseungbin/claude-skills
# OR
gh label create "type:feature" --color "0e8a16" --description "Feature request" --force -R kimseungbin/claude-skills

# Plugin label
gh label create "plugin:{plugin-name}" --color "0075ca" --description "Related to {plugin-name}" --force -R kimseungbin/claude-skills

# Priority label
gh label create "priority:{p0-p3}" --color "{color}" --description "{description}" --force -R kimseungbin/claude-skills

# Source label
gh label create "marketplace-feedback" --color "7057ff" --description "Submitted via marketplace-feedback plugin" --force -R kimseungbin/claude-skills
```

Priority label colors:
- `priority:p0` → `b60205` (dark red) — "Blocks usage entirely"
- `priority:p1` → `d93f0b` (orange) — "Significant issue"
- `priority:p2` → `fbca04` (yellow) — "Normal priority"
- `priority:p3` → `c5def5` (light blue) — "Low impact"

4. Create the issue:

```bash
gh issue create \
  -R kimseungbin/claude-skills \
  --title "[{plugin-name}] {user-title}" \
  --body "{composed-body}" \
  --label "type:{bug|feature},plugin:{plugin-name},priority:{p0-p3},marketplace-feedback"
```

### Step 6: Output

Display the result clearly:

```
Issue created successfully!

  #{number}: [{plugin-name}] {title}
  {issue-url}

  Labels: type:{type}, plugin:{name}, priority:{level}, marketplace-feedback
```