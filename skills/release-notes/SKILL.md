---
name: release-notes
description: Draft production release notes by analyzing commits between staging and the latest release tag. Use when user requests release notes or prepares a production release.
---

# Release Notes

This skill helps draft production-focused release notes by analyzing commits pending release and filtering out changes that don't affect the production environment.

## Instructions

When the user requests release notes or asks about pending production changes:

1. **Identify commits pending release**:
   ```bash
   # Fetch latest from remote (including tags)
   git fetch origin staging --tags

   # Find the latest stable release tag (exclude pre-release tags like -qa.*, -rc.*)
   LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | grep -v '\-' | head -1)
   echo "Latest release: $LATEST_TAG"

   # Show merge commits only (first-parent) between latest tag and staging
   git log --oneline --first-parent ${LATEST_TAG}..origin/staging
   ```

   **If user specifies a target commit:**
   - Use the specified commit instead of staging HEAD
   - Compare `${LATEST_TAG}..<commit-hash>` instead of `${LATEST_TAG}..origin/staging`
   - Store the commit hash for use when creating the release

   **If no stable tags exist:**
   - This is likely the first release
   - Use `git log --oneline --first-parent origin/staging` to list all commits
   - Or ask user for a starting point

2. **Gather PR details for each merge commit**:
   - Extract PR numbers from commit messages (e.g., `(#123)`)
   - Use `gh pr view <number> --json title,body,files` to get details
   - Focus on the PR description's impact analysis sections

3. **Filter for production impact**:

   **Include changes that:**
   - Modify production configuration (`Environment.PROD`)
   - Add/modify constructs used in production
   - Change feature flags enabled for production
   - Update dependencies affecting runtime
   - Fix bugs affecting production

   **Exclude changes completely (do not mention at all):**
   - Only affect DEV/QA/STAGING environments
   - Are gated by feature flags not enabled for production
   - Are documentation-only changes
   - Are dev tooling changes (git hooks, scripts, IDE configs)
   - Are test-only changes

   **Important:** Do NOT mention excluded changes in the release notes. Skip them entirely rather than noting they don't affect production.

4. **Analyze production impact**:

   For each PR, check:
   ```typescript
   // Feature flag check - is it enabled for production?
   environments: [dev, qa]  // ❌ Not in prod
   environments: [dev, qa, staging, production]  // ✅ In prod

   // Environment condition check
   if (environment === Environment.DEV)  // ❌ DEV only
   if (environment === Environment.PROD)  // ✅ PROD specific
   // No condition = applies to all  // ✅ Affects prod
   ```

5. **Categorize production-impacting changes only**:

   - **Features**: New capabilities in production
   - **Improvements**: Enhancements to existing production features
   - **Bug Fixes**: Fixes affecting production
   - **Performance**: Production performance improvements
   - **Security**: Security-related changes
   - **Infrastructure**: AWS resource changes in production

6. **Draft release notes** (using PR template structure):

   **Template:**
   ```markdown
   # Release Notes v{version}

   ## 변경 사항 요약 (Summary)

   **{주요 변경사항 한 줄 요약}**

   **주요 변경사항:**
   - **{기능1}**: {설명} (#{PR})
   - **{기능2}**: {설명} (#{PR})

   ## 변경 유형 (Type of Change)

   🎉 **feat** / 🐛 **fix** / ♻️ **refactor** / 🔧 **chore**

   ## 배포 영향도 (Deployment Impact)

   🔴 **High Impact** / 🟡 **Medium Impact** / 🟢 **Low Impact**

   **영향도 분석:**
   - {영향도 이유 설명}

   **Breaking Change:** ✅ 없음 / ⚠️ 있음

   ## 환경별 배포 영향 분석

   | 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
   |---------|------|------|------|----|------|
   | {변경사항1} | ✅ / ❌ / 🚫 | ✅ / ❌ / 🚫 | ✅ / ❌ / 🚫 | ✅ / ❌ | {사유} |

   > **참고:** FF = Feature Flag (기능 플래그)

   ## 영향받는 서비스 (Affected Services)

   | 서비스 | 영향 | 비고 |
   |--------|------|------|
   | auth | ✅ / ❌ | |
   | yozm | ✅ / ❌ | |
   | support | ✅ / ❌ | |
   | project | ✅ / ❌ | |
   | partner | ✅ / ❌ | |
   | solution | ✅ / ❌ | |
   | profile | ✅ / ❌ | |
   | 공통 인프라 | ✅ / ❌ | |
   | 배포 파이프라인 | ✅ / ❌ | |

   ## 상세 변경 내역 (Detailed Changes)

   ### 변경 내용 (What)

   #### 1. {변경사항 제목} (#{PR})
   - {상세 설명}

   ### 변경 이유 (Why)

   - {변경 이유}

   ### 기술적 세부사항 (How)

   {아키텍처 다이어그램이나 코드 구조 설명}

   ## 리소스 영향 분석 (Resource Impact)

   - [ ] 새로운 AWS 리소스 생성됨
   - [ ] 기존 리소스 용량 변경됨
   - [ ] 비용 영향 검토 완료
   - [ ] 리소스 영향 없음

   **예상 비용 변화:** {비용 설명}

   ## 관련 이슈 / 문서 (Related Issues / Documentation)

   - PR #{번호}: {제목}
   - Related to {이슈/문서}

   ## 권장 버전 (Recommended Version)

   **v{X.Y.Z}** (Major / Minor / Patch)

   **근거:**
   - {버전 선택 이유}

   ## 추가 정보 (Additional Notes)

   {배포 후 필요한 수동 작업이나 주의사항}

   ---

   **Note:** {릴리스에 대한 요약 메모}
   ```

