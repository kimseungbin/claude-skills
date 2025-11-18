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

**CRITICAL: Always use remote branches for comparison, not local branches.**

Gather context about the changes being proposed:

```bash
# Check current branch and status
git branch --show-current
git status

# List all remote branches
git branch -r

# Fetch latest remote state (if needed)
git fetch origin

# ALWAYS compare remote branches for PR analysis
git log origin/<target-branch>..origin/<source-branch> --oneline
git diff origin/<target-branch>..origin/<source-branch> --name-only

# Example: For master → staging PR
git log origin/staging..origin/master --oneline
git diff origin/staging..origin/master --name-only
```

**Why remote branches?**
- Local branches may be out of sync with remote
- User may have unpushed commits that shouldn't be in PR
- Remote branches reflect what will actually be merged
- Prevents including unintended local work-in-progress commits

**Anti-pattern:**
```bash
# ❌ DON'T: Compare local branches
git log staging..master  # May include unpushed local commits
git diff HEAD..master    # Compares local state, not remote
```

### 3. Identify Target Branch

Determine where this PR will merge to:

- Check branch naming conventions (feature/_, fix/_, hotfix/\*)
- Review git workflow documentation (e.g., GIT_STRATEGY.md, CONTRIBUTING.md)
- Check for environment-based branches (dev, staging, prod, etc.)
- Ask user if unclear

### 3.5. Determine PR Title and Type

**CRITICAL: For environment promotion PRs (e.g., master → staging), analyze ALL commits to determine the correct type.**

#### For Single-Feature PRs:

Use the commit type directly:

- `feat(scope): Add new feature`
- `fix(scope): Fix bug in component`
- `refactor(scope): Restructure module`

#### For Environment Promotion PRs (Multiple Commits):

**Step 1: Analyze All Commits**

```bash
git log <target-branch>..<source-branch> --oneline
```

**Step 2: Count Commit Types**
Categorize commits by type:

- feat: New features, major functionality
- fix: Bug fixes
- refactor: Code restructuring without behavior change
- docs: Documentation only
- chore: Maintenance (dependencies, config)
- ci: CI/CD changes

**Step 3: Select Dominant Type and Prioritize Important Items**

**CRITICAL: Prioritize Runtime Impact Over Documentation/Tooling**

When analyzing commits for PR titles and summaries, prioritize by business impact:

1. **Runtime/Service Changes** (HIGHEST PRIORITY)
   - New services enabled
   - Service configuration changes
   - Infrastructure affecting running applications
   - Database/API changes

2. **Infrastructure/Architecture Changes** (HIGH PRIORITY)
   - Migrations, major refactorings
   - Build system changes
   - Deployment strategy changes

3. **Developer Tooling** (MEDIUM PRIORITY)
   - CI/CD improvements
   - Developer experience tools
   - Build scripts

4. **Documentation** (LOWEST PRIORITY)
   - README, CLAUDE.md updates
   - Comments, guides
   - Refactoring plans

**Decision Rules:**

1. **If there are runtime/service changes** (new service, service config):
    - **ALWAYS prioritize these in the title**
    - Use `feat(service-name):` or `feat(infra):`
    - Example: `feat(profile): Enable Profile service for Production`
    - Example: `feat(auth): Add OAuth2 with additional tooling improvements`

2. **If there's a major infrastructure change** (migration, architecture change):
    - Use `feat(infra):` or `refactor(infra):`
    - Example: `feat(infra): Migrate to ES Modules and add tooling improvements`

3. **If mostly new features** (>50% feat commits):
    - Use `feat:` or `feat(scope):`
    - **Prioritize most impactful features first**
    - Example: `feat: Add authentication and user management features`

4. **If mostly bug fixes** (>50% fix commits):
    - Use `fix:` or `fix(scope):`
    - Example: `fix: Resolve production issues and performance bugs`

5. **If mixed with no clear dominant** (e.g., 40% feat, 35% fix, 25% docs):
    - **Identify the most business-critical change**
    - Lead with that in title, mention others secondarily
    - Example: `feat(profile): Enable Production deployment with CDK tooling`
    - NOT: `feat(tools): Add CDK expert skill and enable Profile service` (WRONG - tools less important)

6. **NEVER use `chore:` for environment promotions**:
    - `chore` = maintenance tasks (dependency updates, config tweaks)
    - Promotions contain actual features/fixes that provide user value
    - Exception: Only use `chore` if PR is truly just dependency updates

**Examples:**

**Good:**

```
feat(infra): Migrate to ES Modules and add tooling improvements
feat(auth): Add OAuth2 and two-factor authentication
fix: Resolve critical production bugs in payment flow
refactor(api): Restructure API layer for better maintainability
```

**Bad:**

