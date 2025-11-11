---
implementation: infrastructure
project_types:
  - AWS CDK
  - Terraform
  - Pulumi
  - CloudFormation
  - Infrastructure as Code
applicable_to:
  - Monorepo infrastructure projects
  - Single-repo infrastructure projects
---

# Infrastructure Commit Guide

This guide provides commit message patterns for Infrastructure as Code (IaC) projects using tools like AWS CDK, Terraform, Pulumi, or CloudFormation.

**Supports both:**
- Monorepo projects (with packages/ or workspaces)
- Single-repo infrastructure projects

## Type Selection Decision Tree

Use this tree to determine the correct commit type for your change:

```
Code Change Made
│
├─ Does it add NEW infrastructure for applications?
│  └─ YES → feat(scope)
│      ✅ Examples:
│         - New microservice deployment
│         - New AWS resource (RDS, S3, CloudFront)
│         - New capability (auto-scaling, monitoring)
│      ❌ NOT for:
│         - CI/CD pipeline infrastructure → chore(deployment)
│         - Developer tooling → chore(tools)
│         - Documentation → docs(scope)
│
├─ Does it fix BROKEN infrastructure behavior?
│  └─ YES → fix(scope)
│      ✅ Examples:
│         - Misconfigured resource
│         - Failing deployment
│         - Incorrect IAM permissions
│         - Missing environment variables
│
├─ Does it change CODE STRUCTURE without changing behavior?
│  └─ YES → refactor(scope)
│      ✅ Examples:
│         - Extract method
│         - Rename variables/classes
│         - Reorganize files
│         - Move code between files
│      ❌ NOT for:
│         - Changing behavior → feat or fix
│
├─ Is it CI/CD PIPELINE infrastructure?
│  └─ YES → chore(deployment)
│      ✅ Examples:
│         - CDK Pipeline stages/actions
│         - GitHub Actions workflows
│         - CodePipeline modifications
│         - Notification systems
│      ⚠️  Note: NOT feat because it's deployment tooling, not application infrastructure
│
├─ Is it DEVELOPER TOOLING?
│  └─ YES → chore(tools) or chore(github)
│      ✅ Examples:
│         - Git hooks → chore(tools)
│         - Linters, formatters → chore(tools)
│         - Scripts → chore(tools)
│         - PR templates → chore(github)
│         - CODEOWNERS → chore(github)
│         - Issue templates → chore(github)
│
├─ Is it DOCUMENTATION ONLY (no logic changes)?
│  └─ YES → docs(scope)
│      ✅ Examples:
│         - README, CLAUDE.md updates
│         - JSDoc comments
│         - Inline code comments
│      ❌ NOT for:
│         - Documentation accompanying code change → use code's type
│
└─ Is it DEPENDENCIES or BUILD CONFIG?
   └─ YES → chore(monorepo) or build(scope)
       ✅ Examples:
          - package.json dependencies → chore(monorepo)
          - tsconfig.json → chore(monorepo)
          - Build scripts → build(scope)
```

## Scope Selection Pattern

### Step 1: Identify File Locations

Map changed files to scopes based on your project structure.

#### Monorepo Projects (with packages/ or workspaces)

```
Infrastructure Constructs (lib/constructs/, modules/):
├─ lib/constructs/lambda/ → lambda
├─ lib/constructs/cloudfront/ → cloudfront
├─ lib/constructs/database/ → database
└─ lib/constructs/networking/ → networking

Stack Files (lib/stacks/, stacks/):
├─ lib/main-stack.ts → main
├─ lib/global-stack.ts → global
└─ lib/deployment-stack.ts → deployment

Workspace Packages (packages/):
├─ packages/lambda/function-a/ → lambda
├─ packages/shared/ → shared
└─ packages/infra/ → infra

Developer Tooling:
├─ .github/workflows/ → tools
├─ scripts/ → tools
└─ .githooks/ → tools

GitHub Meta Files:
├─ .github/pull_request_template.md → github
├─ .github/CODEOWNERS → github
└─ .github/ISSUE_TEMPLATE/ → github

Project Documentation:
├─ CLAUDE.md → project
├─ README.md → project
└─ docs/**/*.md → project

Configuration:
├─ src/config/ → config
├─ types/ → config
└─ package.json (root) → monorepo
```

#### Single-Repo Projects

```
Infrastructure Modules (lib/, modules/, src/):
├─ lib/lambda/ → lambda
├─ lib/cloudfront/ → cloudfront
├─ lib/database/ → database
└─ lib/networking/ → networking

Stack/Main Files:
├─ main.tf → infra (Terraform)
├─ stack.ts → infra (CDK single-stack)
└─ index.ts → infra

Developer Tooling:
├─ .github/workflows/ → tools
├─ scripts/ → tools
└─ Makefile → tools

Configuration:
├─ config/ → config
├─ variables.tf → config (Terraform)
└─ package.json → build
```

