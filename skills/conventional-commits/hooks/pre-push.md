# Deployment Safety Footers (pre-push hook)

This document explains deployment approval footers used with pre-push hooks for infrastructure safety. Read this file when:
- Pre-push hook blocked your deployment due to resource replacement
- You need to add deployment approval footer to commit
- You're setting up deployment safety checks for infrastructure projects

## Overview

Infrastructure projects (CDK, Terraform, etc.) use pre-push hooks to detect dangerous CloudFormation changes **before** they reach deployment environments. When resource replacements are detected, the hook blocks the push and requires explicit approval via commit footers.

**Purpose**: Prevent incidents like unintended resource deletions, data loss, or service downtime.

## When Deployment Footers Are Required

### Trigger: Pre-Push Hook Detects Resource Replacement

```bash
git push origin master

═══════════════════════════════════════════════════════════
  ✗ CRITICAL: Fixed-name resource replacement detected
═══════════════════════════════════════════════════════════

[-/+] AWS::CodeBuild::Project AuthCodeBuildProject (replacement)
[-/+] AWS::ECS::Service AuthFargateService (replacement)

Push BLOCKED. Choose one of the following:
  Option B: Acknowledge manual deletion (RECOMMENDED)
            Add footer to your commit message...
```

**What triggers this**:
- CloudFormation Logical ID changes (construct refactoring)
- Resource with fixed names (CodeBuild projects, ECS services, DynamoDB tables, S3 buckets)
- CDK refactoring that changes resource hierarchy

**What doesn't trigger this**:
- In-place updates (`[~]` in cdk diff)
- New resources (`[+]`)
- Intentional deletions (`[-]`)
- Replacements of resources without fixed names

## Footer Format

### Required Fields

```
Safe-To-Deploy: manual-deletion-planned
Analyzed-By: <your-name>
Services: <service-list>
```

### Optional Fields

```
Resources-Affected: CodeBuild=1, ECS=2
Testing-Plan: Deploy auth first, validate 24h, then yozm
Rollback-Plan: git revert <commit-hash>
Rationale: Two-phase deployment requires separate constructs
```

## Complete Commit Example

```
refactor(service): Extract ServiceInfraConstruct

Separate build infrastructure from runtime service
for better organization and two-phase deployment.

This changes Logical IDs but preserves resource names.
Manual deletion required in each environment.

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth
Resources-Affected: CodeBuild=1
Rationale: Using overrideLogicalId() to preserve Logical IDs

Skill: conventional-commits
```

## Workflow: Adding Deployment Footer

### Automated Approach (Recommended)

```bash
# 1. Push fails with resource replacement error
git push origin master

# 2. Run analysis script
./scripts/analyze-and-approve-deployment.sh

# 3. Script shows:
#    - Full CDK diff
#    - Affected services
#    - Generated footer

# 4. Accept to amend commit automatically
Add this footer to your commit and continue? [y/N]: y

# 5. Push again (hook now allows)
git push origin master
```

### Manual Approach

```bash
# 1. Push fails

# 2. Manually amend commit
git commit --amend

# 3. Add footer to commit body:
Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth,yozm

# 4. Save and exit editor

# 5. Push again
git push origin master
```

## Footer Field Guidelines

### Safe-To-Deploy

**Values:**
- `manual-deletion-planned` - You will manually delete resources
- `tested-in-dev` - Changes already tested and validated in DEV
- `emergency-hotfix` - Production incident requiring immediate deployment

**Example:**
```
Safe-To-Deploy: manual-deletion-planned
```

### Analyzed-By

**Purpose**: Documents who approved the deployment

**Format**: Full name or git user name

**Example:**
```
Analyzed-By: John Doe
```

**How to get your git name:**
```bash
git config user.name
```

### Services

**Purpose**: Lists which services are affected by resource replacements

**Format**: Comma-separated service names (no spaces)

**Example:**
```
Services: auth,yozm,support
```

**Single service:**
```
Services: auth
```

**All services:**
```
Services: auth,yozm,support,project,partner,solution,profile
```

### Resources-Affected (Optional)

**Purpose**: Count of resources being replaced by type

**Format**: `ResourceType=count, ResourceType=count`

**Example:**
```
Resources-Affected: CodeBuild=1, ECS=2, DynamoDB=1
```

**Auto-generated** by `analyze-and-approve-deployment.sh` script.

### Testing-Plan (Optional)

**Purpose**: Documents incremental rollout strategy

**Format**: Free-text description of testing sequence

**Example:**
```
Testing-Plan: Deploy auth in DEV day 1, validate 24h, then STAGING day 3
```

**For multiple services:**
```
Testing-Plan: Auth (day 1), yozm (day 2), support (day 3). 24h validation between each.
```

### Rollback-Plan (Optional)

**Purpose**: Documents how to rollback if deployment fails

**Format**: Git commands or procedure reference

**Example:**
```
Rollback-Plan: git revert <commit-hash> && git push
```

**With documentation reference:**
```
Rollback-Plan: See docs/REFACTORING_STRATEGY_FIXED_NAMES.md section "Rollback Procedure"
```

### Rationale (Optional)

**Purpose**: Explains why resource replacement is necessary/acceptable

**Format**: Free-text explanation

**Example:**
```
Rationale: Two-phase deployment requires separate constructs.
           Using overrideLogicalId() to preserve Logical IDs.
           Changes are safe despite Logical ID changes.
```

## How Pre-Push Hook Validates Footer

The hook checks the most recent commit message for the footer:

```bash
LAST_COMMIT_MSG=$(git log -1 --pretty=%B)

if echo "$LAST_COMMIT_MSG" | grep -q "^Safe-To-Deploy: manual-deletion-planned"; then
    echo "✓ Deployment approval footer detected"
    echo "✓ Proceeding with resource replacement..."
    # Allow push
else
    echo "✗ Push BLOCKED - deployment footer required"
    exit 1
fi
```