```
chore: Promote DEV to STAGING  ← TOO GENERIC, WRONG TYPE
update: Add new features  ← "update" is not a conventional commit type
feat: Changes  ← TOO VAGUE
```

#### PR Title Specificity

**CRITICAL: PR titles must be specific and actionable, not generic.**

❌ **Generic titles (avoid):**
```
docs(project): Improve documentation
docs: Update documentation and add backlog
docs: Documentation improvements
chore: Maintenance tasks
```

**Why generic titles are bad:**
- "Improve documentation" - doesn't tell what was improved
- "Add backlog" - in an infrastructure repo, backlog IS infrastructure (redundant)
- Reviewer can't understand changes without reading the full description

✅ **Specific titles (use):**
```
docs(project): Mark Slack integration complete and add 9 features to backlog
docs(deployment): Add pipeline notification architecture comments
docs(lambda-edge): Translate Korean comments and add JSDoc
docs(project): Extract feature flags documentation to dedicated file
```

**Why specific titles are good:**
- States concrete milestone: "Slack integration complete"
- Quantifies changes: "9 features"
- Identifies specific component: "pipeline notification"
- Avoids redundancy: no "infrastructure backlog" in infra repo

**Guidelines:**
1. **Include concrete details**: Mention specific milestones, numbers, or components
2. **Avoid redundant terms**: Don't say "infrastructure" in an infrastructure repository
3. **Be actionable**: Reader should understand the change from the title alone
4. **Use verbs**: "Mark", "Add", "Extract", "Translate" (not "Improvement", "Update")

### 3.6. Format PR Summary

**Use nested bullet points to group related changes.**

When there are multiple documentation changes or multiple features, group them under category headers:

❌ **Flat list (hard to scan):**
```markdown
## Summary

- Pipeline notification architecture comments
- Lambda workspace architecture moved to README
- Notification implementation guide removed
- Slack integration marked complete
- 9 new features added to backlog
- ECS cost optimization docs improved
- claude-skills submodule updated
```

✅ **Nested structure (easy to scan):**
```markdown
## Summary

- **Documentation structure improvements**
  - Pipeline notification architecture comments added
  - Lambda workspace architecture moved from CLAUDE.md to README
  - Completed notification implementation guide removed

- **Backlog updates**
  - Slack integration marked complete (TODO-01)
  - 9 new features added to backlog (testing, security, cost optimization)
  - ECS cost optimization documentation improved (FEATURE-07)

- **Maintenance**
  - claude-skills submodule updated
```

**Benefits of nesting:**
- Logical grouping visible at a glance
- Easier to understand the scope of changes
- Shows relationship between related changes
- Reduces cognitive load for reviewers

**Grouping guidelines:**
1. Group by change category (docs, features, fixes, refactoring)
2. Use bold headers for categories
3. Limit to 2-4 top-level groups
4. Keep nested items concise (one line each)
5. Order by importance (most impactful first)

### 3.7. Remove Redundant Headings

**DO NOT include redundant "# Pull Request" heading in PR description.**

Everyone knows it's a PR from the GitHub context. Start directly with the first section.

❌ **With redundant heading:**
```markdown
# Pull Request

## Summary
...
```

✅ **Without redundant heading:**
```markdown
## Summary
...
```

This applies to PR descriptions only. Markdown files in the repository may still use H1 headings as appropriate.

### 3.8. Avoid Checkbox Overuse

**Checkboxes are for task lists, not for selecting single options.**

Many PR templates misuse checkboxes for single-choice selections (environment, impact level, yes/no questions). This creates confusion and visual clutter.

#### When NOT to Use Checkboxes

**❌ Single selection (environment)**
```markdown
- [ ] DEV
- [x] STAGING  ← Only ONE can be true
- [ ] PRODUCTION
```

**✅ Use direct statement instead:**
```markdown
**Target Environment:** STAGING (from `staging` branch)
```

or with visual emphasis:
```markdown
**Environment:** ![STAGING](https://img.shields.io/badge/env-STAGING-yellow)
```

---

**❌ Yes/No questions (breaking change)**
```markdown
- [x] This PR includes breaking changes
```

**✅ Use emoji + direct answer (POSITIVE when no breaking change):**
```markdown
**Breaking Change:** ✅ 없음
```

or when yes (WARNING emoji to alert reader):
```markdown
**Breaking Change:** ⚠️ 있음

**Details:**
- API endpoint changed: `/v1/users` → `/v2/users`
- Migration required: Update all API clients
```

**Emoji Rationale:**
- ✅ (green checkmark) = Good news, safe to proceed, no breaking changes
- ⚠️ (warning sign) = Danger, requires attention, has breaking changes
- This is REVERSED from typical "yes/no" patterns for better UX
- Readers should feel relief when they see ✅, concern when they see ⚠️

---

**❌ Impact levels**
```markdown
- [ ] High Impact
- [ ] Medium Impact
- [x] Low Impact
```