### Step 2: Apply Multi-File Rules

**Rule 1:** Same directory/construct → Use that scope

```
Modified Files:
  - lib/constructs/lambda/index.ts
  - lib/constructs/lambda/runtime.ts
  - lib/constructs/lambda/permissions.ts

Scope: lambda
Rationale: All changes in same construct directory
```

**Rule 2:** Related feature (construct + stack) → Primary construct

```
Modified Files:
  - lib/constructs/lambda/edge-function.ts (primary change)
  - lib/global-stack.ts (integrates edge function)

Scope: lambda
Rationale: Primary change is in lambda construct; stack change is integration
```

**Rule 3:** Unrelated constructs → Consider splitting or use 'infra'

```
Modified Files:
  - lib/constructs/lambda/error-handler.ts
  - lib/constructs/database/error-handler.ts
  - lib/constructs/networking/error-handler.ts

Option A: Split into 3 commits (lambda, database, networking)
Option B: One commit with scope 'infra' (cross-cutting standardization)

Choose B if: Changes are truly the same pattern applied everywhere
Choose A if: Changes are independent features that happen to touch multiple areas
```

**Rule 4:** Configuration affecting multiple → 'config'

```
Modified Files:
  - src/config/types.ts
  - src/config/config.data.ts
  - lib/constructs/service/index.ts (reads new config)

Scope: config
Rationale: Primary change is configuration system; construct just consumes it
```

### Step 3: Special Cases

**GitHub Files:**

```
.github/workflows/ → ci(tools)  # Executable CI/CD automation
.github/pull_request_template.md → chore(github)  # Repository meta files
.github/CODEOWNERS → chore(github)  # Repository meta files
.github/ISSUE_TEMPLATE/ → chore(github)  # Repository meta files
```

**Rationale:** Workflows execute code; templates/CODEOWNERS configure repository behavior.

**Lambda/Serverless Functions:**

```
# Monorepo
packages/lambda/function-a/src/index.ts → lambda (or function-a)
packages/lambda/function-a/tests/ → lambda (or function-a)
packages/lambda/shared/utils.ts → lambda-shared

# Single-repo
lib/lambda/handler.ts → lambda
functions/api/index.ts → lambda
```

**Rationale:** Group by function name or use generic 'lambda' scope.

## Universal Anti-patterns

### ❌ Anti-pattern 1: Vague Verbs

**Bad Examples:**
```
- "Refactor code"
- "Update file"
- "Improve quality"
- "Clean up"
- "Fix issues"
```

**Good Examples:**
```
- "Extract IAM role creation to dedicated method"
- "Add retry timeout to Lambda configuration"
- "Replace string concatenation with template literals"
- "Remove unused import statements"
- "Fix missing health check timeout in task definition"
```

**Lesson:** Use specific verbs that describe **WHAT** changed, not just that something changed.

### ❌ Anti-pattern 2: File Names Instead of Content

**Bad Examples:**
```
- "Update CLAUDE.md"
- "Fix task-definition.ts"
- "Modify config.ts"
```

**Good Examples:**
```
- "Add Lambda workspace section to CLAUDE.md"
- "Fix missing health check timeout in task definition"
- "Add auto-scaling CPU threshold to config"
```

**Lesson:** Describe **WHAT** in the file changed, not just the file name.

### ❌ Anti-pattern 3: Confusing Move with Remove

**Bad Example:**
```
docs(project): Remove Architecture Benefits section from CLAUDE.md
```

**Context:** Content was moved to README.md

**Good Example:**
```
docs(project): Move Architecture Benefits section from CLAUDE.md to README.md
```

**Lesson:** If content relocated, use "Move X from A to B", not "Remove X"

### ❌ Anti-pattern 4: Type vs Scope Confusion

**Bad Example:**
```
feat(ci): Add GitHub Actions workflow for drift detection
```

**Problem:** CI workflows are tooling, not application features

**Good Example:**
```
ci(tools): Add GitHub Actions workflow for drift detection
```

**Lesson:** Use type=ci for CI/CD changes, scope indicates where (tools, deployment)

### ❌ Anti-pattern 5: Overly Generic Scope

**Bad Example:**
```
feat(infra): Add Lambda function
```

**Good Example:**
```
feat(lambda): Add edge function for CloudFront request handling
```

**Lesson:** Use specific scope (lambda) unless truly cross-cutting (standardizing error handling across all constructs)

## Example Commit Messages by Category

### 1. Infrastructure Construct

