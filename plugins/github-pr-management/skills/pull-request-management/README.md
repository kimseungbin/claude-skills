# Pull Request Management Skill

## Overview

This skill helps create, review, and manage pull requests across different projects with confidence-based decision making. It fills out PR templates intelligently, suggests improvements when uncertain, and ensures compliance with project conventions.

**When to use:**
- User requests to create a PR
- User needs help filling out PR description
- User asks about PR best practices

**Invoke:** `/create-pr` command or `Skill(pull-request-management)`

## Quick Reference

### Checkbox Alternatives

Checkboxes are for task lists, not for selecting single options. Use these patterns instead:

| Use Case | Instead of Checkbox | Use |
|----------|-------------------|-----|
| **Single selection** | `- [x] Option A` | Direct statement: `**Field:** Value` |
| **Yes/No** | `- [x] Yes` | Emoji: `**Field:** ✅ Yes` or `❌ No` |
| **Impact levels** | `- [x] Low` | Emoji header: `🟢 **Low Impact**` |
| **Multiple types** | `- [x] feat`<br>`- [x] fix` | Listed: `♻️ refactor`<br>`🎉 feat` |
| **Environment** | `- [x] STAGING` | Direct text with table for feature flag analysis |
| **Breaking** | `- [x] Breaking` | Conditional: `⚠️ 있음` with details OR `✅ 없음` |

### Visual Hierarchy Tips

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

### Emoji Guide

**Deployment Impact:**
- 🔴 High Impact: ECS service redeployment required
- 🟡 Medium Impact: Resource updates, no downtime
- 🟢 Low Impact: Metadata only

**Breaking Changes (REVERSED for UX):**
- ✅ (green checkmark) = Good news, safe to proceed, no breaking changes
- ⚠️ (warning sign) = Danger, requires attention, has breaking changes

Rationale: Readers should feel relief when they see ✅, concern when they see ⚠️

**Environment Analysis:**
- ✅ YES: Change deploys and activates in this environment
- ❌ NO: Code deploys but feature is disabled by feature flag
- 🚫 NEVER: Change will never deploy to this environment (architectural restriction)

**Change Types:**
- ♻️ refactor (recycling symbol for restructuring)
- 📝 docs (memo for documentation)
- 🔧 chore (wrench for maintenance)
- 🎉 feat (party popper for new features)
- 🐛 fix (bug for bug fixes)
- 🤖 ci (robot for automation)

## Common Mistakes to Avoid

### Mistake 1: Prioritizing by Commit Count

**❌ Wrong:** Choose PR title based on which type has most commits

```bash
6 chore commits → Title: "chore: 개발 도구 개선"
```

**✅ Correct:** Choose based on business impact, not volume

```bash
Runtime changes (2 feat) → Title: "feat(lambda): 배포 알림 한국어 현지화"
```

**Why:** Commit count measures volume, not importance. Runtime changes affect users directly.

**Real-world example (PR #226):** Had 6 chore commits (tools) and 2 feat commits (Lambda notifications). Correct title: `feat(lambda): 배포 알림 한국어 현지화` - leading with runtime changes, not tools.

### Mistake 2: Using Generic Titles

**❌ Generic (avoid):**
```
docs(project): Improve documentation
chore: Maintenance tasks
```

**✅ Specific (use):**
```
docs(project): Mark Slack integration complete and add 9 features to backlog
feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선
```

**Test:** If title could apply to 10 different PRs, it's too generic.

### Mistake 3: Leading with Methodology Instead of Changes

**❌ Methodology first:**
```
점진적 배포: 개발 도구 개선 및 Lambda 현지화를 STAGING에 배포
```

**✅ Changes first:**
```
**배포 파이프라인 Slack 알림을 한국어로 현지화하고 마크다운 포맷을 개선**합니다.

**배포 전략:** 점진적 배포 (16개 커밋)
```

Readers care WHAT changed, not HOW it's deployed.

### Mistake 4: Checking File Names Instead of Diff Content

**❌ Superficial:**
```bash
git diff --name-only  # task-definition.ts changed → High Impact!
```

**✅ Deep analysis:**
```bash
git diff -- lib/constructs/service/task-definition.ts
# Check if import path changed (low) or CPU value changed (high)
```

**Rule:** Always run `git diff <base>..<head> -- <file>` before determining impact.

### Mistake 5: Prioritizing Documentation/Tooling Over Runtime

**Priority hierarchy:**
1. Runtime/User-Facing (Lambda notifications, API changes)
2. Infrastructure Safety (Route53 RETAIN, backup policies)
3. Architecture/Migration (refactoring, new patterns)
4. Configuration (QA environment, feature flags)
5. Developer Tools (Claude Code, git hooks)
6. Documentation (README, CLAUDE.md)

Lead with highest priority changes in PR title and summary.

## Quick Decision Tree for PR Titles

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

## Project-Specific Customization

### Writing Style Configuration

Projects can define localization and writing conventions in `.claude/config/pull-request-writing-style.md`.

**Example:** This project (fe-infra) uses Korean PR conventions. See [.claude/config/pull-request-writing-style.md](../../config/pull-request-writing-style.md) for:
- Language patterns (Korean body, English technical terms)
- Environment analysis table format
- Feature flag analysis methodology
- Technical term conventions (backticks for code identifiers)

### Config File Pattern (Optional)

For AI-specific PR assistance rules, projects can create `.claude/config/pull-request-management.yaml`:

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

    affected_services:
        auth: ['**/auth/**', '**/account-service/**']
        yozm: ['**/yozm/**', '**/yozm-service/**']

# Confidence thresholds
confidence:
    high: 80 # Fill out directly
    medium: 60 # Fill with explanation
    low: 40 # Suggest template update

# Required checks before PR creation
# Note: lint is NOT included - enforced by pre-push hook and GitHub Actions
pre_flight_checks:
    - npm run build
    - npm run cdk synth
```

## Example

**PR Template for IaC & Environment Promotion:**
- [pr-template-iac-example.md](examples/pr-template-iac-example.md) - Comprehensive PR template optimized for Infrastructure as Code and environment promotion workflows (CDK/CloudFormation)

## See Also

- [Conventional Commits Skill](../conventional-commits/) - For commit message generation
- [GitHub PR Template Best Practices](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- Project-specific: `.github/pr-guidelines/` (if exists)
- Writing style: `.claude/config/pull-request-writing-style.md` (project-specific)