**✅ Use emoji header + analysis:**
```markdown
🟢 **Low Impact**

**Analysis:**
- Code refactoring only, no runtime changes
- STAGING/PROD use existing constructs
- DEV/QA validated successfully
```

---

**❌ Multiple change types**
```markdown
- [x] feat
- [x] refactor
- [ ] fix
```

**Problem:** Looks like checklist, but it's categorical information

**✅ List types with emojis:**
```markdown
♻️ refactor: 리팩토링 (Profile 서비스 아키텍처 개선)
🎉 feat: 새로운 기능 (CloudFront custom domain 제어)
🔧 chore: 유지보수 (CDK 업데이트, 도구 개선)
```

#### When TO Use Checkboxes

**✅ Actual task lists (pre-flight checks)**
```markdown
## Pre-deployment Tests

- [x] `npm run lint:check` passed
- [x] `npm run build` succeeded
- [x] `npm run cdk synth` succeeded
- [ ] CloudFormation Change Set reviewed
- [ ] Security impact reviewed
```

**✅ Post-deployment verification**
```markdown
## Verification Steps

- [ ] ECS Service status: RUNNING
- [ ] Target Group health: Healthy
- [ ] CloudWatch Logs: No errors
- [ ] API endpoints responding
```

**Why:** These are actual TODO items requiring completion

#### Checkbox Alternatives Reference

| Use Case | Instead of Checkbox | Use |
|----------|-------------------|-----|
| **Single selection** | `- [x] Option A` | Direct statement: `**Field:** Value` |
| **Yes/No** | `- [x] Yes` | Emoji: `**Field:** ✅ Yes` or `❌ No` |
| **Impact levels** | `- [x] Low` | Emoji header: `🟢 **Low Impact**` |
| **Multiple types** | `- [x] feat`<br>`- [x] fix` | Listed: `♻️ refactor`<br>`🎉 feat` |
| **Environment** | `- [x] STAGING` | Direct text with table for feature flag analysis |
| **Breaking** | `- [x] Breaking` | Conditional: `⚠️ 있음` with details OR `✅ 없음` |

#### Visual Hierarchy Tips

**1. Use traffic light emojis for impact:**
- 🔴 High Impact
- 🟡 Medium Impact
- 🟢 Low Impact

**2. Use status emojis for binary states:**
- ✅ Complete / ❌ Not complete
- ⚠️ Warning / 🚨 Critical
- ⏳ In Progress / 🎯 Planned

**3. Use type emojis for change categories:**
- 🎉 feat (new feature)
- 🐛 fix (bug fix)
- ♻️ refactor (restructuring)
- 📝 docs (documentation)
- 🔧 chore (maintenance)
- 🤖 ci (CI/CD)

**4. Use bold for field labels:**
```markdown
**Target Environment:** STAGING
**Impact Level:** 🟢 Low
**Breaking Change:** ❌ No
```

**5. Use blockquotes for important notes:**
```markdown
> **중요:** STAGING/PROD는 기존 구조를 유지합니다
```

See [examples/environment-promotion.md](examples/environment-promotion.md) for full examples.

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

🎉 feat: New feature addition
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
2. **Check actual diff content, not just file names**
3. If confidence > 60%, make a selection and **ALWAYS explain reasoning with specific evidence**
4. If confidence < 60%, suggest template update (see section 5)

#### Special: Deployment Impact Analysis (CRITICAL)

**ALWAYS provide detailed reasoning for deployment impact. Never just check a box.**

**Step 1: Identify Changed Files**

```bash
git diff <base>..<head> --name-only | grep -E "task-definition|config.data|fargate|service"
```

**Step 2: Check ACTUAL Changes (Not Just File Names)**

```bash
# Check if actual VALUES changed
git diff <base>..<head> lib/constructs/service/task-definition.ts
git diff <base>..<head> src/config/config.data.ts | grep -E "cpu|memory|env|desired"
```

**Step 3: Categorize Based on ACTUAL Changes**

**High Impact - Task Definition Changes:**

```bash
# Look for actual VALUE changes in:
- CPU: FargateCpu.CPU_256 → FargateCpu.CPU_512
- Memory: FargateMemory.MEMORY_512 → FargateMemory.MEMORY_1024
- Environment variables: new env vars, changed values
- Container image, ports, volumes
- Task/Execution roles
```

**Medium Impact - Scaling/Network Changes:**

```bash
# Look for:
- desiredCount: 4 → 2 (task count change, NOT task definition)
- minCapacity/maxCapacity changes
- ALB rules, Security Groups
- Auto-scaling policies
```

**Low Impact - Code Refactoring:**

```bash
# Look for:
- Import path changes (same values, different location)
- File moves without value changes
- Documentation updates
```

**Common Mistakes to Avoid:**

