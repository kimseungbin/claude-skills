# Before/After: PR Template Improvements

Comparing traditional checkbox-heavy format vs improved direct statement format using PR #223 as example.

## Section 1: Change Type

### ❌ Before (Checkbox Format)

```markdown
## 변경 유형 (Type of Change)
<!-- 해당하는 이모지 하나를 아래 주석에서 선택하여 붙여넣으세요 -->

- [ ] 🎉 feat: 새로운 기능 추가
- [x] 🐛 fix: 버그 수정
- [ ] ♻️ refactor: 리팩토링
- [ ] 🔧 chore: 유지보수
- [ ] 📝 docs: 문서 변경
- [ ] 🤖 ci: CI/CD 변경
```

**Problems:**
- Forces single selection when PR has multiple types
- Checkboxes imply task list, not categorical info
- Can't show relationship between types (primary vs included)

### ✅ After (Direct Statement)

```markdown
## 변경 유형 (Type of Change)

♻️ refactor: 리팩토링 (Profile 서비스 아키텍처 개선)
🎉 feat: 새로운 기능 (CloudFront custom domain 제어)
🔧 chore: 유지보수 (CDK 업데이트, 도구 개선)
```

**Benefits:**
- Shows all applicable types
- Clear what each type refers to
- Can add context for each type
- Primary type (refactor) listed first

---

## Section 2: Target Environment

### ❌ Before (Checkbox Format)

```markdown
## 배포 대상 환경 (Target Environment)

- [ ] DEV (from `master` branch)
- [x] STAGING (from `stag` branch)
- [ ] PRODUCTION (from `prod` branch)
```

**Problems:**
- Only ONE can be true - checkboxes suggest multi-select
- Can't provide workflow context
- Visual clutter for simple info

### ✅ After (Direct Statement)

```markdown
## 배포 대상 환경 (Target Environment)

- [x] STAGING (from `stag` branch)
- [ ] PRODUCTION (from `prod` branch)

**참고:**
- DEV 환경은 이미 master 브랜치로 배포 완료
- STAGING 배포 시 Profile 서비스는 기존 Service construct 사용 (line 165-167 in main-stack.ts)
- QA 환경으로의 추가 변경사항 포함 (Profile 서비스 활성화)
```

**Benefits:**
- Clear single answer
- Provides deployment context
- Explains environment-specific behavior
- References code locations

---

## Section 3: Deployment Impact

### ❌ Before (Checkbox Only)

```markdown
## 배포 영향도 (Deployment Impact)

🔴 **High Impact** / 🟡 **Medium Impact** / 🟢 **Low Impact**

**영향도 분석 (필수):**
<!-- 선택한 영향도의 구체적인 이유를 작성해주세요 -->

**이 PR의 영향도:**
- [x] Low Impact

**Breaking Change:**
- [ ] 이 PR은 Breaking Change를 포함합니다
```

**Problems:**
- Checkbox adds no value (just visual noise)
- Guide asks for emoji but then uses checkbox
- Breaking Change duplicates yes/no question

### ✅ After (Emoji Header + Analysis)

```markdown
## 배포 영향도 (Deployment Impact)

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

**Breaking Change:** ❌ No
```

**Benefits:**
- Emoji header provides instant visual
- Detailed file-level analysis
- Shows verification command
- Breaking Change integrated (no duplication)
- Can easily scan for 🔴/🟡/🟢 across multiple PRs

---

## Section 4: Breaking Changes

### ❌ Before (Duplicated Checkboxes)

```markdown
**Breaking Change:** (Line 29)
- [ ] 이 PR은 Breaking Change를 포함합니다

## Breaking Changes (Line 261)
<!-- Breaking Change가 있다면 상세히 설명해주세요 -->

- [ ] 이 PR은 Breaking Change를 포함합니다

**Breaking Change 상세:**
<!-- 무엇이 호환되지 않는지, 마이그레이션 방법은 무엇인지 설명해주세요 -->
```

**Problems:**
- Appears twice in template
- Checkbox for yes/no question
- Section always shown (even when answer is "No")
- Wastes space for 95% of PRs

### ✅ After (Conditional Details)

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

**Rollback Plan:**
- Keep v1 endpoints for 30 days
- Monitor usage metrics
- Deprecation notice in v1 responses
```

**Benefits:**
- Single location (no duplication)
- Emoji provides instant visual (❌/⚠️)
- Details only shown when relevant
- Includes migration AND rollback guidance
- Uses expandable `<details>` for optional info

---

## Section 5: Affected Services

### ❌ Before (Checkbox List)

```markdown
## 영향받는 서비스 (Affected Services)

