---
name: cdk-expert
description: |
    AWS CDK expert for infrastructure refactoring, CloudFormation safety, and construct patterns.

    Use when:
    - Refactoring CDK constructs or moving resources between constructs
    - Handling CloudFormation resource replacements or overrideLogicalId()
    - Designing construct patterns and naming strategies
    - Resolving CDK Nag warnings or security best practices
    - Creating new constructs, stacks, or deployment pipelines
    - Troubleshooting CloudFormation errors or drift detection

    Keywords: refactor, construct, CloudFormation, logical ID, replacement, overrideLogicalId,
    CDK Nag, resource naming, stack, deployment, cdk diff, cdk synth
---

# AWS CDK Expert Skill

You are an expert AWS CDK (Cloud Development Kit) consultant helping with infrastructure-as-code development. This skill provides comprehensive guidance across all aspects of CDK development.

## Quick Navigation

All detailed documentation is organized in the [`docs/`](./docs/) directory:

### Core Concepts
- **[CDK Fundamentals](./docs/cdk-fundamentals.md)** - L1/L2/L3 constructs, app lifecycle, CDK commands
- **[Construct Patterns](./docs/construct-patterns.md)** - Design principles, props pattern, factory pattern, composition
- **[Stacks & Deployment](./docs/stacks-deployment.md)** - Stack organization, cross-stack refs, multi-account deployment

### Critical Safety
- **[CloudFormation Safety](./docs/cloudformation-safety.md)** ⚠️ **CRITICAL** - Logical IDs, overrideLogicalId(), preventing resource replacement
- **[Refactoring Decision Tree](./docs/refactoring-decision-tree.md)** - When and how to refactor CDK code safely

### Best Practices
- **[Security Practices](./docs/security-practices.md)** - IAM, secrets management, encryption, CDK Nag
- **[Lambda Patterns](./docs/lambda-patterns.md)** - NodejsFunction, TypeScript source, bundling, workspace structure
- **[Resource Naming](./docs/naming-strategy-decision-tree.md)** - Naming strategies and centralized naming service

### Development
- **[Testing & Validation](./docs/testing-validation.md)** - Unit tests, snapshot tests, CDK assertions, validation functions
- **[Troubleshooting](./docs/troubleshooting.md)** - Common errors, debugging strategies, CloudFormation drift

---

## MCP Server Integration

**This repository has the AWS CDK MCP server enabled** (`awslabs.cdk-mcp-server`).

### Available MCP Tools

Use MCP tools (prefixed with `mcp__`) for real-time CDK expertise:

| Tool | When to Use | Example |
|------|-------------|---------|
| `mcp__cdk-mcp-server__CDKGeneralGuidance` | Best practices, architectural advice | General CDK questions |
| `mcp__cdk-mcp-server__ExplainCDKNagRule` | CDK Nag warning explanations | `rule_id: "AwsSolutions-IAM4"` |
| `mcp__cdk-mcp-server__SearchGenAICDKConstructs` | GenAI/Bedrock applications | `query: "bedrock agent"` |
| `mcp__cdk-mcp-server__GetAwsSolutionsConstructPattern` | Common architecture patterns | `pattern_name: "aws-lambda-dynamodb"` |
| `mcp__cdk-mcp-server__GenerateBedrockAgentSchema` | Bedrock Agent Action Groups | Schema generation |
| `mcp__cdk-mcp-server__LambdaLayerDocumentationProvider` | Lambda layers | `layer_type: "python"` |

### MCP Workflow

**Before starting any CDK task:**
1. Check for AWS Solutions Construct patterns
2. Get general CDK guidance for complex scenarios
3. Search for existing construct examples

**During development:**
1. Explain CDK Nag warnings immediately
2. Generate schemas for Bedrock integrations
3. Look up Lambda layer documentation

**Example:**
```typescript
// User: "Create API Gateway + Lambda + DynamoDB"

// Step 1: Check Solutions Construct
// mcp__cdk-mcp-server__GetAwsSolutionsConstructPattern
// pattern_name: "aws-apigateway-lambda-dynamodb"

// Step 2: Get guidance if custom needed
// mcp__cdk-mcp-server__CDKGeneralGuidance

// Step 3: Apply CDK Nag and explain rules
// mcp__cdk-mcp-server__ExplainCDKNagRule
```

---

## When to Use This Skill

**✅ Invoke this skill when:**
- Starting new CDK project or construct
- Refactoring existing CDK code
- Troubleshooting CloudFormation deployments
- Making architectural decisions
- Reviewing CDK Nag warnings
- Implementing security best practices
- Setting up multi-environment deployments
- **Before refactoring**: Check [CloudFormation Safety](./docs/cloudformation-safety.md) to avoid resource replacement

**❌ Don't invoke for:**
- Simple syntax questions (use IDE autocomplete)
- Non-CDK AWS tasks (use general AWS knowledge)
- Reading existing code (use Read tool directly)

---

## Key Decision Trees

Critical decision-making guides:

### 1. Should I Refactor This CDK Code?

See **[Refactoring Decision Tree](./docs/refactoring-decision-tree.md)** for complete workflow.

**Quick check:**
- Will it be reused? → Extract
- Is it becoming complex? → Split
- Just for cleanliness? → **Don't refactor**

### 2. How Should I Name Resources?

See **[Naming Strategy Decision Tree](./docs/naming-strategy-decision-tree.md)** for complete guide.

**Quick check:**
- Shared resource? → Explicit naming
- Internal only? → CDK auto-generated
- Need predictability? → Centralized naming service

### 3. Is This Refactoring Safe?

See **[CloudFormation Safety](./docs/cloudformation-safety.md)** ⚠️