❌ **Wrong:**

```markdown
- [x] High Impact

Reasoning: task-definition.ts file changed
```

→ Checking file name only, not actual diff content

✅ **Correct:**

```markdown
- [x] Medium Impact

Reasoning:

- src/config/config.data.ts (fd282d1): desiredCount 4→2, minCapacity 4→2
- This changes task COUNT, not task DEFINITION
- ECS will scale down existing tasks, no new task deployment needed
```

---

❌ **Wrong:**

```markdown
- [x] High Impact

Reasoning: Fargate CPU enum file modified
```

→ File moved, values unchanged

✅ **Correct:**

```markdown
- [x] Low Impact

Reasoning:

- lib/constructs/service/fargate-cpu.ts → src/config/types/fargate.types.ts
- File relocation only, no value changes
- Import paths updated, compiled output identical
```

**Example (Medium-High Confidence with Proper Analysis):**

```markdown
## Deployment Impact

🟡 **Medium Impact**

**영향도 분석:**

- 🟡 Medium Impact: src/config/config.data.ts에서 desiredCount 4→2 변경 (fd282d1)
    - Auto-scaling 조정, Task Definition은 변경 없음
    - 기존 Task 유지, 점진적 스케일 다운
- 🟢 Low Impact: lib/constructs/service/fargate-cpu.ts → src/config/types/fargate.types.ts 이동 (e3bf8b3)
    - 파일 구조 변경, 실제 값 변경 없음

**Confidence:** 90% (git diff 확인 완료, 실제 값 변경 내역 확인)
```

**Emoji Guide for Deployment Impact:**
- 🔴 High Impact: ECS service redeployment required
- 🟡 Medium Impact: Resource updates, no downtime
- 🟢 Low Impact: Metadata only

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

````markdown
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
````

Please manually fill this section or approve the template improvement.

````

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
````

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

````

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
````

#### 6.2. Push and Create PR

```bash
# Ensure branch is pushed
git push origin <branch-name>

# Create PR using GitHub CLI with self-assignment
gh pr create --title "<title>" --body "<body>" --assignee @me

# Or create using web URL
gh pr create --web
```

#### 6.3. Link Related Resources

- Link to related issues/tickets
- Reference related PRs
- Link to design docs or RFCs
- Add labels (assignee is auto-set with --assignee @me)

### 7. Post-PR Creation

After PR is created:

1. **Monitor CI/CD**: Check for automated builds, tests, deployments
2. **Update PR**: Add CI results, screenshots, or additional context
3. **Respond to Reviews**: Address feedback and update PR template if questions reveal gaps
4. **Track Template Pain Points**: Note any template sections that caused confusion

## Korean Template Conventions

For projects using Korean PR templates (common in Korean companies), follow these specific conventions:

### Language and Terminology

**Environment Names:**
- ❌ Don't: "PRODUCTION 환경", "DEV 환경"
- ✅ Do: **운영 환경** (PRODUCTION), **개발 환경** (DEV), **스테이징 환경** (STAGING)
- Use **bold Korean terms** with English in parentheses for clarity

**Main Content:**
- Write descriptions in Korean (primary language)
- Use English only for technical clarification in parentheses
- Don't use English phrases like "Incremental Production Deployment" as main headers

**Example:**
```markdown
❌ Incremental Production Deployment - Promoting workspace migration to production

✅ **`npm workspace` 마이그레이션 및 개발 도구 개선**을 **운영 환경**에 배포합니다.
```

### Technical Terms with Backticks

Always use backticks for technical terms to distinguish them from regular Korean text:

**When to use backticks:**
- Package names: `npm workspace`, `esbuild`, `TypeScript`
- File paths: `packages/lambda/ecs-reboot/src/index.ts`
- Code identifiers: `handler.handler`, `index.handler`
- Configuration keys: `cpu`, `memory`, `desiredCount`
- Technical terms: `workspace`, `Lambda`, `CloudFormation`

**Example:**
```markdown
❌ Lambda 함수를 workspace 패키지로 재구성
❌ npm workspace로 마이그레이션

✅ Lambda 함수를 `workspace` 패키지로 재구성
✅ `npm workspace`로 마이그레이션
```

### Change Type Emojis

Always include emojis with change types for visual categorization:

```markdown
## 변경 유형 (Type of Change)

- ♻️ **refactor**: 리팩토링 (`npm workspace` 구조 전환)
- 📝 **docs**: 문서화 개선
- 🔧 **chore**: 유지보수 (개발 도구, 서브모듈 업데이트)
- 🎉 **feat**: 새로운 기능 추가
- 🐛 **fix**: 버그 수정
- 🤖 **ci**: CI/CD 변경
```

