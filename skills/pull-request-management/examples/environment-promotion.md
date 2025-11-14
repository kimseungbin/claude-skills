# Example: Environment Promotion PR (master → staging)

## Scenario

Promoting 6 commits from master to staging, including Profile service migration, CloudFront improvements, and tooling updates.

## Analysis

```bash
# Commits breakdown
git log origin/staging..origin/master --oneline

2c275b5 refactor(main): Unify service deployment control via matrix (ARCH-14)
f7a8997 feat(main): Implement Profile service migration with custom domain control
4c23684 refactor(service): Extract ServiceInfra and ServiceApp constructs (ARCH-14)
5c6e87c feat(cloudfront): Add optional custom domain control for CloudFront
c2e99e2 chore(deps): Update CDK to v2.1031.2 for refactor support
5fd45ab chore(tools): Update cdk-expert skill with cdk refactor guidance

# Commit types
- 2 refactor (Profile migration architecture)
- 2 feat (Profile migration features, CloudFront custom domain)
- 2 chore (CDK update, tooling)

# Deployment impact check
git diff origin/staging..origin/master -- lib/constructs/service/task-definition.ts src/config/config.data.ts
# (No output = no task definition or config changes)
```

## PR Title Selection

**Analysis:**
- **Most impactful:** Profile service architecture migration (ARCH-14)
- **Type:** refactor (architectural improvement)
- **Scope:** profile (specific service)

**Selected:** `refactor(profile): Migrate Profile service to mid-level constructs (ARCH-14)`

**Why:**
- Leads with runtime change (Profile service migration)
- refactor = architectural improvement without behavior change
- Specific scope (profile) over generic (infra)
- References architecture decision (ARCH-14)

**Alternatives considered:**
- ❌ `feat(infra): Add mid-level constructs` - Too generic, misses main point
- ❌ `refactor(infra): Extract service constructs` - Doesn't highlight Profile migration
- ❌ `chore: Update CDK and migrate Profile` - Wrong type, chore = maintenance

## PR Description (Selected Sections)

### 변경 사항 요약 (Summary)

**✅ Good: Nested structure with categories**

```markdown
- **Profile 서비스 아키텍처 개선 (ARCH-14)**
  - ServiceInfraConstruct 및 ServiceAppConstruct mid-level constructs 추출
  - ProfileServiceV2 생성: 새로운 constructs 사용하여 Profile 서비스 재구성
  - DEV/QA 환경에서 Profile 서비스가 새로운 구조 사용

- **CloudFront Custom Domain 제어**
  - `customDomain` 플래그 추가하여 ACM 인증서/DNS 레코드 생성 제어
  - DEV: `customDomain: false` (빠른 배포를 위해 *.cloudfront.net 사용)
  - QA: `customDomain: true` (Route53 delegation 사용)

- **개발자 도구**
  - CDK를 v2.1031.2로 업데이트 (refactor 명령 지원)
  - cdk-expert skill에 리팩토링 가이드 추가
```

**Why it's good:**
- Groups related changes under bold category headers
- Two-level hierarchy (easy to scan)
- Ordered by importance (Profile migration first, tools last)

### 변경 유형 (Type of Change)

**❌ Bad: Using checkboxes**
```markdown
- [ ] feat
- [x] refactor
- [ ] fix
- [ ] chore
```

**✅ Good: Direct statement with emoji**
```markdown
♻️ refactor: 리팩토링 (Profile 서비스 아키텍처 개선)
🎉 feat: 새로운 기능 (CloudFront custom domain 제어)
🔧 chore: 유지보수 (CDK 업데이트, 도구 개선)
```

**Why it's better:**
- No false sense of "only one type" (this PR has multiple)
- Clear visual hierarchy with emojis
- Shows all relevant types, not forced single choice

### 배포 영향도 (Deployment Impact)

**❌ Bad: Checkbox-only with minimal reasoning**
```markdown
- [ ] High Impact
- [ ] Medium Impact
- [x] Low Impact

Reasoning: Refactoring only
```

**✅ Good: Emoji + detailed analysis**
```markdown
🟢 **Low Impact**

**영향도 분석:**

- 🟢 Low Impact: 코드 리팩토링 및 아키텍처 개선
  - Profile 서비스가 새로운 construct 구조 사용 (ProfileServiceV2)
  - DEV/QA 환경만 영향 (STAGING/PROD는 기존 Service construct 사용)
  - Task Definition, 환경 변수, 리소스 설정 변경 없음
  - **중요:** STAGING/PROD는 아직 기존 코드 사용 (안전한 점진적 마이그레이션)

**git diff 확인:**
\`\`\`bash
# Task Definition 및 Config 변경사항 없음 확인
git diff origin/staging..origin/master -- lib/constructs/service/task-definition.ts src/config/config.data.ts
# (출력 없음 = 변경 없음)
\`\`\`
```