```
feat(lambda): Add custom domain support for edge functions

Enable Lambda@Edge to use custom domains with ACM certificates.

- Add optional certificateArn and domainName props
- Configure conditional certificate attachment
- Support both default CloudFront domain and custom domains

Skill: conventional-commits
```

**Rationale:** Primary change is lambda construct. Type is 'feat' because it adds new capability.

### 2. Stack + Construct (Related Feature)

```
feat(cloudfront): Add WAF rate limiting rule

Implement rate limiting protection for CloudFront distributions.

- Add rate-based rule to WAF construct
- Update main-stack to configure rate limit per environment
- Export WAF ACL ARN for cross-stack references

Skill: conventional-commits
```

**Rationale:** Primary change is cloudfront/waf construct. Stack changes are secondary integration.

### 3. Configuration System

```
feat(config): Add environment-specific auto-scaling policies

Support different auto-scaling thresholds per environment.

- Add scaling policy fields to environment config types
- Update config.data.ts with DEV/STAGING/PROD values
- Update service construct to use new config fields

Skill: conventional-commits
```

**Rationale:** Configuration system change affecting multiple constructs.

### 4. Cross-Cutting Refactor

```
refactor(infra): Standardize IAM role naming convention

Apply consistent naming pattern across all constructs.

- Update service construct role names
- Update code-build construct role names
- Update shared construct role names
- Add naming utility function

Skill: conventional-commits
```

**Rationale:** Cross-cutting change affecting multiple constructs, use broader 'infra' scope.

### 5. CI/CD Pipeline Infrastructure

```
chore(deployment): Add cross-account pipeline notification system

Implement centralized Slack notification for CodePipeline events.

- Add Lambda message transformer for pipeline notifications
- Add regional SNS topics per environment
- Configure cross-account topic forwarding to central Slack

Skill: conventional-commits
```

**Rationale:** CI/CD pipeline infrastructure uses chore(deployment), **NOT feat**. This is infrastructure FOR monitoring the deployment process, not application infrastructure.

### 6. GitHub Actions Workflow

```
ci(tools): Add CloudFormation drift detection workflow

Implement automated drift detection for deployed stacks.

- Add GitHub Actions workflow for scheduled drift checks
- Configure Slack notifications for drift alerts
- Document drift remediation process in CLAUDE.md

Skill: conventional-commits
```

**Rationale:** GitHub Actions workflows use type=ci, scope=tools.

### 7. GitHub Meta Files

```
chore(github): Add emoji indicators to PR template deployment impact

Replace checkbox format with visual emoji indicators for better readability.

- 🔴 High Impact: ECS service redeployment
- 🟡 Medium Impact: Resource updates, no downtime
- 🟢 Low Impact: Metadata only

Skill: conventional-commits
```

**Rationale:** PR templates are repository meta files, not CI/CD automation. Use chore(github), not ci(tools) or feat(tools).

### 8. Documentation Only

```
docs(project): Add Lambda workspace architecture section to README

Document Lambda function monorepo workspace pattern for users.

- Add architecture benefits explanation
- Show build flow diagram
- List key advantages (DRY, type safety, ES modules)

Skill: conventional-commits
```

**Rationale:** Documentation-only change (no code logic). Use docs(project) for project guides.

### 9. Lambda Workspace Code (Monorepo)

```
fix(lambda): Add retry logic for SNS publish failures

Implement exponential backoff for cross-account SNS publishing.

- Add retry wrapper with exponential backoff
- Handle throttling errors gracefully
- Add CloudWatch metrics for retry attempts

Skill: conventional-commits
```

**Rationale:** Changes in packages/lambda/ use fix/refactor for bug fixes or improvements, **NOT feat** (Lambda functions are infrastructure code, not new features).

### 10. Workspace Dependencies (Monorepo)

```
chore(monorepo): Update workspace build scripts

Improve workspace build orchestration and dependency management.

- Add prebuild hooks for Lambda compilation
- Update workspace package.json scripts
- Fix circular build dependencies

Skill: conventional-commits
```

**Rationale:** Changes to workspace configuration (package.json, build scripts) use chore(monorepo).

### 11. Single-Repo Build Configuration

```
build(infra): Add TypeScript path aliases for imports

Configure shorter import paths for infrastructure modules.

- Add paths to tsconfig.json
- Update imports across modules
- Document alias usage in README

Skill: conventional-commits
```

**Rationale:** Single-repo build config uses build(infra) or chore(build).

## GitHub File Categorization

**Critical Distinction:** Not all `.github/` files are CI/CD.

### CI/CD Automation (type: ci, scope: tools)

```
.github/workflows/deploy.yaml
.github/workflows/test.yaml
.github/workflows/lint.yaml
.github/actions/custom-action/
```