**Standard Emoji Mapping:**
- ♻️ refactor (recycling symbol for restructuring)
- 📝 docs (memo for documentation)
- 🔧 chore (wrench for maintenance)
- 🎉 feat (party popper for new features)
- 🐛 fix (bug for bug fixes)
- 🤖 ci (robot for automation)

### Explain Technical Changes

Always explain WHY technical changes occurred, not just WHAT changed:

❌ **Don't:**
```markdown
**Infrastructure Changes:**
- Lambda Functions: Handler changed from `handler.handler` to `index.handler`
```

✅ **Do:**
```markdown
**Infrastructure Changes:**
- **Lambda Functions (7개 ECS Reboot 함수):**
  - Handler 경로: `handler.handler` → `index.handler`
  - Description 필드 추가: "ECS service reboot function for {service}"
  - **변경 이유:** `packages/lambda/ecs-reboot/src/index.ts`로 소스 위치 변경,
    CDK가 TypeScript를 직접 컴파일하도록 개선 (기존 JavaScript 파일 제거)
```

### Focus on What, Not How

Lead with the actual changes being deployed, not the deployment methodology:

❌ **Don't:**
```markdown
## 변경 사항 요약 (Summary)

Incremental Production Deployment - workspace 마이그레이션을 운영 환경에 배포
```

✅ **Do:**
```markdown
## 변경 사항 요약 (Summary)

**`npm workspace` 마이그레이션 및 개발 도구 개선**을 **운영 환경**에 배포합니다.

**배포 전략:** 점진적 배포 (15개 커밋, STAGING의 78개 커밋 중 1단계)
```

**Rationale:**
- The main issue is WHAT is being deployed (workspace migration)
- HOW it's deployed (incremental) is secondary metadata
- Reviewers care about changes first, methodology second

### Technical Explanations Pattern

For complex technical changes, use the "Why → Before → After → Result" pattern:

```markdown
**왜 Lambda handler가 변경되었나:**
- `workspace` 구조에서 진입점(entry point) 파일명 표준화: `index.ts`
- 기존: `handler.js` (컴파일된 파일을 직접 참조)
- 변경: `index.ts` (TypeScript 소스를 CDK가 컴파일)
- 결과: handler 경로가 `handler.handler`에서 `index.handler`로 변경
```

**Structure:**
1. Question format: "왜 X가 변경되었나"
2. Context: What standard/pattern drove the change
3. Before state with explanation
4. After state with explanation
5. Clear outcome/result

### Impact Level Formatting

Use emoji traffic lights with bold Korean descriptions:

```markdown
## 배포 영향도 (Deployment Impact)

🟡 **Medium Impact**

**영향도 분석:**
- Lambda 업데이트는 seamless (기존 실행중인 invocation 유지)
- Task Definition 변경 없음 → ECS 재배포 불필요
```

**Emoji Guide:**
- 🔴 **High Impact**: ECS 서비스 재배포 필요
- 🟡 **Medium Impact**: 서비스 중단 없이 리소스 업데이트
- 🟢 **Low Impact**: 메타데이터만 변경

### Target Environment and Feature Flag Analysis

**CRITICAL: Analyze each feature/change separately and mark YES/NO/NEVER for ALL three environments (개발/검증/운영).**

#### Per-Feature Environment Analysis Pattern

**Create a table with one row per feature/change, analyzing what that specific change does in each environment:**

```markdown
## 배포 대상 환경 (Target Environment)

**이 PR의 배포 대상:** 검증 (STAGING)

### 환경별 배포 영향 분석

| 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
|---------|------|------|------|----|----|
| SSM Parameter Store 마이그레이션 | ✅ YES | ❌ NO | ❌ NO | ✅ | `ssm-parameter-secrets: [dev, qa]`<br>검증/운영은 코드만 배포, 기능 비활성 |
| 태그 기반 QA 배포 | ✅ YES | ✅ YES | ✅ YES | ❌ | QA만 trigger 변경, 다른 환경은 코드만 추가 |
| 태그 기반 운영 배포 | ✅ YES | ✅ YES | ❌ NO | ❌ | 코드는 배포되지만 PROD는 향후 활성화 예정 |
| Cross-account SNS topic | ✅ YES | 🚫 NEVER | 🚫 NEVER | ❌ | DEV 계정 전용 리소스<br>다른 환경은 자체 SNS topic 사용 |
| Bug fix (API 오류) | ✅ YES | ✅ YES | ✅ YES | ❌ | 모든 환경 적용 |

> **참고:** FF = Feature Flag (기능 플래그)
```

**Table Structure:**

- **Rows**: One per feature/change (not per environment)
- **Columns**: 변경사항 | 개발 | 검증 | 운영 | FF | 사유
- **Cell Values**:
  - Environment columns: ✅ YES / ❌ NO / 🚫 NEVER
  - FF column: ✅ (has feature flag) / ❌ (no feature flag)

**Status Definitions:**