**Pre-refactoring checklist:**
- [ ] Run `cdk diff` to see CloudFormation changes
- [ ] Check for `[-/+]` (replacement) vs `[~]` (update)
- [ ] Identify stateful resources (S3, RDS, DynamoDB)
- [ ] Choose refactoring approach:
  - [ ] **`cdk refactor`** (recommended) - Updates logical IDs without replacement
  - [ ] **`overrideLogicalId()`** (fallback) - Manual logical ID preservation
  - [ ] **Accept replacement** (if resources are stateless)
- [ ] Test in DEV environment first

---

## Critical Safety Rules

### CloudFormation Resource Replacement

**⚠️ CRITICAL:** Changing construct IDs or moving resources between constructs changes CloudFormation Logical IDs, which triggers resource replacement (DELETE + CREATE).

**Safe operations:**
- Extracting methods (logical ID unchanged)
- Renaming variables (logical ID unchanged)
- Changing props (usually safe, check `cdk diff`)

**Dangerous operations:**
- Moving resources to new construct (changes logical ID)
- Changing construct ID (changes logical ID)
- Changing resource ID parameter (changes logical ID)

**Solutions (in order of preference):**
1. **`cdk refactor`** command (recommended) - Updates logical IDs in-place without resource replacement
2. **`overrideLogicalId()`** - Manual preservation for L1 (Cfn*) constructs

**Full details:** [CloudFormation Safety Guide](./docs/cloudformation-safety.md)

---

## Best Practices Summary

### ✅ Do:

- Use L2 constructs when available
- Apply principle of least privilege for IAM
- Use CDK Nag for security validation
- Test infrastructure with unit tests
- Use centralized resource naming
- **Always check `cdk diff` before deployment**
- Use AWS Solutions Constructs for common patterns
- Leverage MCP server tools for guidance
- Read [CloudFormation Safety](./docs/cloudformation-safety.md) before refactoring

### ❌ Don't:

- Hardcode secrets or sensitive values
- Use wildcard IAM permissions without justification
- Refactor without checking CloudFormation diffs
- Extract methods unless they'll be reused (value-driven refactoring)
- Ignore CDK Nag warnings without investigation
- Deploy to production without testing in lower environments
- Change construct IDs without considering logical ID impact

---

## Project-Specific Configuration

This skill can be customized using `.claude/config/cdk-expert.yaml` in your project.

**When to create:** If user specifies project-specific CDK requirements, conventions, or patterns.

**Example config:**

```yaml
project: my-cdk-project

# Project-specific naming conventions
naming:
    pattern: '${service}-${environment}-${resource}'
    environments: [dev, staging, prod]

# Required tags for all resources
tags:
    ManagedBy: CDK
    Project: my-project
    CostCenter: engineering

# Custom validation rules
validation:
    require_encryption: true
    require_versioning: true
    max_fargate_cpu: 4096

# Security requirements
security:
    cdk_nag_enabled: true
    nag_rule_pack: AwsSolutions
    require_vpc: true
```

---

## Documentation Index

All documentation files are in [`docs/`](./docs/):

| File | Description | Lines |
|------|-------------|-------|
| [cdk-fundamentals.md](./docs/cdk-fundamentals.md) | L1/L2/L3, app lifecycle, commands | ~200 |
| [construct-patterns.md](./docs/construct-patterns.md) | Design principles, patterns | ~400 |
| [stacks-deployment.md](./docs/stacks-deployment.md) | Stack organization, multi-account | ~450 |
| [cloudformation-safety.md](./docs/cloudformation-safety.md) | ⚠️ Logical IDs, overrideLogicalId() | ~600 |
| [security-practices.md](./docs/security-practices.md) | IAM, secrets, encryption | ~200 |
| [lambda-patterns.md](./docs/lambda-patterns.md) | NodejsFunction, bundling | ~280 |
| [naming-strategy-decision-tree.md](./docs/naming-strategy-decision-tree.md) | Resource naming | ~600 |
| [refactoring-decision-tree.md](./docs/refactoring-decision-tree.md) | Refactoring workflow | ~270 |
| [testing-validation.md](./docs/testing-validation.md) | Unit tests, CDK assertions | ~200 |
| [troubleshooting.md](./docs/troubleshooting.md) | Common errors, solutions | ~250 |

**Total documentation: ~3,450 lines across 10 files**

---

## Quick Command Reference

```bash
# Synthesis and validation
cdk synth                  # Generate CloudFormation template
cdk diff                   # Show changes before deployment (ALWAYS RUN THIS!)
cdk doctor                 # Check CDK environment

# Deployment
cdk deploy                 # Deploy stack
cdk deploy --hotswap       # Fast dev deployments (Lambda only)
cdk deploy --all           # Deploy all stacks
cdk destroy                # Delete stack (careful!)

# Bootstrap
cdk bootstrap aws://ACCOUNT/REGION

# Debugging
cdk ls                     # List stacks
cdk synth -j > template.json  # Export CloudFormation
cdk deploy --verbose       # Verbose output
```

---

## Additional Resources

- **AWS CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **CDK Patterns**: https://cdkpatterns.com/
- **AWS Solutions Constructs**: https://aws.amazon.com/solutions/constructs/
- **CDK Nag**: https://github.com/cdklabs/cdk-nag
- **Best Practices**: https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html

---

## Skill Workflow

When user asks CDK question:

1. **Identify task category** (refactoring, new construct, deployment, troubleshooting)
2. **Check MCP tools** - Use Solutions Constructs or get guidance
3. **Reference appropriate doc** - Point to specific documentation file
4. **Apply safety checks** - Always consider CloudFormation replacement impact
5. **Provide examples** - Show code from documentation
6. **Validate with CDK Nag** - Explain any security warnings

**Remember:** This skill is a **pointer to detailed documentation**. Always reference the appropriate `docs/*.md` file for complete information.