7. **Suggest version number**:
   - **MAJOR** (v2.0.0): Breaking changes, major infrastructure overhauls
   - **MINOR** (v1.1.0): New features, new services enabled in prod
   - **PATCH** (v1.0.1): Bug fixes, minor improvements, code-only changes

8. **Interactive review (draft mode)**:

   After drafting release notes, ask user if they want to:
   - Review and make changes
   - Save as draft to GitHub
   - Publish directly (not recommended)

   ```
   위 릴리스 노트 초안을 검토해주세요.

   다음 중 선택해주세요:
   1. 수정 요청 (변경사항 추가/제거, 영향도 수정, 버전 변경 등)
   2. GitHub에 Draft로 저장
   3. 바로 게시 (권장하지 않음)
   ```

9. **Save as GitHub draft release**:

   When user chooses to save as draft, create a draft release on GitHub.

   **Target selection:**
   - If a specific commit was specified: use `--target <commit-hash>`
   - Otherwise: use `--target staging` (HEAD of staging branch)

   **Why use specific commits?**
   Using a specific commit hash ensures the release tag points to exactly the commit that was analyzed, even if new commits are pushed to staging before publishing the release.

   ```bash
   # With specific commit (recommended)
   gh release create v{version} --draft --target <commit-hash> --title "v{version}" --notes "$(cat <<'EOF'
   {release notes content}
   EOF
   )"

   # Without specific commit (uses staging HEAD)
   gh release create v{version} --draft --target staging --title "v{version}" --notes "$(cat <<'EOF'
   {release notes content}
   EOF
   )"
   ```

   After creating draft:
   ```
   ✅ Draft 릴리스가 생성되었습니다.
   🔗 https://github.com/{owner}/{repo}/releases/tag/v{version}
   📌 Target: <commit-hash> (또는 staging)

   GitHub에서 검토 후 "Publish release"를 클릭하여 게시하세요.
   ```

10. **Publish release** (if user chooses direct publish):
    ```bash
    # With specific commit
    gh release create v{version} --target <commit-hash> --title "v{version}" --notes "$(cat <<'EOF'
    {release notes content}
    EOF
    )"

    # Without specific commit
    gh release create v{version} --target staging --title "v{version}" --notes "$(cat <<'EOF'
    {release notes content}
    EOF
    )"
    ```

## Example Workflows

### Example 1: Release with Specific Commit Target

```
User: "abc1234 커밋 기준으로 릴리스 노트 작성해줘"

1. Fetch and find latest tag, then compare using specific commit:
   git fetch origin staging --tags
   LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | grep -v '\-' | head -1)
   # Latest release: v1.1.0
   git log --oneline --first-parent v1.1.0..abc1234

   Output:
   abc1234 feat(auth): Enable OAuth2 for production (#250)
   def5678 fix(yozm): Fix memory leak in SSR (#249)

   📌 Target commit stored: abc1234

2. Analyze each PR...
   (same analysis process)

3. Draft notes...
   (same drafting process)

4. Ask for review:
   위 릴리스 노트 초안을 검토해주세요.

   📌 Target: abc1234 (staging HEAD가 아닌 특정 커밋)

   다음 중 선택해주세요:
   1. 수정 요청
   2. GitHub에 Draft로 저장
   3. 바로 게시 (권장하지 않음)

5. User responds: "2"

6. Create draft release with specific commit:
   gh release create v1.2.0 --draft --target abc1234 --title "v1.2.0" --notes "..."

   ✅ Draft 릴리스가 생성되었습니다.
   🔗 https://github.com/wishket/fe-infra/releases/tag/v1.2.0
   📌 Target: abc1234

   GitHub에서 검토 후 "Publish release"를 클릭하여 게시하세요.

   ⚠️ 이 릴리스는 staging HEAD가 아닌 특정 커밋(abc1234)을 대상으로 합니다.
   staging에 새 커밋이 추가되어도 이 릴리스에는 영향을 주지 않습니다.
```

