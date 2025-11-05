# Pull Request Management - Examples

This document provides real-world examples of using the pull-request-management skill.

## Example 1: High Confidence - Simple Feature PR

**Scenario:** Added new API endpoint for user profile

**Changes:**

```bash
$ git diff main...HEAD --name-only
packages/backend/src/api/profile.controller.ts
packages/backend/src/api/profile.service.ts
packages/backend/tests/profile.spec.ts
```

**Skill Analysis:**

```
✅ High Confidence (95%)

Title: "feat(backend): Add user profile API endpoint"
Type: feat
Scope: backend
Affected Services: backend
Deployment Impact: High (new code requires deployment)
Breaking Changes: No
```

**PR Template Filled:**

```markdown
## Summary

Add new REST API endpoint for retrieving user profile information

## Change Type

- [x] feat: New feature addition

## Deployment Impact

- [x] High Impact: Service redeployment needed

**Reasoning:** New API endpoint requires deploying updated container image
**Confidence:** 95%

## Affected Services

- [x] backend

## Testing

- [x] Unit tests added (profile.spec.ts)
- [x] Manual API testing completed
```

---

## Example 2: Medium Confidence - Infrastructure Change

**Scenario:** Adjusted ECS task CPU and memory

**Changes:**

```bash
$ git diff main...HEAD
lib/constructs/service/task-definition.ts
-  cpu: 256,
+  cpu: 512,
-  memory: 512,
+  memory: 1024,
```

**Skill Analysis:**

```
⚠️ Medium Confidence (70%)

Title: "chore(infra): Increase ECS task resources for auth service"
Type: chore
Scope: infra
Affected Services: auth
Deployment Impact: High (TaskDefinition change)
Resource Impact: Medium (cost increase ~$20/month)
```

**PR Template Filled:**

```markdown
## Summary

Increase CPU and memory allocation for auth service to handle increased load

## Change Type

- [x] chore: Infrastructure maintenance

## Deployment Impact

- [x] High Impact: ECS service redeployment needed

**Reasoning:** TaskDefinition CPU/memory changes trigger new task deployment
**Confidence:** 95% (clear TaskDefinition change)

## Resource Impact

- [x] Existing resource capacity changed

**Estimated Cost Change:** ~$15-25/month
**Reasoning:** t3.micro equivalent → t3.small (512 MB → 1 GB)
**Confidence:** 70% (rough estimate, needs AWS calculator confirmation)

⚠️ **Recommendation:** Please verify cost estimate using AWS Pricing Calculator
```

---

## Example 3: Low Confidence - Security Change Requires Template Update

**Scenario:** Modified IAM policy for Lambda function

**Changes:**

```bash
$ git diff main...HEAD --name-only
lib/constructs/lambda/permissions.ts
```

**Skill Analysis:**

```
❌ Low Confidence (35%)

Template Section: "Security Impact: High/Medium/Low?"
Issue: Cannot determine security impact without security expertise
```

**Response:**

```markdown
## Security Impact

- [ ] To be determined

⚠️ **Cannot determine with confidence (35%)**

**Issue:** This PR template asks to categorize security impact, but I cannot assess
this without security domain knowledge.

**Recommendation:** Update PR template to include security impact assessment guide:

### Suggested Addition to Template:

<details>
<summary>🔒 Security Impact Assessment Guide</summary>

#### High Security Impact

Changes that affect:

- IAM policies granting cross-account access
- Authentication/authorization logic
- Encryption settings (at rest or in transit)
- Public-facing API security controls
- Secrets management

**Action Required:** Security team review mandatory

#### Medium Security Impact

Changes that affect:

- Internal API permissions
- Resource-level IAM policies
- Security group rules (non-public)
- Logging/monitoring configurations

**Action Required:** Peer review with security checklist

#### Low Security Impact

Changes that:

- Don't modify access controls
- Update documentation only
- Change UI/UX without backend impact

**Action Required:** Standard peer review

</details>

---

**Would you like me to:**

1. Update `.github/pull_request_template.md` with this improvement?
2. Create `.github/pr-guidelines/security-impact-guide.md` with detailed checklist?
3. Leave this section for manual review?
```

---

## Example 4: Template Improvement Triggered by Ambiguity

**Scenario:** CloudFront distribution configuration change

**Changes:**

```bash
$ git diff main...HEAD --name-only
lib/constructs/cloudfront/distribution.ts
```

**Skill Analysis:**

```
⚠️ Medium-Low Confidence (55%)

Template asks: "Deployment Impact: High/Medium/Low?"
Issue: CloudFront changes are gradual (no downtime), but template
       categories don't distinguish between "requires restart" vs
       "gradual rollout" vs "metadata only"
```

**Response:**

````markdown
## Deployment Impact

- [ ] To be determined

**Confidence: Medium-Low (55%)**

**Issue:** Current template categories don't clearly distinguish between:

