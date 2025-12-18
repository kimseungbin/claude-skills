# Example: PR Template for IaC and Environment Promotion

**Source:** `.github/pull_request_template.md` from fe-infra project

**Optimized for:**
- Infrastructure as Code (CDK/CloudFormation)
- Environment promotion workflows (DEV → STAGING → PROD)
- Multi-service microservices architecture
- Korean-language teams with English technical terms

**Key Features:**
- Emoji-based visual hierarchy (🔴/🟡/🟢 for impact, ✅/❌ for yes/no)
- Expandable `<details>` sections for guidance
- Environment analysis table with feature flag support
- Deployment impact decision tree
- No checkbox anti-patterns
- No redundant `# Pull Request` heading (GitHub context provides this)

**Note:** This is a reference example. Adapt sections based on your project's needs.

---

# 변경 사항 요약 (Summary)
<!-- 이 PR에서 변경한 내용을 간략하게 설명해주세요 -->


# 변경 유형 (Type of Change)
<!-- 해당하는 이모지 하나를 아래 주석에서 선택하여 붙여넣으세요 -->
<!-- 🎉 feat: 새로운 기능 추가 / 🐛 fix: 버그 수정 / ♻️ refactor: 리팩토링 (기능 변경 없음) / 🔧 chore: 유지보수 (의존성 업데이트, 설정 변경 등) / 📝 docs: 문서 변경 / 🤖 ci: IaC의 CI/CD 변경 -->



# 배포 영향도 (Deployment Impact)
<!-- 이 변경이 실행 중인 서비스에 미치는 영향을 선택하고 구체적인 이유를 설명해주세요 -->
<!-- 영향도 앞에 해당하는 이모지를 사용하여 시각적으로 표시해주세요 -->

🔴 **High Impact** / 🟡 **Medium Impact** / 🟢 **Low Impact**

**영향도 분석 (필수):**
<!-- 선택한 영향도의 구체적인 이유를 작성해주세요. 어떤 파일의 어떤 값이 변경되었는지 명시해주세요. -->

**예시:**
- 🔴 High Impact: `lib/constructs/service/task-definition.ts`에서 CPU 256 → 512로 변경, 환경 변수 `API_URL` 추가
- 🟡 Medium Impact: `src/config/config.data.ts`에서 desiredCount 4 → 2로 변경 (auto-scaling 조정)
- 🟢 Low Impact: `CLAUDE.md` 문서 추가, import 경로 리팩토링 (런타임 영향 없음)

**이 PR의 영향도:**

**Breaking Change:** ✅ 없음 / ⚠️ 있음

<!-- Breaking Change가 있으면 아래에 상세 설명 작성 -->
<details>
<summary>⚠️ Breaking Change 상세 (해당시 클릭하여 펼치기)</summary>

**무엇이 호환되지 않는가:**
<!-- 구체적으로 어떤 API, 설정, 동작이 변경되는지 설명 -->

**마이그레이션 방법:**
<!-- 기존 사용자가 어떻게 대응해야 하는지 단계별로 설명 -->

**영향받는 시스템:**
<!-- 어떤 서비스, 팀, 시스템이 영향을 받는지 명시 -->

</details>


<details>
<summary>📖 영향도 판단 가이드 (클릭하여 펼치기)</summary>

## High Impact - ECS Task 재배포 필요
**다음 변경사항은 새로운 Task Definition을 생성하고 ECS 서비스 재배포를 트리거합니다:**

- ✅ **Task Definition 리소스 변경:**
  - CPU 값 변경 (예: `FargateCpu.CPU_256` → `FargateCpu.CPU_512`)
  - Memory 값 변경 (예: `FargateMemory.MEMORY_512` → `FargateMemory.MEMORY_1024`)
  - Environment Variables 추가/변경/삭제

- ✅ **Container 설정 변경:**
  - Container 이미지 변경 (새 이미지 푸시는 제외)
  - Container 포트 변경
  - 볼륨 마운트 변경
  - Health check 설정 변경

- ✅ **IAM Role 변경:**
  - Task Execution Role 변경 (ECR, CloudWatch 권한)
  - Task Role 변경 (애플리케이션 런타임 권한)

**확인 방법:**
```bash
git diff origin/staging...master lib/constructs/service/task-definition.ts
git diff origin/staging...master src/config/config.data.ts | grep -E "cpu|memory|env"
```

**주의:** 파일명만 보지 말고 실제 diff 내용을 확인하세요!

---

## Medium Impact - 서비스 중단 없이 업데이트
**다음 변경사항은 기존 Task를 유지하면서 점진적으로 적용됩니다:**

- ✅ **Auto-scaling 설정 변경:**
  - `desiredCount` 변경 (Task 수 조정)
  - `minCapacity` / `maxCapacity` 변경
  - Auto-scaling 정책 변경 (CPU/Memory 임계값)

- ✅ **네트워크 설정 변경:**
  - ALB Listener/Target Group 규칙
  - Security Group 규칙 (인바운드/아웃바운드)
  - Target Group deregistration 시간

- ✅ **CDN 설정 변경:**
  - CloudFront Distribution 설정
  - Cache behavior 변경
  - Lambda@Edge 추가/변경