### Example 2: No Production Impact Release

```
User: "릴리스 노트 작성해줘"

1. Fetch and find latest tag:
   git fetch origin staging --tags
   LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | grep -v '\-' | head -1)
   # Latest release: v1.0.0
   git log --oneline --first-parent v1.0.0..origin/staging

   Output:
   630d538 feat(infra): Add ServiceConstruct and migrate Partner service (#236)
   ac10854 feat(route53): Enable Route53 subdomain delegation for DEV (#235)

2. Analyze each PR:
   PR #235: Route53 for DEV
   - Feature flag: environments: [qa, dev] → NOT production
   - Impact: None on production → SKIP

   PR #236: ServiceConstruct + Partner migration
   - Partner uses ServiceConstruct only in DEV → SKIP
   - Git hooks changes → SKIP (dev tooling)
   - ECR cache default enabled: applies to all environments → INCLUDE

3. Draft notes (only production-impacting changes):

   # Release Notes v1.0.1

   ## 변경 사항 요약 (Summary)

   **빌드 최적화** 릴리스입니다.

   **주요 변경사항:**
   - **ECR 캐시**: 기본 활성화로 변경 (#236)

   ## 변경 유형 (Type of Change)

   🔧 **chore**: 빌드 최적화

   ## 배포 영향도 (Deployment Impact)

   🟢 **Low Impact**

   **영향도 분석:**
   - ECR 캐시 기본 활성화: `cacheBucket` 제공 시 자동 활성화

   **Breaking Change:** ✅ 없음

   ## 환경별 배포 영향 분석

   | 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
   |---------|------|------|------|----|------|
   | ECR 캐시 기본 활성화 | ✅ YES | ✅ YES | ✅ YES | ✅ | `ecr-cache: false`로 비활성화 가능 |

   ## 영향받는 서비스 (Affected Services)

   | 서비스 | 영향 | 비고 |
   |--------|------|------|
   | yozm | ✅ | cacheBucket 설정됨 |
   | (나머지) | ❌ | |

   ## 상세 변경 내역 (Detailed Changes)

   ### 변경 내용 (What)

   #### 1. ECR 캐시 기본 활성화 (#236)
   - `cacheBucket` 제공 시 자동 활성화
   - `ecr-cache: false`로 명시적 비활성화 가능

   ### 변경 이유 (Why)

   - 빌드 성능 최적화 (25-30% 빌드 시간 단축)

   ## 리소스 영향 분석 (Resource Impact)

   - [x] 리소스 영향 없음

   ## 권장 버전 (Recommended Version)

   **v1.0.1** (Patch)

   **근거:** 사소한 빌드 최적화

4. Ask for review:

   위 릴리스 노트 초안을 검토해주세요.

   다음 중 선택해주세요:
   1. 수정 요청 (변경사항 추가/제거, 영향도 수정, 버전 변경 등)
   2. GitHub에 Draft로 저장
   3. 바로 게시 (권장하지 않음)

5. User responds: "2"

6. Create draft release:
   gh release create v1.0.1 --draft --target staging --title "v1.0.1" --notes "..."

   ✅ Draft 릴리스가 생성되었습니다.
   🔗 https://github.com/wishket/fe-infra/releases/tag/v1.0.1
   📌 Target: staging

   GitHub에서 검토 후 "Publish release"를 클릭하여 게시하세요.
```

### Example 3: Production-Impacting Release

