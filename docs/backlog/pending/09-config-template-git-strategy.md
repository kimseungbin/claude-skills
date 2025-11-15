# Create config-template.md for git-strategy

**Priority:** Low
**Type:** Configuration Template
**Skill:** git-strategy
**Estimated Time:** 30 minutes

## Problem

The `git-strategy` skill describes what should be in the configuration file but doesn't provide a template for users to copy.

## Current State

- ✅ Configuration section exists in SKILL.md (lines 147-218)
- ✅ Description of what config should include
- ❌ No separate `config-template.md` file

## Task

Create `skills/git-strategy/config-template.md`

## Content to Create

Based on SKILL.md lines 171-216, create a comprehensive template:

```markdown
# Git Strategy Configuration

**Project:** my-project
**Last Updated:** YYYY-MM-DD

---

## Branch Structure

### Environment Branches

| Branch | Environment | Auto-Deploy | Purpose |
|--------|-------------|-------------|---------|
| `main` | Production | ✅ Yes | Production-ready code |
| `staging` | Staging | ✅ Yes | Pre-production testing |
| `dev` | Development | ✅ Yes | Integration testing |

### Feature Branches

- **Pattern:** `feature/<ticket-number>-<description>` (e.g., `feature/PROJ-123-user-auth`)
- **Base branch:** `dev`
- **Merge target:** `dev`
- **Lifetime:** Delete after merge

### Hotfix Branches

- **Pattern:** `hotfix/<ticket-number>-<description>` (e.g., `hotfix/PROJ-456-fix-login`)
- **Base branch:** `main`
- **Merge targets:** `main`, then merge `main` → `staging` → `dev`
- **Lifetime:** Delete after merge

---

## Promotion Rules

### DEV → STAGING

**Trigger:** Manual promotion after testing complete

**Steps:**
1. Create PR from `dev` to `staging`
2. Review changes and test results
3. Merge PR (creates staging deployment)
4. Monitor staging environment
5. If issues found: fix in `dev`, repeat

**Approval required:** Yes (1 reviewer)

### STAGING → PRODUCTION

**Trigger:** Manual promotion after staging validation

**Steps:**
1. Create PR from `staging` to `main`
2. Review staging test results
3. Get production deployment approval
4. Merge PR (creates production deployment)
5. Monitor production environment

**Approval required:** Yes (2 reviewers)

**Additional checks:**
- [ ] All staging tests passing
- [ ] Load testing complete
- [ ] Security scan passed
- [ ] Deployment window approved

---

## Deployment Triggers

### Automatic Deployments

| Branch | Trigger | Target Environment |
|--------|---------|-------------------|
| `dev` | Push to branch | DEV |
| `staging` | Push to branch | STAGING |
| `main` | Push to branch | PRODUCTION |

### Manual Deployments

- Production hotfixes may require manual deployment approval
- Use GitHub Actions workflow dispatch for manual triggers

---

## Emergency Procedures

### Production Hotfix

**When:** Critical bug in production requiring immediate fix

**Process:**
1. Create hotfix branch from `main`: `git checkout -b hotfix/TICKET-description main`
2. Fix the issue in hotfix branch
3. Test locally and in dev environment
4. Create PR from hotfix to `main`
5. Fast-track review and approval
6. Merge to `main` (deploys to production)
7. Merge `main` back to `staging` and `dev`
8. Delete hotfix branch

**Timeline:** < 2 hours from detection to production fix

### Rollback Procedures

#### Rollback Production

**Method 1: Revert commit**
```bash
git revert <commit-hash>
git push origin main
```

**Method 2: Rollback to previous tag**
```bash
git checkout <previous-tag>
git tag -a rollback-$(date +%Y%m%d-%H%M%S) -m "Rollback to <previous-tag>"
git push origin rollback-$(date +%Y%m%d-%H%M%S)
```

**Method 3: Merge previous version** (for infrastructure)
```bash
git checkout -b emergency-rollback
git reset --hard <previous-commit>
git push -f origin emergency-rollback
# Create PR from emergency-rollback to main
```

**Timeline:** < 30 minutes

#### Rollback Staging

Same as production rollback, but with `staging` branch.

---

## Branch Protection Rules

### `main` (Production)

- [ ] Require pull request reviews (2 reviewers)
- [ ] Require status checks to pass
- [ ] Require branches to be up to date
- [ ] Require conversation resolution
- [ ] Include administrators in restrictions
- [ ] Restrict who can push (DevOps team only)

### `staging`

- [ ] Require pull request reviews (1 reviewer)
- [ ] Require status checks to pass
- [ ] Require branches to be up to date

### `dev`

- [ ] Require pull request reviews (1 reviewer)
- [ ] Require status checks to pass

---

## Additional Documentation

### Related Documents

- Deployment runbook: `docs/deployment.md`
- CI/CD pipeline: `.github/workflows/`
- Monitoring dashboards: `<dashboard-url>`

### Contact Information

- **DevOps Team:** devops@example.com
- **On-Call:** oncall@example.com
- **Emergency Hotline:** 1-800-XXX-XXXX

---

## Notes

- This configuration is read by the `git-strategy` skill
- Update this file when branching strategy changes
- Keep deployment procedures up to date
- Review and update quarterly
```

## File Location

Create at: `skills/git-strategy/config-template.md`

## Update Reference in SKILL.md

After creating the template, update SKILL.md to reference it:

```markdown
**Configuration Should Include:**

See `config-template.md` for a complete template.

Key sections:
- Branch structure (DEV/STAGING/PROD)
- Promotion rules and approval requirements
- ... (existing content)
```

## Acceptance Criteria

- [ ] File created at `skills/git-strategy/config-template.md`
- [ ] Contains all sections described in SKILL.md
- [ ] Branch structure table included
- [ ] Promotion rules with approval requirements
- [ ] Emergency procedures (hotfix + rollback)
- [ ] Branch protection rules checklist
- [ ] Placeholders for project-specific information
- [ ] SKILL.md updated to reference the template