- Changes requiring service restart (ECS tasks)
- Changes with gradual rollout (CloudFront distributions)
- Changes with no runtime impact (logs, tags)

CloudFront distribution changes deploy gradually without downtime, but current
template categories "High/Medium/Low" don't capture this nuance.

---

### Suggested Template Improvement

**Current (Ambiguous):**

```markdown
- [ ] High Impact
- [ ] Medium Impact
- [ ] Low Impact
```
````

**Suggested (Clear):**

```markdown
## Deployment Impact

### Runtime Impact

- [ ] Service Restart Required (ECS tasks redeploy)
- [ ] Gradual Rollout (CloudFront, ALB rules)
- [ ] No Runtime Impact (metadata, logs, docs)

### Downtime Risk

- [ ] Potential Downtime (requires maintenance window)
- [ ] Zero Downtime (rolling deployment)
- [ ] No Service Impact
```

**Benefits:**

- Separates "impact on running services" from "downtime risk"
- Clearer categories for different AWS service types
- Helps reviewers assess deployment risk

---

**Would you like me to update the PR template with this improvement?**

````

---

## Example 5: Using Project Config for Auto-Fill

**Scenario:** Project has `.claude/config/pull-request-management.yaml`

**Config:**
```yaml
project: fe-infra
auto_fill:
  deployment_impact:
    high:
      - "**/task-definition.ts"
    medium:
      - "**/cloudfront.ts"
  affected_services:
    auth: ["**/auth/**"]
    yozm: ["**/yozm/**"]
````

**Changes:**

```bash
$ git diff main...HEAD --name-only
lib/constructs/service/task-definition.ts  # auth service
src/config/auth-config.ts
```

**Skill Analysis:**

```
✅ High Confidence (90%) - Using project config rules

Deployment Impact: High (task-definition.ts matches config pattern)
Affected Services: auth (file path matches config pattern)
```

**PR Template Auto-Filled:**

```markdown
## Deployment Impact

- [x] High Impact: Service redeployment needed

**Auto-detected:** task-definition.ts change matches high-impact pattern
**Confidence:** 90% (based on project config rules)

## Affected Services

- [x] auth

**Auto-detected:** Files under lib/constructs/service/ for auth service
**Confidence:** 90% (based on project config rules)
```

---

## Example 6: Multi-Service Change with Partial Confidence

**Scenario:** Database migration affecting multiple services

**Changes:**

```bash
$ git diff main...HEAD --name-only
packages/backend/migrations/001-add-user-table.sql
packages/auth/src/user.service.ts
packages/profile/src/profile.service.ts
packages/frontend/src/components/UserProfile.svelte
```

**Skill Analysis:**

```
Mixed Confidence Levels:
✅ Affected Services (95%): auth, profile, frontend (clear from file paths)
✅ Change Type (90%): feat (new table = new capability)
⚠️ Breaking Changes (50%): Database migration might break existing code
❌ Rollback Plan (30%): Requires database expertise
```

**PR Template Filled:**

````markdown
## Summary

Add user profile table and integrate across auth, profile, and frontend services

## Change Type

- [x] feat: New feature addition

**Confidence:** 90%

## Affected Services

- [x] auth
- [x] profile
- [x] frontend
- [ ] backend (database migration)

**Confidence:** 95%

## Breaking Changes

- [ ] To be determined

**Confidence: Medium (50%)**

**Analysis:** This PR includes a database migration (`001-add-user-table.sql`).
Database migrations can be breaking if:

- Existing code expects old schema
- Migration is not backward-compatible
- No feature flags for gradual rollout

**Questions for reviewer:**

1. Is this migration backward-compatible?
2. Do we need a feature flag?
3. What's the rollback strategy if migration fails?

## Rollback Plan

⚠️ **Requires database expertise (Confidence: 30%)**

**Recommendation:** Add database rollback guide to PR template:

### Suggested Template Section:

```markdown
## Database Changes

- [ ] This PR includes database migrations
- [ ] Migrations are backward-compatible
- [ ] Rollback migration script provided
- [ ] Feature flag for gradual rollout
- [ ] No database changes

**Rollback Strategy:**

- [ ] Drop table/column (destructive)
- [ ] Revert migration script (down migration)
- [ ] Feature flag disable (non-destructive)
```
````

**Temporary:** Please manually document the rollback plan for this database migration.

```

---

## Summary: Confidence-Based Decision Making

| Confidence | Action | Example |
|-----------|--------|---------|
| **High (>80%)** | Fill out directly | Change type from commit prefix, affected services from file paths |
| **Medium (60-80%)** | Fill with explanation | Deployment impact with reasoning, cost estimates with caveats |
| **Low (<60%)** | Suggest template update | Security impact without expertise, database rollback without DBA knowledge |

**Key Principle:** Transparency about uncertainty is more valuable than low-confidence guesses.
```
