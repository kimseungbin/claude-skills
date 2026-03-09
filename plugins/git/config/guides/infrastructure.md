---
implementation: infrastructure
project_types:
  - AWS CDK
  - Terraform
  - Pulumi
  - CloudFormation
---

# Infrastructure Commit Guide

Commit patterns for Infrastructure as Code (IaC) projects.

## Type Decision Tree

```
Code Change Made
│
├─ Adds NEW infrastructure for applications?
│  └─ YES → feat(scope)
│      ✅ New microservice, AWS resource, capability
│      ❌ NOT for: CI/CD pipeline → chore(deployment)
│
├─ Fixes BROKEN infrastructure?
│  └─ YES → fix(scope)
│      ✅ Misconfigured resource, failing deployment
│
├─ Changes CODE STRUCTURE only? (lib/, bin/, src/, types/)
│  └─ YES → refactor(scope)
│      ✅ Extract method, rename, reorganize
│      ❌ NOT for: .github/workflows/ → ci(github)
│
├─ CI/CD PIPELINE infrastructure?
│  └─ YES → chore(deployment)
│      ✅ CodePipeline, GitHub Actions for deployment
│
├─ DEVELOPER TOOLING?
│  └─ YES → chore(tools) or ci(github)
│      ✅ Git hooks, linters, workflows
│
└─ DOCUMENTATION ONLY?
   └─ YES → docs(scope)
```

## Scope Patterns

### Construct Files
```
lib/constructs/lambda/     → lambda
lib/constructs/cloudfront/ → cloudfront
lib/constructs/database/   → database
lib/main-stack.ts          → main
lib/deployment-stack.ts    → deployment
```

### Configuration
```
src/config/    → config
types/         → types
package.json   → monorepo
```

### Tooling
```
.github/workflows/ → tools (with type=ci)
scripts/           → tools
.githooks/         → tools
```

## Multi-File Rules

1. **Same construct** → Use construct scope
2. **Construct + stack** → Use primary construct scope
3. **Unrelated constructs** → Split commits or use 'infra'
4. **Configuration affecting multiple** → Use 'config'

## Examples

### Feature
```
feat(lambda): Add custom domain support for edge functions
```

### Fix
```
fix(config): Correct memory limit for auth service
```

### Refactor
```
refactor(service): Extract ServiceInfraConstruct
```

### Chore (Deployment)
```
chore(deployment): Add Slack notifications to pipeline
```

### CI
```
ci(tools): Add CloudFormation drift detection workflow
```

## Anti-patterns

❌ `feat(deployment): Add notifications` - Should be chore
❌ `feat(infra): Add Lambda` - Too vague, use specific scope
❌ `refactor(main): Update` - Describe WHAT was refactored
❌ `refactor(ci): Update workflows` - Use ci() for .github/workflows changes, not refactor