```
User: "운영 배포 대기 중인 변경사항은?"

1. Find latest tag and compare:
   git fetch origin staging --tags
   LATEST_TAG=$(git tag -l 'v*' --sort=-v:refname | grep -v '\-' | head -1)
   # Latest release: v1.1.0
   git log --oneline --first-parent v1.1.0..origin/staging

   Output:
   abc1234 feat(auth): Enable OAuth2 for production (#250)
   def5678 fix(yozm): Fix memory leak in SSR (#249)

2. Analyze:
   PR #250: OAuth2 for auth
   - No environment condition, applies to all → PRODUCTION IMPACT
   - New feature affecting auth service

   PR #249: Memory leak fix
   - Bug fix in yozm service → PRODUCTION IMPACT

3. Draft notes:

   # Release Notes v1.2.0

   ## 변경 사항 요약 (Summary)

   **OAuth2 인증 추가 및 메모리 누수 수정**

   **주요 변경사항:**
   - **OAuth2 인증**: Google 및 GitHub OAuth2 제공자 활성화 (#250)
   - **메모리 누수 수정**: yozm 서비스 SSR 메모리 누수 해결 (#249)

   ## 변경 유형 (Type of Change)

   🎉 **feat**: 새로운 기능 추가

   ## 배포 영향도 (Deployment Impact)

   🔴 **High Impact**

   **영향도 분석:**
   - auth 서비스: 새로운 OAuth2 기능 추가로 Task Definition 변경
   - yozm 서비스: SSR 메모리 누수 수정

   **Breaking Change:** ✅ 없음

   ## 환경별 배포 영향 분석

   | 변경사항 | 개발 | 검증 | 운영 | FF | 사유 |
   |---------|------|------|------|----|------|
   | OAuth2 인증 | ✅ YES | ✅ YES | ✅ YES | ❌ | 모든 환경 적용 |
   | 메모리 누수 수정 | ✅ YES | ✅ YES | ✅ YES | ❌ | 버그 수정 |

   ## 영향받는 서비스 (Affected Services)

   | 서비스 | 영향 | 비고 |
   |--------|------|------|
   | auth | ✅ | OAuth2 기능 추가 |
   | yozm | ✅ | 메모리 누수 수정 |
   | (나머지) | ❌ | |

   ## 상세 변경 내역 (Detailed Changes)

   ### 변경 내용 (What)

   #### 1. OAuth2 인증 (#250)
   - Google 및 GitHub OAuth2 제공자 활성화
   - 사용자 인증 옵션 확대

   #### 2. 메모리 누수 수정 (#249)
   - yozm 서비스 SSR 렌더링 메모리 누수 해결
   - 점진적 성능 저하 문제 수정

   ### 변경 이유 (Why)

   - 사용자 로그인 편의성 향상
   - 서비스 안정성 개선

   ## 리소스 영향 분석 (Resource Impact)

   - [ ] 리소스 영향 없음

   ## 권장 버전 (Recommended Version)

   **v1.2.0** (Minor)

   **근거:** 새로운 기능 추가

   ---

   **Note:** 이번 릴리스는 운영 환경에 직접 영향을 줍니다. 배포 후 모니터링 필수.

4. Ask for review:

   위 릴리스 노트 초안을 검토해주세요.

   다음 중 선택해주세요:
   1. 수정 요청 (변경사항 추가/제거, 영향도 수정, 버전 변경 등)
   2. GitHub에 Draft로 저장
   3. 바로 게시 (권장하지 않음)

5. User responds: "1. 영향도를 Medium으로 변경해주세요"

6. Update and ask again:
   (영향도를 Medium으로 수정한 릴리스 노트 출력)

   수정된 릴리스 노트입니다.

   다음 중 선택해주세요:
   1. 추가 수정 요청
   2. GitHub에 Draft로 저장
   3. 바로 게시 (권장하지 않음)

7. User responds: "2"

8. Create draft release:
   gh release create v1.2.0 --draft --target staging --title "v1.2.0" --notes "..."

   ✅ Draft 릴리스가 생성되었습니다.
   🔗 https://github.com/wishket/fe-infra/releases/tag/v1.2.0
   📌 Target: staging

   GitHub에서 검토 후 "Publish release"를 클릭하여 게시하세요.
```

## Project Configuration Location

This skill uses project-specific configuration for:
- Branch names (staging, master)
- Tag pattern for identifying releases
- Feature flag file location
- Environment enum values

**Configuration file:** `.claude/config/release-notes.yaml`

```yaml
# Branch configuration
branches:
  staging: staging
  development: master

# Tag pattern for identifying stable releases
# Stable releases match 'v*' but exclude pre-release tags (e.g., -qa.*, -rc.*)
tag_pattern: 'v*'
exclude_prerelease: true  # Excludes tags containing '-' (e.g., v1.0.0-qa.1)

# Feature flags file
feature_flags_path: feature-flags.yaml

# Environment values for filtering
environments:
  production: production
  staging: stag
  development: dev
  qa: qa
```

## Integration with Other Skills

- **conventional-commits**: Commit messages analyzed for change categorization
- **git-strategy**: Follows the same branch model and deployment flow
- **pull-request-management**: PR descriptions provide impact analysis

## Notes

- Always fetch latest from remote before analyzing
- Use `--first-parent` to see only merge commits, not individual PR commits
- Check feature flags to determine production enablement
- Look for environment conditionals in code to verify impact
- When in doubt, check the actual code changes, not just PR descriptions
- **Skip non-production changes entirely** - do not mention DEV/QA-only changes, documentation, or dev tooling