**Validation rules:**
1. Footer must be in **most recent commit**
2. Footer must start with `Safe-To-Deploy:`
3. Line must be exact match (case-sensitive, no extra spaces)
4. Additional fields (Analyzed-By, Services) are informational (not validated)

## Multiple Commits in Push

**Scenario**: Pushing multiple commits, only latest has footer

**Behavior**:
- Hook only checks **most recent commit** for footer
- If found, **all commits** in the push are approved
- Footer applies to the entire push operation

**Recommendation**:
```bash
# Option A: Squash commits before push
git rebase -i HEAD~3  # Squash last 3 commits

# Option B: Add footer to most recent commit only
git commit --amend  # Just add footer to latest
```

## Integration with Conventional Commits

Deployment footers **complement** conventional commit footers:

```
refactor(service): Extract ServiceInfraConstruct

Separate build and runtime concerns.

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth
Resources-Affected: CodeBuild=1

Skill: conventional-commits
```

**Footer order:**
1. Deployment safety footers (Safe-To-Deploy, Analyzed-By, Services, etc.)
2. Blank line (optional)
3. Skill footer (Skill: conventional-commits)

**Both footers can coexist:**
- `Skill: conventional-commits` - Validates commit format (commit-msg hook)
- `Safe-To-Deploy: ...` - Validates deployment safety (pre-push hook)

## Common Scenarios

### Scenario 1: Single Service Refactoring

```
refactor(auth): Extract ServiceInfraConstruct

Separate build infrastructure from runtime service.

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth
Resources-Affected: CodeBuild=1

Skill: conventional-commits
```

### Scenario 2: Multiple Services

```
refactor(services): Apply two-phase deployment pattern

Extract ServiceInfraConstruct and ServiceAppConstruct
for auth, yozm, and support services.

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: John Doe
Services: auth,yozm,support
Resources-Affected: CodeBuild=3, ECS=3
Testing-Plan: Deploy one service per day, 24h validation between each
Rationale: Two-phase deployment enables independent infrastructure updates

Skill: conventional-commits
```

### Scenario 3: Emergency Production Fix

```
fix(auth): Resolve token expiration bug

Critical fix for users unable to login after 24h.

Safe-To-Deploy: emergency-hotfix
Analyzed-By: John Doe
Services: auth
Rationale: Production incident - immediate deployment required

Skill: conventional-commits
```

## Troubleshooting

### Footer Not Recognized

**Problem**: Added footer but hook still blocks

**Diagnosis**:
```bash
# Check exact commit message
git log -1 --pretty=%B

# Must match exactly:
Safe-To-Deploy: manual-deletion-planned
```

**Common issues:**
- Extra spaces: `Safe-To-Deploy:  manual-deletion-planned` ❌
- Wrong case: `safe-to-deploy: manual-deletion-planned` ❌
- Typo: `Safe-To-Deploy: manual-deletion-planed` ❌ (missing 'n')

**Solution**: Use analysis script for correct format

### Script Doesn't Auto-Detect Services

**Problem**: Script shows `Services: <specify-services>`

**Cause**: Service name not in resource Logical ID

**Solution**:
```bash
# Manually specify in footer
git commit --amend

# Change:
Services: <specify-services>
# To:
Services: auth,yozm
```

### Want to Remove Approval

**Problem**: Added footer but changed mind

**Solution**:
```bash
# Remove footer from commit
git commit --amend

# Edit commit message in editor:
# - Remove Safe-To-Deploy lines
# - Save and exit

# Now push will be blocked again (as expected)
```

## Bypassing Pre-Push Hook (Emergency Only)

```bash
# Skip all pre-push checks
git push --no-verify origin master

# ⚠️ Use only for:
# - Critical production hotfix
# - You are 100% confident in changes
# - You've manually verified CloudFormation diff
```

**Document in commit why bypass was necessary.**

## Audit Trail Benefits

Commit footers provide permanent audit trail in git history:

```bash
# View all deployment approvals
git log --grep="Safe-To-Deploy" --oneline

# Output:
# a1b2c3d refactor(auth): Extract ServiceInfraConstruct
# d4e5f6g refactor(yozm): Apply two-phase pattern

# View approval details
git show a1b2c3d

# Shows:
# - What changed
# - Who approved (Analyzed-By)
# - Which services affected
# - When approved (commit date)
```

**Benefits:**
- Who approved deployment
- What was affected
- Why it was approved (Rationale)
- When it happened
- Permanent record in git history

## Related Documentation

- **SKILL.md**: Main conventional-commits skill instructions
- **commit-msg.md**: Commit format validation hook
- **infrastructure.md**: Infrastructure-specific commit conventions
- Project documentation:
  - `docs/GIT_HOOKS_SETUP.md` - Complete git hooks setup guide
  - `docs/DEPLOYMENT_APPROVAL_WORKFLOW.md` - Detailed workflow guide
  - `docs/REFACTORING_STRATEGY_FIXED_NAMES.md` - Manual deletion procedures
  - `docs/CDK_DIFF_EXPLAINED.md` - Understanding CloudFormation diff

## Summary

Deployment safety footers:

1. **Prevent incidents** - Catch dangerous deployments before they happen
2. **Require acknowledgment** - Developer must explicitly approve resource replacements
3. **Document decisions** - Who, what, when, why preserved in git history
4. **Enable safe refactoring** - Infrastructure can evolve with safety checks
5. **Complement conventional commits** - Work alongside commit format validation

Use deployment footers whenever pre-push hook detects resource replacements. Run `./scripts/analyze-and-approve-deployment.sh` for automated workflow.