**Why it's better:**
- Visual emoji (🟢/🟡/🔴) provides instant understanding
- Detailed file-level analysis with commit hashes
- Shows verification command for reviewers
- Explains WHY it's low impact (STAGING/PROD unchanged)

### 배포 대상 환경 (Target Environment)

**❌ Bad: Checkboxes for mutually exclusive options**
```markdown
- [ ] DEV (from `master` branch)
- [x] STAGING (from `stag` branch)
- [ ] PRODUCTION (from `prod` branch)
```

**Problem:** Only ONE can be true, checkboxes suggest multiple choices

**✅ Good: Direct statement or labeled value**
```markdown
**배포 대상 환경:** STAGING (from `staging` branch)

**참고:**
- DEV 환경은 이미 master 브랜치로 배포 완료
- STAGING 배포 시 Profile 서비스는 기존 Service construct 사용
- QA 환경으로의 추가 변경사항 포함
```

**Alternative: Badge format**
```markdown
**Target:** ![STAGING](https://img.shields.io/badge/env-STAGING-yellow)

From: `master` → To: `staging`
```

**Why it's better:**
- No false "multi-select" implication
- Can provide additional context
- Cleaner visual appearance

### Breaking Changes

**❌ Bad: Checkbox with repetitive section**
```markdown
## Breaking Changes

- [ ] 이 PR은 Breaking Change를 포함합니다

**Breaking Change 상세:**
<!-- 무엇이 호환되지 않는지... -->
```

**Problem:** Extra section when answer is "No"

**✅ Good: Conditional formatting**
```markdown
**Breaking Change:** ❌ No

**참고:**
- 이번 PR은 코드 리팩토링만 포함
- STAGING/PROD는 기존 구조 유지 (안전한 점진적 마이그레이션)
- DEV/QA에서 충분히 검증 후 다음 단계로 진행 예정
```

**If breaking:**
```markdown
**Breaking Change:** ⚠️ Yes

**변경 사항:**
- API endpoint `/v1/users` → `/v2/users` (버전 업그레이드)
- 응답 필드 `created_at` → `createdAt` (camelCase 통일)

**마이그레이션 가이드:**
1. Frontend: API 버전을 v2로 업데이트
2. 날짜 필드명 변경 (snake_case → camelCase)
3. 배포 순서: Backend → Frontend (순차 배포 필수)
```

**Why it's better:**
- Uses emoji for quick visual scan (❌/⚠️)
- No checkbox needed (yes/no is direct answer)
- Only shows details when relevant (breaking = yes)

## Skill Lessons

### 1. Checkbox Alternatives

| Use Case | Instead of Checkboxes | Use |
|----------|----------------------|-----|
| **Single selection** (environment, impact) | `- [x] Option A` | Direct statement: `**Environment:** STAGING` |
| **Yes/No** (breaking change) | `- [x] Yes` | Emoji + text: `**Breaking:** ❌ No` or `⚠️ Yes` |
| **Multiple categories** (change types) | `- [x] feat`<br>`- [x] refactor` | Listed with emojis: `♻️ refactor`<br>`🎉 feat` |
| **Impact levels** | `- [x] Low Impact` | Emoji header: `🟢 **Low Impact**` + detailed analysis |

### 2. When Checkboxes Are Appropriate

**✅ Use checkboxes for:**
- Task lists (verification steps)
- Pre-deployment checks
- Post-deployment validation

**Example:**
```markdown
## 배포 전 테스트

- [x] `npm run lint:check` 통과
- [x] `npm run build` 성공
- [x] `npm run cdk synth` 성공
- [ ] CloudFormation Change Set 검토 완료
```

**Why:** These are actual TODO items that need completion

### 3. Visual Hierarchy Tips

1. **Use emojis for instant recognition**
   - 🟢 Low / 🟡 Medium / 🔴 High (traffic light)
   - ✅ Complete / ⏳ In Progress / ❌ Not Started
   - ⚠️ Warning / 🚨 Critical / ℹ️ Info

2. **Use bold for single-choice selections**
   - `**Impact:** 🟢 Low` (not checkbox)
   - `**Type:** ♻️ refactor` (not checkbox)

3. **Use nested bullets for grouping**
   - Category (bold)
     - Item 1
     - Item 2

4. **Use blockquotes for important notes**
   ```markdown
   > **중요:** STAGING/PROD는 기존 구조 유지
   ```

## Full Example PR Description

See [full-pr-example.md](./full-pr-example.md) for complete formatted PR.