1. **✅ YES**: This change DOES deploy and activate in this environment
   - For 개발: Already deployed (direct push to master)
   - For 검증: Will deploy when PR merges
   - For 운영: Will deploy in future promotion (staging → prod)
   - Feature is active and functional

2. **❌ NO**: Code deploys but feature is DISABLED by feature flag
   - Code changes are present in the environment
   - Feature flag prevents activation
   - Example: SSM secrets construct exists but runtime uses Secrets Manager
   - This is intentional (prepares for future activation)

3. **🚫 NEVER**: This change will NEVER deploy to this environment
   - Environment-specific resources (e.g., DEV-only SNS topic)
   - Architectural differences between environments
   - Hard-coded environment restrictions
   - Example: Cross-account resources that only exist in one account

**When NOT to use the table:**
- Documentation-only changes (README, CLAUDE.md)
- Non-code changes with no runtime impact
- State: "문서화 변경으로 테이블 생략"

#### Feature Flag Analysis Steps

**Step 1: Find Feature Flags in Changes**

```bash
git diff origin/staging...origin/master -- feature-flags.yaml
```

**Step 2: Check Enabled Environments**

```yaml
feature-name:
  enabled: true
  environments:
    - dev
    - qa  # Note: QA is separate from DEV/STAGING/PROD
  description: "Feature description"
```

**Step 3: Analyze Each Feature Individually**

For each feature/change:
- List the feature name in leftmost column
- For EACH environment column (개발/스테이징/운영):
  - If feature flag enabled → ✅ YES
  - If feature flag disabled → ❌ NO (code deploys, feature inactive)
  - If architecturally impossible → 🚫 NEVER
  - If no feature flag → ✅ YES for all

**Step 4: Provide Rationale**

In the rightmost column, explain:
- Feature flag name and enabled environments
- Why NO (feature flag disabled)
- Why NEVER (architectural reason)
- If YES for all, state "Feature flag 없음, 모든 환경 적용"

#### Common Patterns

**Pattern 1: Feature Flag Gated (Gradual Rollout)**
```markdown
| SSM secrets | ✅ YES | ❌ NO | ❌ NO | `ssm-parameter-secrets: [dev, qa]` |
```
- DEV: Feature flag enabled → active
- STAGING/PROD: Code deployed, flag disabled → inactive

**Pattern 2: Universal Deploy (No Feature Flag)**
```markdown
| Bug fix | ✅ YES | ✅ YES | ✅ YES | Feature flag 없음, 모든 환경 적용 |
```
- All environments get the fix

**Pattern 3: Environment-Specific Resource (Never Deploy)**
```markdown
| DEV SNS topic | ✅ YES | 🚫 NEVER | 🚫 NEVER | DEV 계정 전용 리소스 |
```
- Only exists in DEV account architecture

**Pattern 4: Planned Future Activation**
```markdown
| New feature | ✅ YES | ✅ YES | ❌ NO | PROD는 향후 활성화 예정 |
```
- Code in all environments, but PROD feature flag not yet enabled

#### Important Notes

**Feature flags are NOT deployment gates:**
- Code ALWAYS deploys to target environment (STAGING or PROD)
- Feature flags only control RUNTIME behavior
- ❌ NO means "deployed but inactive", not "not deployed"
- This is correct and intentional (infrastructure ready for future activation)

**Common Mistakes:**

❌ **Wrong** - Missing environment analysis:
```markdown
| SSM secrets | ✅ YES | ❌ NO | | Missing PROD analysis! |
```

✅ **Correct** - All environments analyzed:
```markdown
| SSM secrets | ✅ YES | ❌ NO | ❌ NO | Complete analysis |
```

---

❌ **Wrong** - Using table for docs:
```markdown
| Update README | ✅ YES | ✅ YES | ✅ YES | Documentation |
```

✅ **Correct** - Skip table for non-code:
```markdown
문서화 변경 (README, CLAUDE.md 업데이트)으로 환경별 배포 영향 테이블 생략
```

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
            - 'lib/**/task-definition.ts'
            - 'lib/**/service/index.ts'
        medium:
            - 'lib/**/load-balancer.ts'
            - 'lib/**/cloudfront.ts'
        low:
            - '**/*.md'
            - '**/README*'

    # Automatically detect affected services based on file paths
    affected_services:
        auth: ['**/auth/**', '**/account-service/**']
        yozm: ['**/yozm/**', '**/yozm-service/**']
        support: ['**/support/**']

# Confidence thresholds
confidence:
    high: 80 # Fill out directly
    medium: 60 # Fill with explanation
    low: 40 # Suggest template update

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
2. Analyze: git diff stag...master and git log stag..master
3. Identify: Multiple commits (23), multiple types
   - Commits breakdown:
     * 8 feat commits (ESM migration, Lambda@Edge, PR tools)
     * 6 docs commits (CLAUDE.md, GIT_STRATEGY.md, etc.)
     * 4 fix commits (Docker Server, CodeBuild)
     * 3 chore commits (dependencies, config)
     * 2 refactor commits (config restructuring)
