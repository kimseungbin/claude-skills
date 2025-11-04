---
name: Pull Request Management
description: |
  Guide for creating, reviewing, and managing pull requests across projects.
  Helps fill out PR templates with proper validation and confidence checks.
  Use when user requests to create a PR or needs help with PR description.
---

# Pull Request Management

This skill provides guidance for creating and managing pull requests across different projects, with special attention to PR template compliance and confidence-based decision making.

## Core Principles

1. **PR templates are project-specific** - Located in each project's `.github/pull_request_template.md`
2. **Skills are general-purpose** - This skill provides generic guidance applicable to any project
3. **Confidence-based decision making** - When uncertain, suggest PR template updates instead of making low-confidence choices
4. **Template evolution** - PR templates should improve based on real-world usage

## Instructions

When the user requests to create a pull request or fill out a PR template:

### 1. Locate and Read the PR Template

```bash
# Check for PR template in standard locations
find .github -name "*pull_request*.md" -o -name "*PULL_REQUEST*.md"
```

**Standard locations:**
- `.github/pull_request_template.md` (primary)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/` (multiple templates)
- `docs/pull_request_template.md`

If no template exists, ask the user if they want to create one.

### 2. Analyze Current Changes

Gather context about the changes being proposed:

```bash
# Check current branch and status
git branch --show-current
git status

# View staged and unstaged changes
git diff --staged
git diff

# Check recent commits on current branch
git log origin/main..HEAD --oneline  # or origin/master, origin/develop

# Check which files changed
git diff --name-only origin/main..HEAD
```

### 3. Identify Target Branch

Determine where this PR will merge to:

- Check branch naming conventions (feature/*, fix/*, hotfix/*)
- Review git workflow documentation (e.g., GIT_STRATEGY.md, CONTRIBUTING.md)
- Check for environment-based branches (dev, staging, prod, etc.)
- Ask user if unclear

### 4. Fill Out PR Template Sections

For each section in the PR template, follow this decision-making process:

#### 4.1. High Confidence Sections

Fill out directly if you have high confidence (>80%):

**Can determine with high confidence:**
- **Title/Summary**: Based on commit messages and diffs
- **Change Type**: Based on commit prefixes (feat/fix/refactor/chore/docs/ci)
- **Related Issues**: Extract from commit messages (Fixes #123, Closes #456)
- **Files Changed**: From git diff output
- **Testing Instructions**: For straightforward changes

**Example:**
```markdown
## Summary
Add OAuth2 authentication to user login flow

## Change Type
- [x] feat: New feature addition
```

#### 4.2. Medium Confidence Sections

For sections requiring domain knowledge or judgment (40-80% confidence):

**Requires careful analysis:**
- **Deployment Impact**: Requires understanding of infrastructure/service architecture
- **Breaking Changes**: Requires API/contract knowledge
- **Resource Impact**: Requires knowledge of infrastructure costs
- **Security Implications**: Requires security expertise
- **Affected Services**: Requires understanding of service dependencies

**Decision process:**
1. Analyze available information (code, docs, config)
2. If confidence > 60%, make a selection and explain reasoning
3. If confidence < 60%, suggest template update (see section 5)

**Example (Medium-High Confidence):**
```markdown
## Deployment Impact
- [x] High Impact: ECS service redeployment needed

**Reasoning:** Changes modify Task Definition CPU/memory in `lib/main-stack.ts:145`
**Confidence:** ~75% (clear TaskDefinition change, but unsure of rollout strategy)
```

**Example (Medium-Low Confidence):**
```markdown
## Deployment Impact
- [ ] High Impact
- [ ] Medium Impact
- [ ] Low Impact

**⚠️ Unable to determine with confidence (40%)**

**Recommendation:** This PR template asks to categorize deployment impact, but I cannot
determine this with sufficient confidence. Consider updating the template to include:

1. More specific guidance on what constitutes each impact level
2. Examples of common change types and their impact levels
3. A decision tree or flowchart
4. Links to infrastructure documentation

**Temporary approach:** Please manually select the impact level, or let me suggest a
template improvement.
```

#### 4.3. Low Confidence Sections

For sections requiring project-specific knowledge (<40% confidence):

**NEVER guess. Instead:**
1. Leave the section unfilled or mark as "To be determined"
2. Suggest PR template improvement
3. Ask the user for clarification
4. Recommend adding documentation/decision trees to the template

**Example (Low Confidence):**
```markdown
## Resource Impact
- [ ] To be determined

**⚠️ Cannot determine without more context**

**Recommendation:** Add a resource impact decision tree to this PR template:

```yaml
# .github/pr-guidelines/resource-impact-guide.md
## Resource Impact Decision Tree

### High Impact (Cost increase >$100/month OR new AWS resources)
- Adding new RDS instances, ECS services, or Lambda functions
- Increasing instance sizes (e.g., t3.medium → t3.large)
- Adding CloudFront distributions

### Medium Impact (Cost increase $10-100/month OR configuration changes)
- Scaling ECS task counts
- Modifying auto-scaling policies
- Changing S3 storage classes

### Low Impact (Cost increase <$10/month OR metadata only)
- Log group changes
- Tags and labels
- Documentation
```

