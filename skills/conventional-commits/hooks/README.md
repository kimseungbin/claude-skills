# Git Hooks Integration

This directory contains documentation for git hooks that integrate with the conventional-commits skill.

## Files in This Directory

- **commit-msg.md**: Commit format validation details (enforces `Skill: conventional-commits` footer)
- **pre-push.md**: Deployment safety footers (blocks unsafe infrastructure changes)
- **README.md**: This file - explains the rationale and design philosophy

## Why Git Hooks for Infrastructure?

### The Infrastructure Problem

**Most projects validate on PR/merge via GitHub Actions. Why is infrastructure different?**

Infrastructure projects face unique constraints that make traditional PR-based workflows impractical:

#### 1. Can't Test Multiple Branches Simultaneously

**Application code**:
- Each feature branch deploys to isolated preview environment
- Test independently, merge when ready
- Preview environments are cheap (containers, temporary databases)

**Infrastructure code**:
- Each environment = dedicated AWS account
- Testing feature branch requires spinning up entire AWS account
- Cost prohibitive and management overhead
- Can test different branches, but can't maintain multiple cloud environments per branch

#### 2. Deployment Happens at Push, Not Merge

**Application code workflow**:
```
Push → PR created → CI runs tests → Review → Merge → Deploy
```

**Infrastructure code workflow (this project)**:
```
Push to master → CodePipeline triggered → Immediate DEV deployment
```

**The problem**: Can't wait for merge because merge happens AFTER deployment. By the time you merge PR, DEV is already deployed.

#### 3. PR-Based Workflow Creates Deployment Conflicts

**Multiple PRs scenario**:
- PR #1 opened → Pushes to feature-branch-1 → (if configured) deploys to DEV
- PR #2 opened → Pushes to feature-branch-2 → Tries to deploy to DEV
- **Result**: CloudFormation error - "stack update already in progress"

CloudFormation doesn't support concurrent stack updates to same account.

#### 4. Single Developer = Better DX with Direct Push

For solo infrastructure developer (common in small teams):

**PR workflow overhead**:
- Create PR for every infrastructure change
- Wait for CI to validate
- Self-approve PR (no reviewer)
- Merge PR
- Wait for deployment
- **Problem**: Can't validate deployment success until AFTER merge (chicken-and-egg)

**Direct push workflow**:
- Make changes
- Pre-push hook validates safety
- Push to master
- Immediate deployment feedback
- **Benefit**: Fast iteration, clear state (master = DEV)

### Strategic Choice: Master-Only Development

For this project:
- **Solo developer** managing infrastructure
- **Direct push to master** for better DX
- **No PR overhead** for routine infrastructure changes
- **Master = DEV state** always in sync

**Trade-off**: Need pre-push validation since no PR review checkpoint.

### Why Not GitHub CI?

**GitHub CI runs AFTER push** (too late):
```
Developer → Push → GitHub CI → (CodePipeline already started)
```

**Pre-push hook runs BEFORE push** (safety checkpoint):
```
Developer → Pre-push hook → (block if unsafe) → Push → CodePipeline
```

**Result**: Pre-push hook is the **only** checkpoint for infrastructure safety in master-only workflow.

---

## Design Philosophy

### Two Hooks, Two Purposes

#### commit-msg Hook (Quality)

**Purpose**: Enforce commit format consistency

**What it validates**:
- Conventional Commits format
- Required footer tags (`Skill: conventional-commits`)
- Subject line length

**When it runs**: After `git commit` (before commit is created)

**Benefit**: All commits follow project conventions, readable history

**See**: [commit-msg.md](commit-msg.md)

---

#### pre-push Hook (Safety)

**Purpose**: Prevent dangerous infrastructure deployments

**What it validates**:
- CloudFormation resource replacements
- Fixed-name resource conflicts
- Manual deletion requirements

**When it runs**: Before `git push` (before code reaches deployment trigger)

**Benefit**: Catch incidents before they happen, explicit approval for risky changes

**See**: [pre-push.md](pre-push.md)

---

### How They Work Together

Both hooks use commit footers for validation:

```
refactor(service): Extract ServiceInfraConstruct

Separate build and runtime concerns.

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth

Skill: conventional-commits
```

**commit-msg hook** validates:
- `Skill: conventional-commits` footer present

