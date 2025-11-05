---
name: Git Strategy
description: Manage git workflow for environment-based infrastructure deployments with rollback capabilities. Use when user needs help with branching, promotion, rollback, or emergency procedures.
---

# Git Strategy

This skill provides guidance on git workflow for infrastructure-as-code projects using environment-based branching, with comprehensive rollback and emergency procedures.

## Instructions

When the user requests help with git operations, branching strategy, promotions, rollbacks, or deployment workflow:

1. **Read the project's git strategy configuration**:
    - **First**, check if `.claude/config/git-strategy.md` exists (project-specific workflow)
    - **If not found**, provide generic git workflow advice
    - Parse the configuration including: branch structure, promotion rules, deployment triggers, and emergency procedures
    - Project-specific configuration takes precedence

2. **Understand the context of the request**:
    - Is this a normal development workflow question?
    - Is this an emergency (production broken, urgent rollback needed)?
    - Is this a promotion/release question?
    - Is this about understanding the workflow?
    - Run `git status` and `git branch -a` to understand current state if needed

3. **Provide appropriate guidance based on the request type**:

### Daily Development Workflow
- Guide user through normal master development
- Explain when and how to promote to staging
- Show how to create PRs for promotion
- Reference project-specific cadence (daily, weekly, per N commits)

### Production Promotion
- Show how to promote from staging to production
- Explain selective vs. full merge strategies
- Guide through release tagging
- Reference project-specific promotion rules (PR vs local merge)

### Rollback & Recovery
- Assess the severity of the issue
- Guide through appropriate rollback strategy:
  - `git revert` for safe rollbacks (preserves history)
  - `git reset` for emergency situations (rewrites history)
  - Merge commit reversion with `-m 1` flag
- Explain follow-up actions (investigation, fix, re-deploy)

### Emergency Procedures
- Provide step-by-step emergency checklist
- Guide through hotfix branch workflow
- Explain backporting hotfixes to all branches
- Monitor deployment status

### Branch Investigation
- Show what commits are pending promotion
- Compare branches to understand divergence
- Identify merge commits vs. regular commits
- Help find specific commits in history

4. **Execute git commands when appropriate**:
    - Use Bash tool to run git commands
    - Show output and explain what it means
    - Chain commands together when safe to do so
    - For destructive operations (reset, force push), always warn first

5. **Explain project-specific constraints**:
    - Why no feature branches (infrastructure constraints)
    - Auto-deployment triggers
    - Environment mapping (master=DEV, staging=STAGING, prod=PRODUCTION)
    - Commit message conventions

6. **Provide context-aware recommendations**:
    - Suggest appropriate promotion cadence based on commit frequency
    - Recommend when to split vs. combine releases
    - Advise on risk management for production promotions
    - Guide post-deployment validation

## Example Workflows

### Normal Development Flow

```
User: "I've made 3 commits on master, should I promote to staging now?"

1. Read .claude/config/git-strategy.md
2. Check current state: git log staging..master --oneline
3. Review the 3 commits
4. Recommend: Yes, promote now (follows "every 2-3 commits" rule)
5. Guide through PR creation: master → staging
6. Explain: Wait for STAGING deployment, validate changes
```

### Emergency Rollback

```
User: "Production is broken after the last deployment, how do I rollback?"

1. Read .claude/config/git-strategy.md
2. Assess severity: Production outage = CRITICAL
3. Check recent deployments: git log prod --oneline --merges -5
4. Guide through immediate rollback:
   - git checkout prod
   - git revert -m 1 <bad-merge-commit>
   - git push origin prod
5. Explain: Monitor CodePipeline for rollback deployment
6. Follow-up: Investigate root cause, fix on master, re-promote
```

### Selective Production Promotion

```
User: "I have 3 releases in staging but only want to promote 2 to prod"

1. Read .claude/config/git-strategy.md
2. Confirm workflow supports selective promotion (local merge)
3. Show available releases: git log prod..staging --oneline --merges
4. Guide through selective merge:
   - git checkout prod
   - git merge <specific-merge-commit-1> --no-ff
   - git push origin prod
   - Wait for validation
   - git merge <specific-merge-commit-2> --no-ff
   - git push origin prod
5. Explain benefits: Test each release independently in production
```

### Hotfix Emergency

```
User: "Critical security vulnerability discovered in production"

1. Read .claude/config/git-strategy.md
2. Assess: Security vulnerability = Use hotfix workflow
3. Guide through hotfix branch:
   - Create from prod: git checkout -b hotfix/security-cve-2024-xxxx
   - Make fix, commit with clear message
   - Deploy to prod IMMEDIATELY: git checkout prod && git merge hotfix/...
   - Push to trigger deployment
4. Guide through backporting:
   - Merge to staging
   - Merge to master
   - Delete hotfix branch
5. Verify fix deployed to all environments
```

## Project Configuration Location

⚠️ **CRITICAL: Configuration File Management** ⚠️

This skill is a **git submodule** shared across multiple projects.

**Priority order:**

1. **Project-specific configuration** (PRIMARY): `.claude/config/git-strategy.md` (checked first)
2. **Generic guidance** (FALLBACK): Provide generic git workflow advice

**Configuration Pattern:**

- `.claude/skills/git-strategy/` → Symlink to submodule (READ-ONLY, shared across projects)
- `.claude/config/git-strategy.md` → Real file in project repo (WRITABLE, project-specific)

**When user requests to document git workflow:**

1. Check if `.claude/config/git-strategy.md` exists
2. If NOT exists, help create it based on project needs
3. If EXISTS, update it with new information
4. Store comprehensive documentation in project root (e.g., `GIT_STRATEGY.md`)
5. Keep config file as a pointer/summary to main documentation

**Configuration Should Include:**

- Branch structure (which branches map to which environments)
- Promotion rules (PR vs. local merge, frequency)
- Deployment triggers (auto-deploy on push?)
- Emergency procedures (rollback commands, hotfix workflow)
- Commit conventions (reference to conventional commits)
- Project constraints (why no feature branches, infrastructure limitations)
- Pre-deployment checklists

## Git Command Safety

When executing git commands through this skill:

### Safe Commands (Execute Immediately)
- `git status`, `git branch`, `git log`
- `git fetch`, `git pull`
- `git diff`, `git show`
- `git reflog`
- `git commit` (reversible with reset)
- `git push` (after user confirmation for production branches)
- `git revert` (safe, preserves history)

### Dangerous Commands (Warn First)
- `git reset --hard` (data loss possible)
- `git push --force` or `--force-with-lease` (rewrites remote history)
- `git branch -D` (deletes branches)
- `git clean -fd` (deletes untracked files)

### Never Execute Without Explicit User Approval
- Force pushing to production branches
- Deleting remote branches
- Resetting shared branches
- Any command that rewrites public history

## Integration with Other Skills

This skill works well with:

- **conventional-commits**: Ensure commits follow project conventions before promotion
- **pull-request-management**: Guide PR creation for promotions
- **cdk-expert**: Understand infrastructure implications of deployments

## Notes

- Always check current git state before providing guidance
- Tailor advice to project-specific workflow (read the config!)
- For emergencies, provide step-by-step instructions with clear commands
- Explain the "why" behind git operations, not just the "how"
- After rollbacks, always guide through root cause investigation and fix
- Remind users about deployment monitoring after push operations
- For infrastructure projects, emphasize the constraints (one state per environment)