Please manually fill this section or approve the template improvement.
```

### 5. When to Suggest PR Template Updates

**Trigger conditions for suggesting template improvements:**

1. **Ambiguous Categories**
   - Multiple categories could apply
   - No clear decision criteria
   - Confidence < 60%

2. **Missing Context**
   - Template asks for information not readily available
   - Requires tribal knowledge or undocumented practices
   - No examples provided

3. **Repetitive Questions**
   - Same clarification needed across multiple PRs
   - Common confusion points
   - Frequently left blank by developers

4. **Conflicting Guidance**
   - Template contradicts documentation
   - Unclear precedence between guidelines
   - Inconsistent with actual workflow

**How to suggest improvements:**

```markdown
## Suggested PR Template Improvement

**Issue:** The "Deployment Impact" section is difficult to determine programmatically
and may confuse developers unfamiliar with the infrastructure.

**Current Template:**
```markdown
## Deployment Impact
- [ ] High Impact
- [ ] Medium Impact
- [ ] Low Impact
```

**Suggested Improvement:**
```markdown
## Deployment Impact

<details>
<summary>📖 How to determine impact level (click to expand)</summary>

### High Impact - ECS Service Redeployment
Changes that require rolling out new ECS tasks:
- ✅ Task Definition: CPU, Memory, Environment Variables
- ✅ Container image, port, volume settings
- ✅ Task Role or Execution Role changes

**Files to check:** `lib/**/task-definition.ts`, `lib/**/service/index.ts`

### Medium Impact - Resource Updates (No Downtime)
Changes to resources without service restart:
- ✅ ALB Listener/Target Group rules
- ✅ CloudFront Distribution settings
- ✅ Auto-scaling policies
- ✅ Security Group rules

**Files to check:** `lib/**/load-balancer.ts`, `lib/**/cloudfront.ts`

### Low Impact - Metadata Only
Infrastructure metadata without runtime impact:
- ✅ ECR Repository creation
- ✅ CloudWatch Log Group settings
- ✅ Documentation and comments
- ✅ VPC Flow Logs

**Files to check:** `.md` files, `README`, comments

</details>

Impact Level:
- [ ] High Impact: ECS service redeployment
- [ ] Medium Impact: Resource updates, no downtime
- [ ] Low Impact: Metadata only
```

**Benefits:**
- Provides clear decision criteria
- Includes examples for each category
- Shows which files to check
- Reduces ambiguity and reviewer questions

**Action:** Would you like me to update `.github/pull_request_template.md` with this improvement?
```

### 6. Create the Pull Request

After filling out the template:

#### 6.1. Verify Pre-Flight Checks

Run checks specified in the PR template:

```bash
# Common pre-flight checks
npm run lint:check
npm run build
npm test
npm run type-check

# For CDK projects
npm run cdk synth
cdk diff

# For infrastructure changes
terraform plan
```

#### 6.2. Push and Create PR

```bash
# Ensure branch is pushed
git push origin <branch-name>

# Create PR using GitHub CLI
gh pr create --title "<title>" --body "<body>"

# Or create using web URL
gh pr create --web
```

#### 6.3. Link Related Resources

- Link to related issues/tickets
- Reference related PRs
- Link to design docs or RFCs
- Add labels and assignees

### 7. Post-PR Creation

After PR is created:

1. **Monitor CI/CD**: Check for automated builds, tests, deployments
2. **Update PR**: Add CI results, screenshots, or additional context
3. **Respond to Reviews**: Address feedback and update PR template if questions reveal gaps
4. **Track Template Pain Points**: Note any template sections that caused confusion

## Project-Specific Customization

### Using PR Template Guidelines

Some projects may include supplementary guideline files:

```
.github/
├── pull_request_template.md          # Main template
├── pr-guidelines/
│   ├── deployment-impact-guide.md    # Impact assessment guide
│   ├── security-checklist.md         # Security review checklist
│   └── testing-guide.md              # Testing instructions
```

**When filling out PR templates:**
1. Check for linked guideline files
2. Read referenced documentation
3. Follow project-specific decision trees
4. Use project-specific examples

### Config File Pattern (Optional)

For AI-specific PR assistance rules, projects can create:

**`.claude/config/pull-request-management.yaml`**

```yaml
# Project-specific PR rules
project: fe-infra
repository: wishket/fe-infra

# Branch strategy
branches:
  development: master
  staging: stag
  production: prod

# Auto-fill rules
auto_fill:
  # Automatically detect deployment impact based on file patterns
  deployment_impact:
    high:
      - "lib/**/task-definition.ts"
      - "lib/**/service/index.ts"
    medium:
      - "lib/**/load-balancer.ts"
      - "lib/**/cloudfront.ts"
    low:
      - "**/*.md"
      - "**/README*"

  # Automatically detect affected services based on file paths
  affected_services:
    auth: ["**/auth/**", "**/account-service/**"]
    yozm: ["**/yozm/**", "**/yozm-service/**"]
    support: ["**/support/**"]