**pre-push hook** validates:
- `Safe-To-Deploy: manual-deletion-planned` footer present (if resource replacement detected)

**Both can coexist** in same commit.

---

## When to Use Each Hook

### Use commit-msg Hook When

✅ You want to enforce commit format consistency across team
✅ You need audit trail of which commits used the skill
✅ You want to prevent manual `git commit` bypassing skill workflow

**Common use case**: All projects using conventional-commits skill

---

### Use pre-push Hook When

✅ Infrastructure project with direct-push workflow (no PRs)
✅ Deployment triggered immediately on push (CodePipeline, etc.)
✅ Resource replacements require manual intervention
✅ Solo developer or small team managing infrastructure

**Common use case**: CDK/Terraform projects with master-only development

---

## Comparison to Other Projects

### Typical Web Application Project

**Workflow**:
- Feature branch → PR → CI validation → Review → Merge → Deploy
- **Safety**: PR review + CI checks before merge
- **Hooks**: commit-msg only (for format consistency)

**Why this works**: Deployment happens AFTER merge, plenty of checkpoints

---

### This Infrastructure Project

**Workflow**:
- Direct push to master → Immediate deployment
- **Safety**: Pre-push hook validation before push
- **Hooks**: commit-msg + pre-push (format + safety)

**Why this works**: Deployment happens at push, pre-push hook is only checkpoint

---

## Setting Up Hooks

### For New Projects

**Commit format validation only** (typical):
1. Copy `commit-msg.md` implementation
2. Create `.git/hooks/commit-msg`
3. Configure footer requirement in `.claude/config/conventional-commits.yaml`

**Deployment safety + commit validation** (infrastructure):
1. Copy both `commit-msg.md` and `pre-push.md` implementations
2. Create `.git/hooks/commit-msg` and `.githooks/pre-push`
3. Configure git hooks path: `git config core.hooksPath .githooks`
4. Create analysis script: `scripts/analyze-and-approve-deployment.sh`

**See project docs**:
- `docs/GIT_HOOKS_SETUP.md` - Complete setup guide
- `docs/DEPLOYMENT_APPROVAL_WORKFLOW.md` - Workflow guide

---

## FAQ

### Q: Do I need both hooks?

**A**: Depends on your workflow.

- **Commit-msg only**: If you use PR-based workflow with CI validation
- **Both**: If you push directly to deployment branches (infrastructure projects)

### Q: Can I use pre-push hook with PR workflow?

**A**: Yes, but less common. Pre-push adds validation before PR is created. Usually CI validation on PR is sufficient.

### Q: Why not just use CI?

**A**: CI runs AFTER push. For infrastructure with immediate deployment, pre-push hook is the only checkpoint before deployment starts.

### Q: What if I'm not solo developer?

**A**: Pre-push hook still useful if team pushes directly to master. If team uses PR workflow, CI validation may be more appropriate.

### Q: Can I disable hooks temporarily?

**A**: Yes, use `git commit --no-verify` or `git push --no-verify`. Only for emergencies.

---

## Related Documentation

**In this skill**:
- [commit-msg.md](commit-msg.md) - Commit format validation
- [pre-push.md](pre-push.md) - Deployment safety footers
- [../SKILL.md](../SKILL.md) - Main skill instructions
- [../README.md](../README.md) - Skill architecture and LLM reading scenarios

**In project docs** (fe-infra specific):
- `docs/GIT_HOOKS_SETUP.md` - Complete git hooks setup guide
- `docs/DEPLOYMENT_APPROVAL_WORKFLOW.md` - Approval workflow guide
- `docs/REFACTORING_STRATEGY_FIXED_NAMES.md` - Manual deletion procedures
- `docs/CDK_DIFF_EXPLAINED.md` - Understanding CloudFormation diff

---

## Summary

Git hooks provide safety checkpoints for infrastructure projects where traditional PR-based workflows are impractical:

1. **Infrastructure constraints** make PR workflow cumbersome (can't test multiple branches, deployment at push, conflict issues)
2. **Master-only development** provides better DX for solo developers
3. **Pre-push hook** is the only safety checkpoint before deployment
4. **Commit-msg hook** ensures format consistency
5. **Both hooks use commit footers** for validation and audit trail

This approach balances developer experience with infrastructure safety.