- ✅ **빌드 프로세스 변경:**
  - CodeBuild 설정 변경
  - 빌드 스크립트 변경 (기존 서비스 영향 없음)

**확인 방법:**
```bash
git diff origin/staging...master src/config/config.data.ts | grep -E "desired|min|max"
git diff origin/staging...master lib/constructs/service/load-balancer.ts
```

---

## Low Impact - 메타데이터만 변경
**다음 변경사항은 실행 중인 서비스에 영향을 주지 않습니다:**

- ✅ **문서 및 주석:**
  - README, CLAUDE.md, 기타 문서 파일
  - 코드 주석 추가/변경

- ✅ **코드 리팩토링:**
  - Import 경로 변경 (컴파일 결과 동일)
  - 타입 정의 파일 이동
  - 함수/변수 이름 변경 (로직 동일)

- ✅ **인프라 메타데이터:**
  - ECR Repository 생성 (이미지 푸시 전까지 영향 없음)
  - CloudWatch Log Group 생성/설정
  - VPC Flow Logs 설정
  - Tags 추가/변경

**확인 방법:**
```bash
git diff origin/staging...master --name-only | grep -E "\.md$|README|docs/"
```

---

## 일반적인 실수 예시

❌ **잘못된 판단:**
```
High Impact 체크
이유: task-definition.ts 파일이 변경되었음
```
→ 파일명만 보고 판단. 실제로는 import 경로만 변경됨 (Low Impact)

✅ **올바른 판단:**
```
Medium Impact 체크
이유: src/config/config.data.ts에서 desiredCount를 4에서 2로 변경 (fd282d1 커밋)
     ECS task 수가 줄어들지만 Task Definition은 변경되지 않음
```

---

❌ **잘못된 판단:**
```
High Impact 체크
이유: Fargate CPU/Memory enum을 다른 파일로 이동
```
→ 값의 변경이 아닌 파일 이동 (Low Impact)

✅ **올바른 판단:**
```
Low Impact 체크
이유: lib/constructs/service/fargate-cpu.ts → src/config/types/fargate.types.ts로 파일 이동
     실제 CPU/Memory 값은 변경되지 않았고 import 경로만 수정됨 (e3bf8b3 커밋)
```

</details>

# 배포 대상 환경 (Target Environment)

**이 PR의 배포 대상:** 검증 (STAGING) / 운영 (PRODUCTION)

## 환경별 배포 영향 분석

<!--
  각 변경사항이 어느 환경에 배포되는지 분석해주세요.

  배포 여부:
  - ✅ YES: 이 변경사항이 해당 환경에 배포됨 (이미 배포됨 포함)
  - ❌ NO: Feature flag로 인해 코드는 배포되지만 기능은 비활성
  - 🚫 NEVER: 해당 환경에는 절대 배포되지 않음 (예: DEV 전용 리소스)

  FF (Feature Flag):
  - ✅: Feature flag로 제어됨
  - ❌: Feature flag 없음

  문서화 변경이나 코드 외 변경사항은 테이블을 사용하지 마세요.
-->

| 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
|---------|------|------|------|----|----|
| <!-- 변경사항 1 --> | ✅ / ❌ / 🚫 | ✅ / ❌ / 🚫 | ✅ / ❌ / 🚫 | ✅ / ❌ | <!-- feature flag 이름 또는 사유 --> |
| <!-- 변경사항 2 --> | ✅ / ❌ / 🚫 | ✅ / ❌ / 🚫 | ✅ / ❌ / 🚫 | ✅ / ❌ | <!-- feature flag 이름 또는 사유 --> |

> **참고:** FF = Feature Flag (기능 플래그)

**예시:**

| 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
|---------|------|------|------|----|----|
| SSM Parameter Store 마이그레이션 | ✅ YES | ❌ NO | ❌ NO | ✅ | `ssm-parameter-secrets: [dev, qa]`<br>검증/운영은 코드만 배포, 기능 비활성 |
| 태그 기반 QA 배포 | ✅ YES | ✅ YES | ✅ YES | ❌ | QA만 trigger 변경, 다른 환경은 코드만 추가 |
| 태그 기반 PROD 배포 | ✅ YES | ✅ YES | ❌ NO | ❌ | 코드는 배포되지만 PROD는 향후 활성화 예정 |
| Cross-account SNS topic | ✅ YES | 🚫 NEVER | 🚫 NEVER | ❌ | DEV 계정 전용 리소스<br>다른 환경은 자체 SNS topic 사용 |
| Bug fix (API 오류) | ✅ YES | ✅ YES | ✅ YES | ❌ | 모든 환경 적용 |

# 영향받는 서비스 (Affected Services)
<!--
  For each service, replace "✅ / ❌" with a single emoji:
  - ✅: This PR affects the service
  - ❌: This PR does not affect the service

  Use the 비고 (Notes) column to add context if needed.
-->

