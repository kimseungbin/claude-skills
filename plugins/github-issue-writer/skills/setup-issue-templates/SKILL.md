---
name: setup-issue-templates
description: Interactive setup for GitHub issue templates
allowed-tools: Read, Glob, Write, Bash, AskUserQuestion
---

# Setup Issue Templates

Interactively configure and create GitHub issue templates for a project.

## Workflow

1. Check if `.github/ISSUE_TEMPLATE/` already exists using Glob
2. **Use AskUserQuestion tool** to ask which issue types are needed:
   - Incident (runtime issues)
   - Deployment Issue (CI/CD failures)
   - Feature (planned features)
   - Refactoring (tech debt)
   - Fix (bug fixes)
3. **Use AskUserQuestion tool** for each selected type to customize:
   - Labels to apply
   - Metadata fields
4. Create `.github/ISSUE_TEMPLATE/` directory if needed
5. Generate customized templates with Claude instructions as HTML comments

## Important

You MUST use the `AskUserQuestion` tool for interactive questions. Do NOT just describe what to do - actually ask the user using the tool.

## Template Files

| Type | Filename |
|------|----------|
| Incident | `incident.md` |
| Deployment Issue | `deployment-issue.md` |
| Feature | `feature.md` |
| Refactoring | `refactoring.md` |
| Fix | `fix.md` |