4. Determine dominant change type:
   - Most significant: ESM migration (feat)
   - New features: Lambda@Edge, PR tooling (feat)
   - Decision: Use "feat" for title (most impactful changes)
5. Fill template:
   - Title: "feat(infra): Migrate to ES Modules and add tooling improvements"
   - Type: feat, fix, refactor, chore, docs (multiple)
   - Target Environment: STAGING
   - Affected Services: (list all from commits)
   - Deployment Impact: High (ESM migration affects build)
   - Confidence: High (95%)
6. Generate detailed summary from commit history
7. Create PR: gh pr create --base stag --head master
8. Note: Requires review approval for STAGING

**Type Selection for Promotion PRs:**
- Analyze commit types: feat, fix, refactor, chore, docs
- Choose dominant/most significant type:
  * If major infrastructure change → feat(infra) or refactor(infra)
  * If mostly new features → feat
  * If mostly bug fixes → fix
  * If mixed with no clear dominant → feat (default for promotions)
- NEVER use "chore" for environment promotions
  * chore = maintenance tasks (deps, config tweaks)
  * Promotions contain actual features/fixes
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

## Common Mistakes in PR Title Selection

Based on real-world PR creation experience, here are the most common mistakes and how to avoid them:

### Mistake 1: Prioritizing by Commit Count

**❌ Wrong Approach:**
```bash
# Count commit types
6 chore commits
4 docs commits
2 feat commits

# Choose title based on count
Title: "chore: 개발 도구 개선"  # Because chore has most commits
```

**Why it's wrong:**
- Commit count measures volume, not importance
- Developer tools (chore) are often lowest priority for users
- Doesn't reflect actual business impact

**✅ Correct Approach:**
```bash
# Analyze by business impact
Runtime changes: Lambda notification localization (feat)
Infrastructure: Route53 RETAIN policy (feat)
Developer tools: Claude Code settings (chore)

# Choose title based on impact
Title: "feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선"
```

**Why it's right:**
- Runtime changes affect users directly
- Lambda notifications are user-facing
- Developer tools mentioned last or in summary

**Real example:** PR #226 had 6 chore commits but was titled `feat(lambda)` because Lambda changes had the most user impact.

### Mistake 2: Using Generic Terms

**❌ Generic Titles (Avoid):**
```
feat(infra): 인프라 개선
chore: 도구 개선
refactor: 코드 개선
docs: 문서화 개선
```

**Why they're bad:**
- "개선" (improvement) without context is meaningless
- Reader can't understand what changed
- Forces reading full description
- All PRs could have same title

**✅ Specific Titles (Use):**
```
feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선
feat(infra): Route53 hosted zone에 RETAIN 정책 추가로 DNS 보호
refactor(config): SSM Parameter Store 참조 방식을 직접 참조로 변경
docs(project): CloudFormation 스택 네이밍 규칙을 별도 문서로 분리
```

**Why they're good:**
- Concrete action: "한국어 현지화" (Korean localization)
- Specific component: "Route53 hosted zone"
- Clear benefit: "DNS 보호" (DNS protection)
- Measurable change: "별도 문서로 분리" (split into separate document)

**Test:** If title could apply to 10 different PRs, it's too generic.

### Mistake 3: Leading with Methodology Instead of Changes

**❌ Methodology First:**
```markdown
## Summary

점진적 배포: 개발 도구 개선 및 Lambda 현지화를 STAGING에 배포
(Incremental deployment: Deploy tool improvements and Lambda localization to STAGING)
```

**Why it's wrong:**
- Reader cares WHAT changed, not HOW it's deployed
- Methodology is secondary metadata
- Buries the actual changes

**✅ Changes First:**
```markdown
## Summary

**배포 파이프라인 Slack 알림을 한국어로 현지화하고 마크다운 포맷을 개선**합니다.

**주요 변경사항:**
- **Lambda 알림 현지화:** 환경 이름 한국어 번역
- **Slack 포맷 개선:** AWS Chatbot 마크다운 문법 적용
- **Route53 DNS 보호:** RETAIN 정책 추가
- **도구 개선:** Claude Code 설정, PR 템플릿

**배포 전략:** 점진적 배포 (16개 커밋)
```

**Why it's right:**
- Lead with actual changes (Lambda localization)
- Group related changes
- Methodology mentioned at end as metadata

### Mistake 4: Checking File Names Instead of Diff Content

**❌ Superficial Analysis:**
```bash
# Check changed files only
git diff origin/staging..origin/master --name-only

lib/constructs/service/task-definition.ts   # Changed!
src/config/config.data.ts                   # Changed!

# Conclude: High Impact (task definition changed)
```