| 서비스 | 영향 | 비고 |
|--------|------|------|
| auth | ✅ / ❌ | |
| yozm | ✅ / ❌ | |
| support | ✅ / ❌ | |
| project | ✅ / ❌ | |
| partner | ✅ / ❌ | |
| solution | ✅ / ❌ | |
| profile | ✅ / ❌ | |
| edge-gateway | ✅ / ❌ | |
| 공통 인프라 | ✅ / ❌ | |
| 배포 파이프라인 | ✅ / ❌ |

# 상세 변경 내역 (Detailed Changes)

## 변경 내용 (What)
<!-- 무엇을 변경했는지 구체적으로 설명해주세요 -->


## 변경 이유 (Why)
<!-- 왜 이 변경이 필요한지 설명해주세요 -->


## 기술적 세부사항 (How)
<!-- 어떻게 구현했는지 기술적인 세부사항을 설명해주세요 -->


# 리소스 영향 분석 (Resource Impact)
<!-- 해당하는 영향도를 선택하고 구체적인 내용을 작성해주세요 -->

🔴 **리소스 교체** (replacement) / 🟡 **리소스 수정** (in-place) / 🟢 **새 리소스 생성** / ⚪ **변경 없음**

**리소스 변경 내역:**
<!-- 교체/수정/생성되는 리소스를 구체적으로 작성해주세요 -->


# 배포 전 테스트 (Pre-deployment Tests)
<!-- 코드 병합 전 반드시 확인해야 할 항목들 -->
<!-- Note: lint는 pre-push hook과 GitHub Actions에서 자동으로 검증되므로 별도 확인 불필요 -->

- [ ] `npm run build` 성공
- [ ] `npm run cdk synth` 성공
- [ ] 보안 영향 검토 완료 (해당시)
- [ ] 다른 팀에 영향 공유 완료 (해당시)

# 배포 후 검증 계획 (Post-deployment Verification)
<!--
  CDK Pipeline이 자동으로 배포를 수행하므로,
  배포 완료 후 AWS 콘솔에서 다음 항목들을 확인해주세요.
  검증 완료 후 이 PR에 코멘트로 결과를 공유해주세요.
-->

**배포 완료 후 확인할 항목:**

## ECS 서비스 (High Impact 변경시 필수)
- [ ] ECS Service 정상 상태 확인 (RUNNING)
- [ ] Task Definition 새 버전 배포 확인
- [ ] 이전 Task 정상 종료 확인
- [ ] Container Health Check 통과

## ALB 및 네트워크
- [ ] Target Group Health Check 상태: Healthy
- [ ] ALB Access Logs 확인 (에러 없음)
- [ ] Security Group 규칙 적용 확인

## CloudFront 및 CDN (해당시)
- [ ] CloudFront Distribution 배포 완료 (Status: Deployed)
- [ ] Cache Invalidation 완료
- [ ] Origin 연결 정상

## 모니터링 및 로그
- [ ] CloudWatch Logs 정상 출력 확인
- [ ] Datadog Metrics 정상 수집 확인
- [ ] 에러/경고 로그 없음

## 서비스 기능 테스트
- [ ] 주요 API 엔드포인트 정상 응답
- [ ] 서비스 기능 동작 확인
- [ ] 성능 이상 없음 (응답 시간, 처리량)

**검증 방법:**
```bash
# ECS 서비스 상태 확인
aws ecs describe-services --cluster <cluster-name> --services <service-name>

# Target Group Health 확인
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# CloudWatch Logs 확인
aws logs tail /ecs/<service-name> --follow
```

# 관련 이슈 / 문서 (Related Issues / Documentation)
<!-- 관련된 이슈, 티켓, 문서 링크를 추가해주세요 -->

- Fixes #
- Closes #
- Related to #
- Documentation:

# 체크리스트 (Final Checklist)
<!-- 배포 승인 전 모든 항목을 확인해주세요 -->

- [ ] 코드가 프로젝트 컨벤션을 따릅니다
- [ ] Conventional Commits 규칙을 따랐습니다 (feat/fix/refactor/chore/docs/ci)
- [ ] 변경사항이 CLAUDE.md에 문서화되어야 한다면 업데이트했습니다
- [ ] 새로운 환경 변수나 시크릿이 필요하다면 문서화했습니다
- [ ] 리소스 증가/변경으로 인한 비용 영향을 검토했습니다
- [ ] 보안 관련 변경사항이 있다면 보안 검토를 받았습니다
- [ ] 다른 서비스에 영향을 주는 변경이라면 관련팀에 알렸습니다

# 추가 정보 (Additional Notes)
<!-- 리뷰어가 알아야 할 추가 정보를 적어주세요 -->


---

## 📋 배포 방법 (Deployment Instructions)

이 프로젝트는 **CDK Pipeline 자동 배포**를 사용합니다:

1. **PR 생성 시**: GitHub Actions가 lint, build, cdk synth를 자동 검증합니다
2. **PR 승인 및 병합**: 리뷰어가 승인 후 PR을 병합합니다
3. **자동 배포**: CDK Pipeline이 자동으로 배포를 시작합니다 (CodePipeline)
4. **배포 후 검증**: 위의 "배포 후 검증 계획" 섹션의 항목들을 확인하고 PR에 결과를 코멘트로 공유합니다
