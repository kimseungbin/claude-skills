# Example: PR #226 - Lambda Notification Localization

Real-world example demonstrating proper PR title selection and prioritization by business impact.

## Scenario

**Context:** Promoting 16 commits from master to staging
**PR:** https://github.com/wishket/fe-infra/pull/226
**Date:** 2025-11-18

## Initial Mistake: Prioritizing by Commit Count

### ❌ First Attempt (REJECTED)

**Title:** `chore: 개발 도구 및 QA 환경 개선`

**Analysis:**
```bash
# Commit type counts
6 chore   # Most commits
4 docs
2 refactor
2 fix
2 feat
```

**Why rejected:**
- Chose "chore" because it had the most commits (6)
- Led with "개발 도구" (development tools)
- **Problem:** Development tools are LEAST important to users
- **Mistake:** Optimized for what's easy to measure (commit count) instead of business impact

**User feedback:** *"Difference in Claude Code is the least important changes. Choosing this as the first part of the title is a mistake."*

## Second Mistake: Generic Terminology

### ❌ Second Attempt (REJECTED)

**Title:** `feat(lambda): 알림 현지화 및 인프라 개선`

**Why rejected:**
- "인프라 개선" (infrastructure improvement) is too generic
- Tells the reader nothing concrete
- No specificity about what was improved

**User feedback:** *"'인프라 개선' is the best example I can give you for the worst title. It gives reader nothing."*

## Correct Approach: Prioritize by Runtime Impact

### ✅ Final Version (ACCEPTED)

**Title:** `feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선`

**Why this works:**
- Specific: "배포 알림 한국어 현지화" (deployment notification Korean localization)
- Specific: "Slack 포맷 개선" (Slack format improvement)
- Runtime change: Affects user-facing notifications
- Concrete: Reader knows exactly what changed

## Business Impact Analysis

### Commit Breakdown by Impact

**1. Runtime/Service Changes (HIGHEST PRIORITY)**
```
4eafae7 feat(lambda): Add Korean environment name translations to notifications
571ae37 fix(lambda): Use Slack markdown syntax for AWS Chatbot notifications
a236e10 chore(deployment): Enable STAGING/PROD pipeline notifications
```
- **Impact:** User-facing Slack notifications
- **Changes:** Korean translation, markdown formatting, STAGING/PROD alerts
- **Scope:** All deployment pipelines

**2. Infrastructure Safety (HIGH PRIORITY)**
```
897641e feat(infra): Add RETAIN policy and import mode for Route53
cf02309 refactor(config): Change SSM construct to reference existing parameters
```
- **Impact:** DNS protection, deployment simplification
- **Changes:** Route53 RETAIN, SSM parameter references

**3. Environment Configuration (MEDIUM PRIORITY)**
```
f3d9ad8 refactor(config): Simplify QA service deployment to yozm only
```
- **Impact:** QA environment only
- **Changes:** Profile/Auth → Yozm

**4. Developer Tools (LOWEST PRIORITY)**
```
b8aca8c chore(tools): Add Claude Code settings
68fe400 chore(tools): Update claude-skills submodule
c39ffd3 chore(github): Improve PR template with environment analysis
92899b2 chore(tools): Update claude-skills with Korean PR conventions
cb9e351 chore(github): Remove deprecated deploy workflow
0ab1ab2 fix(tools): Fix pre-push hook branch detection and consolidate hooks
```
- **Impact:** Developer experience only
- **Changes:** Claude Code, git hooks, PR templates