**Why it's wrong:**
- File name doesn't tell what changed
- Could be import path change (low impact)
- Could be comment change (no impact)
- Could be actual CPU/memory change (high impact)

**✅ Deep Analysis:**
```bash
# Check ACTUAL changes
git diff origin/staging..origin/master -- lib/constructs/service/task-definition.ts

# If output shows:
# - import { FargateCpu } from './fargate-cpu'
# + import { FargateCpu } from '../../../src/config/types/fargate'

# This is LOW IMPACT (import path only, no value changes)

# If output shows:
# - cpu: FargateCpu.CPU_256
# + cpu: FargateCpu.CPU_512

# This is HIGH IMPACT (actual CPU value changed)
```

**Why it's right:**
- Checks actual diff content
- Identifies value changes vs. structural changes
- Prevents false high-impact assessments

**Rule:** Always run `git diff <base>..<head> -- <file>` before determining impact.

### Mistake 5: Prioritizing Documentation/Tooling Over Runtime

**❌ Wrong Priority:**
```
Title: "chore(tools): Add Claude Code settings and improve Lambda notifications"
```

**Why it's wrong:**
- Leads with tools (developer-facing)
- Lambda notifications are user-facing but mentioned second
- Tools are lowest priority for users

**✅ Correct Priority:**
```
Title: "feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선"

Summary:
- Lambda notifications (runtime)
- Route53 DNS protection (infrastructure safety)
- QA environment optimization (configuration)
- SSM refactoring (code quality)
- Tools and documentation (developer experience) ← Last
```

**Why it's right:**
- Runtime changes first
- Infrastructure safety second
- Developer tools last
- Clear hierarchy of importance

**Priority hierarchy:**
1. Runtime/User-Facing (Lambda notifications)
2. Infrastructure Safety (Route53 RETAIN)
3. Configuration (QA environment)
4. Code Quality (SSM refactoring)
5. Developer Tools (Claude Code, git hooks)
6. Documentation (README, CLAUDE.md)

### Quick Decision Tree for PR Titles

```
┌─ Has runtime/service changes? (Lambda, API, DB)
│  ├─ YES → Use that in title (highest priority)
│  └─ NO → Check next level
│
├─ Has infrastructure safety changes? (RETAIN, backup, DNS)
│  ├─ YES → Use that in title (high priority)
│  └─ NO → Check next level
│
├─ Has architecture/migration changes? (refactoring, new patterns)
│  ├─ YES → Use that in title (medium priority)
│  └─ NO → Check next level
│
├─ Has configuration changes? (QA, feature flags)
│  ├─ YES → Use that in title (medium priority)
│  └─ NO → Check next level
│
└─ Only developer tools/docs? (git hooks, README)
   └─ Use that in title (lowest priority, but be specific)
```

### Example Application

**Scenario:** 16 commits promoting master → staging
- 6 chore (Claude Code, git hooks, submodules)
- 4 docs (CLAUDE.md, CloudFormation naming)
- 2 feat (Lambda localization, Route53 RETAIN)
- 2 fix (Slack markdown, pre-push hook)
- 2 refactor (QA simplification, SSM)

**Decision process:**
```
Step 1: Runtime changes?
→ YES: Lambda notification localization (Korean + Slack markdown)

Step 2: Is it user-facing?
→ YES: Deployment pipeline notifications visible to team

Step 3: Type?
→ feat (new Korean translations)

Step 4: Scope?
→ lambda (specific component)

Step 5: Specific description?
→ "배포 알림 한국어 현지화 및 Slack 포맷 개선"
  (Deployment notification Korean localization and Slack format improvement)

Final Title:
→ "feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선"
```

**Why NOT:**
- ❌ "chore: 개발 도구 개선" (tools have most commits, but lowest impact)
- ❌ "feat(lambda): 알림 현지화 및 인프라 개선" ("인프라 개선" too generic)
- ❌ "feat: Lambda 및 도구 개선" (tools shouldn't be in title)

### Summary: Don't Optimize for the Wrong Thing

**Wrong optimization:**
- Commit count (easy to measure, doesn't matter)
- File count (easy to measure, doesn't matter)
- Lines changed (easy to measure, doesn't matter)

**Right optimization:**
- Business impact (harder to assess, but matters)
- User-facing changes (runtime > tools)
- Specificity (concrete > generic)

**The question to answer:**
- ❌ "How many commits were about tools?" (wrong question)
- ✅ "What changed in production that users will notice?" (right question)

---

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

- [Conventional Commits Skill](../conventional-commits/SKILL.md) - For commit message generation
- [GitHub PR Template Best Practices](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- Project-specific: `.github/pr-guidelines/` (if exists)
