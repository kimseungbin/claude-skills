---
name: setup-issue-templates
description: Interactive setup for GitHub issue templates
allowed-tools: Read, Glob, Write, Bash
---

# Setup Issue Templates

Interactively configure and create GitHub issue templates for a project.

## Workflow

1. Check if `.github/ISSUE_TEMPLATE/` already exists
2. Ask which issue types are needed (incident, deployment, feature)
3. For each selected type, ask about customization:
   - Labels to apply
   - Metadata fields (priority, severity, effort, etc.)
   - Additional sections
4. Generate customized templates in `.github/ISSUE_TEMPLATE/`

## Questions to Ask

### Issue Types
- Which types: Incident, Deployment Issue, Feature (multi-select)

### Per-Type Customization
- **Labels:** Default labels for this issue type
- **Metadata:** Which fields to include (date, environment, priority, effort)
- **Sections:** Any project-specific sections to add

## Template Structure

Create in `.github/ISSUE_TEMPLATE/`:
- `incident.md` - Runtime issues
- `deployment-issue.md` - CI/CD failures
- `feature.md` - Feature planning

Include Claude instructions as HTML comments in each template.