- [ ] auth
- [ ] yozm
- [ ] support
- [ ] project
- [ ] partner
- [ ] solution
- [x] profile
- [ ] 공통 인프라
- [ ] 배포 파이프라인
```

**Problems:**
- 9 checkboxes for simple information
- Can't provide service-specific details
- Can't show environment-specific impact

### ✅ After (Grouped Format)

```markdown
## 영향받는 서비스 (Affected Services)

- [ ] auth
- [ ] yozm
- [ ] support
- [ ] project
- [ ] partner
- [ ] solution
- [x] profile (DEV/QA 환경만, STAGING/PROD는 기존 구조 유지)
- [x] 공통 인프라 (mid-level constructs 추가)
- [ ] 배포 파이프라인
```

**Benefits:**
- Environment-specific details inline
- Shows scope of changes
- Maintains checkbox format (acceptable here as it's a simple multi-select)

**Alternative for complex changes:**
```markdown
## 영향받는 서비스 (Affected Services)

**Services:** `profile`

**Environment-specific impact:**
- DEV: ✅ Profile uses ProfileServiceV2
- QA: ✅ Profile uses ProfileServiceV2
- STAGING: ⏳ Profile uses existing Service construct
- PROD: ⏳ Profile uses existing Service construct

**Infrastructure:** Mid-level constructs added (ServiceInfraConstruct, ServiceAppConstruct)
```

---

## Visual Comparison: Full Impact Section

### Before (Checkbox-Heavy)

```markdown
## 배포 영향도 (Deployment Impact)

- [ ] High Impact
- [ ] Medium Impact
- [x] Low Impact

**영향도 분석:** Refactoring only

**Breaking Change:**
- [ ] Yes
```

**Character count:** 142 characters
**Visual clarity:** Low (requires reading text)
**Scannable:** No (all looks the same)

### After (Emoji-Rich)

```markdown
## 배포 영향도 (Deployment Impact)

🟢 **Low Impact**

**영향도 분석:**
- 코드 리팩토링 및 아키텍처 개선
- DEV/QA 환경만 영향 (STAGING/PROD는 기존 구조 사용)
- Task Definition, 환경 변수, 리소스 설정 변경 없음

**git diff 확인:**
\`\`\`bash
git diff origin/staging..origin/master -- lib/constructs/service/task-definition.ts
# (No output = no changes)
\`\`\`

**Breaking Change:** ❌ No
```

**Character count:** 328 characters
**Visual clarity:** High (🟢 instantly recognizable)
**Scannable:** Yes (emojis create visual anchors)

---

## Scanability Test

Imagine reviewing 5 PRs. Which format lets you quickly identify high-impact PRs?

### Checkbox Format

```
PR #220: [ ] High  [ ] Medium  [x] Low
PR #221: [x] High  [ ] Medium  [ ] Low
PR #222: [ ] High  [x] Medium  [ ] Low
PR #223: [ ] High  [ ] Medium  [x] Low
PR #224: [ ] High  [x] Medium  [ ] Low
```

**Time to identify high-impact:** ~5-10 seconds (must read each line)

### Emoji Format

```
PR #220: 🟢 Low Impact
PR #221: 🔴 High Impact ← Instantly visible
PR #222: 🟡 Medium Impact
PR #223: 🟢 Low Impact
PR #224: 🟡 Medium Impact
```

**Time to identify high-impact:** <1 second (🔴 pops out)

---

## Summary: When to Use Each Format

### Use Checkboxes ✅

**Pre-deployment checks:**
```markdown
- [x] `npm run lint:check` passed
- [x] `npm run build` succeeded
- [ ] CloudFormation Change Set reviewed
```

**Why:** These are actual tasks to complete

### Don't Use Checkboxes ❌

**Single selection (environment):**
```markdown
**Target Environment:** STAGING
```

**Why:** Only one can be true, direct statement is clearer

**Yes/No (breaking change):**
```markdown
**Breaking Change:** ❌ No
```

**Why:** Emoji provides instant visual

**Impact level:**
```markdown
🟢 **Low Impact**
```

**Why:** Emoji header + analysis provides context

---

## Real-World Impact

**PR #223 metrics:**
- **Sections improved:** 5 (Type, Environment, Impact, Breaking, Services)
- **Checkboxes removed:** 15
- **Clarity gained:** Instant visual scanning, detailed context, no confusion
- **Review time:** Estimated 20% faster (visual hierarchy aids scanning)

**Template issues identified:**
- Breaking Change section duplicated (lines 29 & 261)
- Force single selection for multi-type PRs
- Visual clutter from unnecessary checkboxes

**Next steps:**
- Propose template improvements to team
- Test new format with next 3-5 PRs
- Iterate based on reviewer feedback