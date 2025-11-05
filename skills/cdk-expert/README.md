# CDK Expert Skill

Comprehensive AWS CDK (Cloud Development Kit) expert assistant for infrastructure-as-code development.

## What This Skill Does

This skill provides expert guidance on all aspects of AWS CDK development:

- **Constructs & Patterns**: Design reusable, composable infrastructure components
- **Stacks & Deployment**: Organize and deploy multi-environment infrastructure
- **Refactoring**: Value-driven refactoring without breaking CloudFormation
- **Resource Naming**: Environment-based naming strategy (dynamic in DEV, fixed in STAGING/PROD)
- **CloudFormation Safety**: Avoid accidental resource replacement
- **Security**: IAM best practices, secrets management, CDK Nag integration
- **Testing**: Unit tests, snapshot tests, validation functions
- **MCP Integration**: Leverage CDK MCP server tools for guidance

## When to Use

Invoke this skill when:

- Starting any new CDK project or construct
- Refactoring existing CDK code
- Deciding on naming strategy before promoting to STAGING/PROD
- Troubleshooting CloudFormation deployments
- Making architectural decisions
- Reviewing CDK Nag warnings
- Implementing security best practices
- Setting up multi-environment deployments

## Key Philosophy

### Refactoring

- ❌ Don't extract methods unless they'll be reused (pointless busywork)
- ✅ Do separate constructs when concerns need independent evolution
- Always check `cdk diff` before refactoring

### Resource Naming

- **DEV**: Dynamic names OK (fast iteration)
- **STAGING/PROD**: Fixed names REQUIRED (predictability)
- Always fix names before promoting from DEV

### CloudFormation Safety

- Use `overrideLogicalId()` to avoid resource replacement when refactoring
- Know which resources are safe vs unsafe to replace
- Blue-green deployment for complex migrations (last resort)

## Supporting Files

- **`SKILL.md`**: Complete skill prompt with all guidance
- **`refactoring-decision-tree.md`**: When and how to refactor CDK code
- **`naming-strategy-decision-tree.md`**: Choosing resource naming approach with migration strategies

## Project-Specific Configuration

Create `.claude/config/cdk-expert.yaml` in your project for custom settings:

```yaml
project: my-cdk-project

naming:
    pattern: '${service}-${environment}-${resource}'
    environments: [dev, staging, prod]

tags:
    ManagedBy: CDK
    Project: my-project

security:
    cdk_nag_enabled: true
    nag_rule_pack: AwsSolutions
```

## Examples

### Resource Naming Evolution

```typescript
// DEV: Dynamic names (fast iteration)
const bucket = new Bucket(this, 'Data', {
	// No bucketName - CDK generates unique name
})

// STAGING/PROD: Fixed names (predictable)
const naming = new ResourceNamingService(environment, serviceName)
const bucket = new Bucket(this, 'Data', {
	bucketName: naming.getBucketName('data'), // Fixed: myservice-data-prod-123456789012
})
```

### Safe Refactoring with overrideLogicalId()

```typescript
// Before: Resource in OldConstruct
export class OldConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Old"
    const db = new CfnDatabase(this, 'Database', {...})
    // Logical ID: OldDatabaseABC123
  }
}

// After: Move to NewConstruct without replacement
export class NewConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "New"

    const db = new CfnDatabase(this, 'Database', {...})
    db.overrideLogicalId('OldDatabaseABC123')  // Preserve ID
    // CloudFormation sees same resource → UPDATE, not REPLACE
  }
}
```

### MCP Server Integration

```typescript
// Use CDK MCP tools for guidance
// 1. Check for AWS Solutions Constructs
//    Tool: mcp__cdk-mcp-server__GetAwsSolutionsConstructPattern
//    pattern_name: "aws-lambda-dynamodb"

// 2. Explain CDK Nag warnings
//    Tool: mcp__cdk-mcp-server__ExplainCDKNagRule
//    rule_id: "AwsSolutions-IAM4"

// 3. Search GenAI constructs
//    Tool: mcp__cdk-mcp-server__SearchGenAICDKConstructs
//    query: "bedrock agent"
```

## Quick Reference

### Refactoring Checklist

- [ ] Identify clear benefit (reuse, separation, testing)
- [ ] Run `cdk diff` to check CloudFormation impact
- [ ] Identify resources that will be replaced
- [ ] Verify replaced resources are safe (stateless)
- [ ] Plan `overrideLogicalId()` if needed
- [ ] Test in DEV first

### Promotion Checklist (DEV → STAGING)

- [ ] Add ResourceNamingService
- [ ] Fix names for all stateful resources
- [ ] Fix names for important stateless resources
- [ ] Run `cdk diff` and verify no unexpected replacements
- [ ] Deploy to STAGING
- [ ] Verify resource names in AWS Console

### Blue-Green Migration

- [ ] Try `overrideLogicalId()` first (safest)
- [ ] If that fails, try import + manual migration
- [ ] Only use blue-green if necessary
- [ ] Both deployments within 30 minutes
- [ ] Monitor closely, have rollback plan

## Resources

- AWS CDK Documentation: https://docs.aws.amazon.com/cdk/
- CDK Patterns: https://cdkpatterns.com/
- AWS Solutions Constructs: https://aws.amazon.com/solutions/constructs/
- CDK Nag: https://github.com/cdklabs/cdk-nag