**5. Documentation (LOWEST PRIORITY)**
```
88118b7 docs(project): Update SSM parameter setup workflow
0d2b405 docs(project): Add TOOLS-01 refactoring task for lint hook reorganization
a84746b docs(project): Move CloudFormation stack naming to dedicated docs file
9eb7f27 docs(project): Add git-hooks-setup skill to CLAUDE.md
```
- **Impact:** None (documentation only)
- **Changes:** CLAUDE.md, docs/*

### PR Title Selection Process

**Step 1: Identify Runtime Changes**
- Lambda notification changes (Korean + Slack markdown)
- STAGING/PROD pipeline notifications enabled
- These affect user-facing output

**Step 2: Determine Type**
- Lambda code changes = `feat` (new Korean translations)
- Slack formatting fix = `fix` (but part of larger feat)
- Primary type: `feat`

**Step 3: Determine Scope**
- `lambda` (specific component)
- NOT `infra` (too generic)
- NOT `tools` (developer-facing, not user-facing)

**Step 4: Write Specific Description**
- ❌ "알림 개선" (notification improvement) - too vague
- ✅ "배포 알림 한국어 현지화" (deployment notification Korean localization) - specific
- ✅ "Slack 포맷 개선" (Slack format improvement) - concrete

**Final Title:**
```
feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선
```

## PR Summary Structure

### Summary Section (Nested by Priority)

```markdown
## 변경 사항 요약 (Summary)

**배포 파이프라인 Slack 알림을 한국어로 현지화하고 마크다운 포맷을 개선**합니다.

**주요 변경사항:**
- **Lambda 알림 현지화:** 환경 이름 한국어 번역 (DEV → 개발, STAGING → 검증, PRODUCTION → 운영)
- **Slack 포맷 개선:** AWS Chatbot 마크다운 문법 적용으로 링크 및 볼드 정상 렌더링
- **Route53 DNS 보호:** RETAIN 정책으로 Stack 삭제 시 hosted zone 보호
- **QA 환경 최적화:** Profile/Auth → Yozm 서비스로 단순화
- **SSM 리팩토링:** Parameter Store 참조 방식 개선
- **도구 개선:** Claude Code 설정, PR 템플릿, git hooks 통합
```

**Why this works:**
1. Lead sentence: What is being deployed (Korean localization + Slack formatting)
2. Ordered by impact: Lambda → Infrastructure → QA → SSM → Tools
3. Each bullet is specific and concrete
4. Tools listed last (lowest priority)

## Deployment Impact Analysis

### Impact Level: Medium (Not Low)

**Analysis:**
```markdown
🟡 **Medium Impact**

**영향도 분석:**
- 🟡 Medium Impact: `packages/lambda/message-transformer/src/index.ts` 업데이트
  - Lambda 함수 코드 변경 (한국어 번역, Slack 마크다운)
  - 기존 알림 동작 유지, 메시지 포맷만 개선
  - Lambda seamless 업데이트 (기존 invocation 유지)
  - STAGING/PROD 배포 파이프라인 알림에 영향
- 🟢 Low Impact: 기타 변경사항
  - Route53 RETAIN: 코드 추가만, 신규 배포 없음
  - QA feature flag: 별도 태그 배포, STAGING 무관
  - SSM: 참조 방식만 변경, 값 동일
  - 도구/문서: 런타임 영향 없음
```

**Why Medium, not Low:**
- Lambda function code changes (runtime)
- User-facing notification changes
- STAGING/PROD pipeline notifications newly enabled

**Why not High:**
- Lambda updates are seamless
- No ECS task definition changes
- No service redeployment required

## Environment Analysis Table

```markdown
| 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
|---------|------|------|------|----|----|
| Lambda 알림 현지화 | ✅ YES | ✅ YES | ✅ YES | ❌ | 한국어 환경 이름 및 Slack 마크다운<br>모든 배포 파이프라인 알림에 적용 |
| STAGING/PROD 알림 활성화 | 🚫 NEVER | ✅ YES | ❌ NO | ❌ | SNS topic 연결 (4eafae7, a236e10)<br>검증 환경만 알림 전송 시작 |
| Route53 RETAIN 정책 | ✅ YES | ✅ YES | ✅ YES | ❌ | 코드 변경 (QA만 사용)<br>STAGING/PROD는 수동 인증서 |
| QA 환경 단순화 | ✅ YES | 🚫 NEVER | 🚫 NEVER | ✅ | `service-deployment.qa`<br>Profile/Auth → Yozm 변경 |
| SSM 참조 방식 변경 | ✅ YES | 🚫 NEVER | 🚫 NEVER | ✅ | `ssm-parameter-secrets: [dev, qa]`<br>STAGING/PROD는 Secrets Manager |
| 도구 및 문서 | ✅ YES | ✅ YES | ✅ YES | ❌ | `.claude/*`, `.githooks/*`, `docs/*`<br>런타임 영향 없음 |
```

**Key Insights:**
- STAGING/PROD notifications: First time enabled (🚫 NEVER → ✅ YES for STAGING)
- QA changes don't affect STAGING (separate tag deployment)
- Most changes are universal or DEV/QA only

## Key Lessons Learned

### 1. Don't Optimize for Commit Count

**Wrong approach:**
```
6 chore commits → Use "chore" in title
```

**Right approach:**
```
Identify runtime changes → Prioritize those in title
```

### 2. Avoid Generic Terms

**Generic (bad):**
- "인프라 개선" (infrastructure improvement)
- "도구 개선" (tool improvement)
- "환경 개선" (environment improvement)

**Specific (good):**
- "Route53 RETAIN 정책" (Route53 RETAIN policy)
- "배포 알림 한국어 현지화" (deployment notification Korean localization)
- "QA 환경을 Yozm 서비스로 단순화" (simplify QA environment to Yozm service)

### 3. Lead with What, Not How

**Wrong (methodology first):**
```
점진적 배포: 개발 도구 및 Lambda 현지화
(Incremental deployment: development tools and Lambda localization)
```

**Right (changes first):**
```
배포 알림 한국어 현지화 및 Slack 포맷 개선
(Deployment notification Korean localization and Slack format improvement)

배포 전략: 점진적 배포 (16개 커밋)
(Deployment strategy: Incremental deployment (16 commits))
```

### 4. Prioritization Hierarchy

When analyzing commits for PR titles:

1. **Runtime/User-Facing** → Always prioritize
2. **Infrastructure Safety** → Second priority
3. **Configuration** → Third priority
4. **Developer Tools** → Lowest priority
5. **Documentation** → Lowest priority

### 5. Be Specific in Titles

Reader should understand the change from title alone:

- ✅ "배포 알림 한국어 현지화" - Knows Korean translation was added
- ❌ "알림 개선" - Doesn't know what was improved
- ✅ "Slack 포맷 개선" - Knows formatting changed
- ❌ "포맷 변경" - Doesn't know what format or why

## Comparison Summary

| Aspect | First Attempt | Second Attempt | Final (Correct) |
|--------|---------------|----------------|-----------------|
| **Title** | chore: 개발 도구 및 QA 환경 개선 | feat(lambda): 알림 현지화 및 인프라 개선 | feat(lambda): 배포 알림 한국어 현지화 및 Slack 포맷 개선 |
| **Type** | chore (wrong) | feat (correct) | feat (correct) |
| **Scope** | tools (low priority) | lambda (correct) | lambda (correct) |
| **Specificity** | Generic | Partially generic | Fully specific |
| **Priority** | By commit count | By importance (partial) | By runtime impact |
| **Problem** | Claude Code least important | "인프라 개선" too vague | ✅ Clear and actionable |

## Takeaway

**Don't optimize for what's easy to measure (commit counts, file changes).**
**Optimize for what matters to the reader (business impact, runtime changes).**

Reader's question when seeing PR:
- ❌ "How many commits?" (doesn't matter)
- ❌ "What type had most commits?" (doesn't matter)
- ✅ **"What changed in production?"** (this matters)

Always answer the question that matters.