**Why ci(tools):** These execute code and automate processes.

### Repository Meta Files (type: chore, scope: github)

```
.github/pull_request_template.md
.github/PULL_REQUEST_TEMPLATE/
.github/ISSUE_TEMPLATE/
.github/CODEOWNERS
.github/FUNDING.yml
.github/SECURITY.md
```

**Why chore(github):** These configure repository behavior but don't execute code.

## Common Mistakes and Corrections

### Mistake 1: Treating Pipeline Infrastructure as Features

❌ **Wrong:**
```
feat(deployment): Add Slack notifications to pipeline
```

✅ **Correct:**
```
chore(deployment): Add Slack notifications to pipeline
```

**Reason:** Pipeline infrastructure is tooling, not application features.

---

### Mistake 2: Using 'tools' Scope for PR Templates

❌ **Wrong:**
```
feat(tools): Add emoji indicators to PR template
```

✅ **Correct:**
```
chore(github): Add emoji indicators to PR template
```

**Reason:** PR templates are GitHub meta files, not developer tooling scripts.

---

### Mistake 3: Overly Broad Scope

❌ **Wrong:**
```
feat(infra): Add new microservice
```

✅ **Correct:**
```
feat(service): Add profile microservice to production
```

**Reason:** Use specific scope (service, lambda, api) unless truly cross-cutting.

---

### Mistake 4: Documentation Accompanying Code

❌ **Wrong:**
```
# Two separate commits:
1. feat(lambda): Add edge function
2. docs(lambda): Document edge function
```

✅ **Correct:**
```
# One commit:
feat(lambda): Add edge function for CloudFront request handling

Implement Lambda@Edge function for custom request transformations.

- Add EdgeFunction construct with certificate support
- Configure CloudFront distribution integration
- Document usage in CLAUDE.md

Skill: conventional-commits
```

**Reason:** Documentation accompanying implementation belongs in same commit.

## Monorepo vs Single-Repo Variations

### Monorepo-Specific Scopes

Use these when you have workspace packages:

- **monorepo**: Workspace config (root package.json, tsconfig.json)
- **lambda**: Workspace package (packages/lambda/)
- **shared**: Shared utilities package (packages/shared/)
- **infra**: Infrastructure package (packages/infra/)

### Single-Repo Scopes

Simpler, module-based:

- **build**: Build configuration (package.json, tsconfig.json)
- **lambda**: Lambda module (lib/lambda/)
- **infra**: Cross-cutting infrastructure changes

## Specificity Checklist

Before committing, ask yourself:

### ✅ Question 1: Can someone understand WHAT changed without reading the diff?

**Good Answer:** "Yes, the title mentions specific sections/functions/features"
**Bad Answer:** "No, title only says 'refactor', 'update', or 'improve'"

### ✅ Question 2: Does the title use specific nouns?

**Good Examples:**
- "Remove Architecture Benefits section"
- "Add retry logic for SNS publish failures"
- "Extract IAM role creation to dedicated method"

**Bad Examples:**
- "Remove human-oriented content"
- "Add error handling"
- "Improve code quality"

### ✅ Question 3: Would this title be useful in a changelog?

**Good Answer:** "Yes, users/developers can see exactly what changed"
**Bad Answer:** "No, too vague to be meaningful in changelog"

## Good Title Patterns

Proven patterns for clear commit titles:

- ✅ "Add [specific feature/section/component]"
- ✅ "Remove [specific feature/section/component]"
- ✅ "Fix [specific bug/issue with context]"
- ✅ "Update [specific field/value] in [specific file/config]"
- ✅ "Rename [old name] to [new name]"
- ✅ "Move [what] from [where] to [where]"
- ✅ "Extract [what] to [new location]"
- ✅ "Replace [old thing] with [new thing]"

## Bad Title Patterns

Patterns that are usually too vague:

- ❌ "Refactor [file name]" (unless explaining WHAT was refactored)
- ❌ "Update [file name]" (without saying WHAT was updated)
- ❌ "Improve [generic thing]" (what specific improvement?)
- ❌ "Fix issues" (which issues? what was broken?)
- ❌ "Clean up code" (what cleaning was done?)
- ❌ "Remove content" (what content specifically?)

## Notes for Claude Code

When using this guide:

1. **Always consult the decision tree** before selecting type
2. **Map files to scopes** using Step 1 patterns
3. **Apply multi-file rules** from Step 2
4. **Check anti-patterns** before generating message
5. **Use examples** as templates for similar changes
6. **Ask user if unclear** - better to clarify than guess wrong type/scope

Remember: **Type describes WHAT KIND of change** (feat, fix, refactor), **Scope describes WHERE** (lambda, config, tools).