# Confidence thresholds
confidence:
  high: 80    # Fill out directly
  medium: 60  # Fill with explanation
  low: 40     # Suggest template update

# Required checks before PR creation
pre_flight_checks:
  - npm run lint:check
  - npm run build
  - npm run cdk synth
```

**When to create this config:**
- User specifies project-specific PR rules
- Repeated patterns emerge across multiple PRs
- Template sections require custom logic

## Common PR Workflows

### Workflow 1: Feature Branch → Main

```
User: "Create a PR for my authentication feature"

1. Read .github/pull_request_template.md
2. Analyze changes: git diff main...HEAD
3. Identify: Auth service changes, Task Definition modified
4. Fill template:
   - Title: "feat(auth): Add OAuth2 authentication"
   - Type: feat
   - Deployment Impact: High (TaskDefinition changed)
   - Affected Services: auth
   - Confidence: High (95%)
5. Run pre-flight: npm run lint:check && npm run build
6. Create PR: gh pr create
7. Monitor CI
```

### Workflow 2: Environment Promotion (Dev → Staging)

```
User: "Create PR to promote master to staging"

1. Read .github/pull_request_template.md
2. Analyze: git diff stag...master
3. Identify: Multiple commits, multiple services
4. Fill template:
   - Title: "chore: Promote DEV changes to STAGING"
   - Type: chore
   - Target Environment: STAGING
   - Affected Services: (list all from commits)
   - Deployment Impact: Varies per commit
   - Confidence: High (90%)
5. Generate summary from commit history
6. Create PR: gh pr create --base stag --head master
7. Note: Requires review approval for STAGING
```

### Workflow 3: Low Confidence → Template Improvement

```
User: "Create PR for infrastructure changes"

1. Read .github/pull_request_template.md
2. Analyze: VPC changes, new security groups
3. Template asks: "Security Impact: High/Medium/Low?"
4. Confidence: Low (35% - requires security expertise)
5. Response:
   ⚠️ Cannot determine security impact with confidence

   Recommendation: Add security impact assessment guide:

   - Link to security review checklist
   - Decision tree for common change types
   - Examples of high/medium/low impact

   Temporary: Leaving this section for manual review

6. Create PR with incomplete template + improvement suggestion
7. User reviews and either:
   - Fills in manually
   - Approves template improvement
```

## Template Update Workflow

When suggesting PR template updates:

### Step 1: Identify the Gap

Document:
- Which section is problematic
- Why it's difficult to determine
- What information is missing
- How often this occurs

### Step 2: Research Best Practices

Check:
- Industry standard PR templates
- Similar projects' approaches
- Team documentation
- Previous PR comments/questions

### Step 3: Draft Improvement

Create:
- Clear decision criteria
- Examples for each option
- Links to documentation
- Expandable help sections

### Step 4: Propose to User

Present:
- Current template section (problematic)
- Proposed improvement
- Benefits of the change
- Request approval

### Step 5: Implement if Approved

```bash
# Update template
Edit: .github/pull_request_template.md

# Create supporting docs if needed
Write: .github/pr-guidelines/<guide-name>.md

# Commit changes
git add .github/
git commit -m "docs(github): Improve PR template with deployment impact guide"

# Update current PR to use new template
# (manually refresh the PR description)
```

## Anti-Patterns to Avoid

### ❌ DON'T: Guess with Low Confidence

```markdown
## Deployment Impact
- [x] Medium Impact

<!-- BAD: Only 30% confident, but selected anyway -->
```

### ✅ DO: Be Transparent About Uncertainty

```markdown
## Deployment Impact
- [ ] To be determined

**Confidence: Low (30%)**
**Reason:** Unfamiliar with this infrastructure pattern
**Recommendation:** Add decision guide to template
**Action Needed:** Manual review required
```

### ❌ DON'T: Fill Everything Even If Wrong

Better to leave sections incomplete with explanation than to provide incorrect information.

### ✅ DO: Suggest Improvements When Patterns Emerge

If the same section is unclear across multiple PRs, it's a template problem, not a user problem.

### ❌ DON'T: Create Generic, One-Size-Fits-All Templates

Templates should be specific to the project's workflow, tech stack, and review process.

### ✅ DO: Tailor Templates to Project Needs

Infrastructure projects need different sections than frontend projects. CDK projects need ChangeSet review, web apps need screenshot sections.

## Notes

- PR templates live in each project (`.github/pull_request_template.md`)
- This skill provides general guidance applicable across projects
- Use confidence-based decision making: high confidence → fill out, low confidence → suggest improvement
- Templates should evolve based on real usage patterns
- When in doubt, ask the user or suggest template updates
- Document project-specific rules in `.claude/config/pull-request-management.yaml`
- Transparency about uncertainty is better than incorrect guesses

## See Also

- [Conventional Commits Skill](../conventional-commits/skill.md) - For commit message generation
- [GitHub PR Template Best Practices](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- Project-specific: `.github/pr-guidelines/` (if exists)