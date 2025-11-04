---
type: command
name: create-pr
description: Create a pull request using the pull-request-management skill
skill: pull-request-management
---

Invoke the **pull-request-management** skill to create a pull request.

This command will:
1. Read the project's PR template (`.github/pull_request_template.md`)
2. Analyze current changes (`git diff`, `git status`)
3. Fill out the PR template with confidence-based decision making
4. Run pre-flight checks (lint, build, tests)
5. Create the pull request using GitHub CLI
6. Suggest PR template improvements if needed

**Usage:**
```bash
/create-pr
```

**Optional: Specify target branch**
```bash
/create-pr --base staging
/create-pr --base prod
```

The skill will automatically:
- Use high-confidence information to fill template sections
- Explain reasoning for medium-confidence decisions
- Suggest template improvements for low-confidence sections
- Never guess when uncertain - transparency over accuracy