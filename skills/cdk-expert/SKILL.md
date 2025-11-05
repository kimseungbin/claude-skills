---
name: cdk-expert
description: |
  Comprehensive AWS CDK (Cloud Development Kit) expert assistant for infrastructure-as-code development.
  Covers constructs, stacks, refactoring, resource naming, CloudFormation safety, security best practices,
  and integration with CDK MCP server tools. Use when working with any CDK-related tasks.
---

# AWS CDK Expert Skill

You are an expert AWS CDK (Cloud Development Kit) consultant helping with infrastructure-as-code development. This skill provides comprehensive guidance across all aspects of CDK development.

## Table of Contents

1. [CDK Fundamentals](#cdk-fundamentals)
2. [Constructs & Patterns](#constructs--patterns)
3. [Stacks & Deployment](#stacks--deployment)
4. [Refactoring Strategy](#refactoring-strategy)
5. [Resource Naming](#resource-naming)
6. [CloudFormation Safety](#cloudformation-safety)
7. [Security Best Practices](#security-best-practices)
8. [Testing & Validation](#testing--validation)
9. [MCP Server Integration](#mcp-server-integration)
10. [Troubleshooting](#troubleshooting)

---

## CDK Fundamentals

### L1, L2, L3 Constructs

**L1 (Cfn*) - CloudFormation Resources:**
- Direct 1:1 mapping to CloudFormation
- Names start with `Cfn` (e.g., `CfnBucket`, `CfnDatabase`)
- Use when L2 doesn't exist or you need exact CloudFormation control
- **Important:** Only L1 constructs support `overrideLogicalId()`

**L2 - Curated Resources:**
- Higher-level abstractions with sensible defaults
- Better developer experience
- Most AWS resources have L2 constructs
- Recommended for most use cases

**L3 - Patterns:**
- Multi-resource patterns (e.g., ApplicationLoadBalancedFargateService)
- AWS Solutions Constructs
- Custom patterns you build

### CDK App Lifecycle

```
cdk synth   →   CloudFormation Template   →   cdk deploy   →   AWS Resources
   ↓                                              ↓
Validation                                   Stack Updates
   ↓                                              ↓
Asset Build                                  Resource Changes
```

---

## Constructs & Patterns

### Construct Design Principles

**Single Responsibility:**
```typescript
// ❌ Bad: God construct doing everything
export class Service extends Construct {
  constructor() {
    // Creates: ECR, ECS, ALB, CloudFront, CodeBuild, Auto-scaling, etc.
  }
}

// ✅ Good: Focused constructs
export class ComputeService extends Construct {  // ECS/Fargate only
export class NetworkService extends Construct {  // ALB/Target Groups
export class BuildService extends Construct {    // CodeBuild
export class DistributionService extends Construct { // CloudFront
```

**Composition over Inheritance:**
```typescript
// ✅ Compose multiple focused constructs
export class ServiceOrchestrator extends Construct {
  constructor(scope, id, props) {
    super(scope, id)

    const compute = new ComputeService(this, 'Compute', {...})
    const network = new NetworkService(this, 'Network', {...})
    const distribution = new DistributionService(this, 'Distribution', {
      origin: network.loadBalancer
    })
  }
}
```

### Props Pattern

```typescript
// ✅ Define clear prop interfaces
export interface ServiceProps {
  // Required props (no defaults)
  vpc: IVpc
  cluster: ICluster

  // Optional props with defaults
  cpu?: number          // Default: 256
  memory?: number       // Default: 512
  desiredCount?: number // Default: 1
}

export class Service extends Construct {
  constructor(scope: Construct, id: string, props: ServiceProps) {
    super(scope, id)

    const cpu = props.cpu ?? 256
    const memory = props.memory ?? 512
    // ...
  }
}
```

### Factory Pattern

```typescript
// ✅ Use factories for repeated instantiation
class ServiceFactory {
  constructor(
    private scope: Construct,
    private sharedResources: SharedResources
  ) {}

  createService(serviceName: ServiceName): Service {
    return new Service(this.scope, serviceName, {
      vpc: this.sharedResources.vpc,
      cluster: this.sharedResources.cluster,
      // ... common props
    })
  }
}

// Usage
const factory = new ServiceFactory(this, sharedResources)
services.forEach(name => factory.createService(name))
```

---

## Stacks & Deployment

### Stack Organization

**Option 1: Single Stack (Simple Projects)**
```typescript
export class AppStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    // All resources here
  }
}
```

**Option 2: Nested Stacks (Modular)**
```typescript
export class VpcStack extends Stack { /* VPC resources */ }
export class ComputeStack extends Stack { /* ECS/Fargate */ }
export class DataStack extends Stack { /* RDS/DynamoDB */ }

// In app
new VpcStack(app, 'Vpc', { env })
new ComputeStack(app, 'Compute', { env })
new DataStack(app, 'Data', { env })
```

**Option 3: CDK Pipelines (Multi-Environment)**
```typescript
export class DeploymentStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)

    const pipeline = new CodePipeline(this, 'Pipeline', {
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(repo, branch),
        commands: ['npm ci', 'npm run build', 'npx cdk synth']
      })
    })

    pipeline.addStage(new DevStage(this, 'Dev'))
    pipeline.addStage(new ProdStage(this, 'Prod'))
  }
}
```

### Cross-Stack References

```typescript
// ✅ Export values for cross-stack use
export class VpcStack extends Stack {
  public readonly vpc: IVpc

  constructor(scope, id, props) {
    super(scope, id, props)
    this.vpc = new Vpc(this, 'Vpc', {...})
  }
}

// Import in another stack
export class ComputeStack extends Stack {
  constructor(scope, id, props: { vpcStack: VpcStack }) {
    super(scope, id)

    const vpc = props.vpcStack.vpc  // ✅ Type-safe reference
    new Cluster(this, 'Cluster', { vpc })
  }
}
```

### Environment-Specific Configuration

```typescript
// ✅ Type-safe environment config
interface EnvironmentConfig {
  account: string
  region: string
  cpu: number
  memory: number
  desiredCount: number
}

const environments: Record<string, EnvironmentConfig> = {
  dev: {
    account: '111111111111',
    region: 'us-east-1',
    cpu: 256,
    memory: 512,
    desiredCount: 1
  },
  prod: {
    account: '222222222222',
    region: 'us-east-1',
    cpu: 1024,
    memory: 2048,
    desiredCount: 3
  }
}

const config = environments[process.env.ENVIRONMENT || 'dev']
```

---

## Refactoring Strategy

### Value-Driven Refactoring

**❌ Don't refactor without value:**
- Extracting methods that won't be reused (pointless busywork)
- Moving code around without improving design
- "Cleaning up" that adds no benefit

**✅ Do refactor when:**
- You need to reuse code across constructs
- Concerns are mixed (e.g., CloudFront + log analytics together)
- Testing is difficult due to tight coupling
- You need independent evolution of components

### Method Extraction (When to Use)

```typescript
// ❌ Bad: Extract private method with no reuse
export class MyConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)
    this.bucket = this.createBucket()  // Only used once, not reusable
  }

  private createBucket(): Bucket {
    return new Bucket(this, 'Bucket', {...})  // Still 50 lines of config
  }
}
// Result: Constructor is shorter, but no actual benefit

// ✅ Good: Extract when method will be reused
export class MyConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)
    this.logBucket = this.createLogBucket('Logs')
    this.assetBucket = this.createLogBucket('Assets')  // Reused!
  }

  private createLogBucket(name: string): Bucket {
    return new Bucket(this, name, {
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      lifecycleRules: [{ expiration: Duration.days(30) }]
    })
  }
}
```

### Separating Constructs (When to Use)

```typescript
// ❌ Before: Mixed concerns
export class CloudFrontCommonConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)

    // CloudFront stuff
    this.cachePolicy = new CachePolicy(...)
    this.function = new Function(...)

    // Log analytics stuff (unrelated!)
    this.glueDatabase = new CfnDatabase(...)
    this.glueTable = new CfnTable(...)
  }
}

// ✅ After: Separated concerns
export class CloudFrontCommonConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)
    this.cachePolicy = new CachePolicy(...)
    this.function = new Function(...)
  }
}

export class LogAnalyticsConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)
    this.glueDatabase = new CfnDatabase(...)
    this.glueTable = new CfnTable(...)
  }
}
```

**When to separate:**
- Concerns can evolve independently
- Different teams own different parts
- You want to reuse one part without the other
- Testing would be easier with separation

---

## Resource Naming

### Naming Philosophy

**Fixed Names (Recommended):**
```typescript
// ✅ Predictable, debuggable
const repository = new Repository(this, 'Repo', {
  repositoryName: serviceName  // Fixed: "auth", "yozm", etc.
})

const targetGroup = new ApplicationTargetGroup(this, 'TG', {
  targetGroupName: `${serviceName}-${environment}`  // Fixed
})
```

**Pros:**
- Predictable across deployments
- Easier debugging (names visible in AWS Console)
- Consistent cross-environment references

**Cons:**
- Can block replacements during refactoring
- Name conflicts if deploying multiple times

**Dynamic Names (CDK-generated):**
```typescript
// ⚠️ Unpredictable
const repository = new Repository(this, 'Repo', {
  // No repositoryName - CDK generates: "MyStackRepo1234ABCD"
})
```

**Pros:**
- No name conflicts
- Easier to replace during refactoring

**Cons:**
- Harder to find in AWS Console
- Unpredictable names

### Centralized Naming Service

```typescript
// ✅ Best practice: Centralize naming logic
export class ResourceNamingService {
  constructor(
    private environment: string,
    private serviceName: string
  ) {}

  getEcrRepositoryName(): string {
    return this.serviceName
  }

  getTargetGroupName(visibility: 'public' | 'private'): string {
    return `${this.serviceName}-${visibility}-${this.environment}`
  }

  getRoleName(roleType: string): string {
    return `${this.serviceName}-${roleType}-${this.environment}`
  }

  // ... more naming methods
}

// Usage
const naming = new ResourceNamingService(environment, serviceName)
const repository = new Repository(this, 'Repo', {
  repositoryName: naming.getEcrRepositoryName()
})
```

---

## CloudFormation Safety

### Understanding Logical IDs

**What is a Logical ID?**
- CloudFormation identifies each resource by a unique "logical ID" in the template
- CDK auto-generates these from construct tree path: `{ParentId}{ChildId}{Hash}`
- Example: `CloudFrontCommonCloudFrontLOgsDatabaseABC123`
- **Changing the logical ID forces resource replacement**

### Safe Refactoring (No Replacement)

```typescript
// ✅ Extracting methods - logical IDs unchanged
export class MyConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "MyConstruct"
    this.bucket = this.createBucket()
  }

  private createBucket() {
    return new Bucket(this, 'Bucket', {...})
    // Logical ID: MyConstructBucketXXX (unchanged)
  }
}
```

### Dangerous Refactoring (Will Replace!)

```typescript
// ⚠️ Moving to new construct changes logical ID
// Before:
export class OldConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Old"
    const db = new CfnDatabase(this, 'Database', {...})
    // Logical ID: OldDatabaseABC123
  }
}

// After:
export class NewConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "New"
    const db = new CfnDatabase(this, 'Database', {...})
    // Logical ID: NewDatabaseXYZ789  ❌ DIFFERENT!
    // CloudFormation will DELETE old DB and CREATE new one
  }
}
```

### Using overrideLogicalId()

```typescript
// ✅ Preserve logical ID to avoid replacement
export class NewConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "New"

    const db = new CfnDatabase(this, 'Database', {...})
    db.overrideLogicalId('OldDatabaseABC123')  // Preserve old ID
    // CloudFormation recognizes as same resource → UPDATE only
  }
}
```

**Finding existing logical IDs:**
```bash
# Method 1: Synthesize template
npm run cdk synth > template.json
grep -B 2 -A 5 "Database" template.json

# Method 2: AWS Console
# CloudFormation → Stack → Resources → Logical ID column

# Method 3: AWS CLI
aws cloudformation describe-stack-resources \
  --stack-name MyStack \
  --query 'StackResources[?ResourceType==`AWS::Glue::Database`]'
```

### Safe vs Unsafe Replacements

**Safe to Replace (Stateless):**
- Glue databases/tables (metadata only, data in S3)
- Lambda functions (code stored in S3)
- IAM roles (no state)
- CloudFront distributions (config only)

**Unsafe to Replace (Stateful):**
- S3 buckets (data loss unless exported)
- DynamoDB tables (data loss unless backed up)
- RDS databases (data loss unless snapshotted)
- ECR repositories (image history lost)

### Pre-Refactoring Checklist

Before refactoring infrastructure code:

- [ ] Run `npm run cdk diff` to see CloudFormation changes
- [ ] Identify resources that will be replaced (`[-/+]` in diff)
- [ ] Check if replaced resources are stateful
- [ ] Plan data migration/backup if needed
- [ ] Consider using `overrideLogicalId()` to preserve IDs
- [ ] Test in DEV environment first
- [ ] Document the refactoring plan

---

## Security Best Practices

### IAM Policies

**❌ Avoid wildcards:**
```typescript
// Bad: Overly permissive
new PolicyStatement({
  actions: ['s3:*'],
  resources: ['*']
})
```

**✅ Principle of least privilege:**
```typescript
// Good: Specific actions and resources
new PolicyStatement({
  actions: ['s3:GetObject', 's3:PutObject'],
  resources: [`arn:aws:s3:::${bucketName}/*`]
})
```

### Secrets Management

**❌ Hardcoded secrets:**
```typescript
// Bad: Secret in code
const apiKey = 'random-value-1234567890'
```

**✅ Secrets Manager or SSM:**
```typescript
// Good: Reference secret
const secret = Secret.fromSecretNameV2(this, 'Secret', 'my-api-key')

// In task definition
container.addEnvironment('API_KEY',
  ecs.Secret.fromSecretsManager(secret)
)
```

### CDK Nag Integration

```typescript
import { AwsSolutionsChecks } from 'cdk-nag'

const app = new App()
const stack = new MyStack(app, 'MyStack')

// Apply CDK Nag security checks
AwsSolutionsChecks.check(app)
```

**Use CDK MCP Server to explain Nag rules:**
```typescript
// If you see: AwsSolutions-IAM4: The IAM user, role, or group uses AWS managed policies
// Use: mcp__cdk-mcp-server__ExplainCDKNagRule with rule_id: "AwsSolutions-IAM4"
```

---

## Testing & Validation

### Unit Tests

```typescript
import { Template } from 'aws-cdk-lib/assertions'

describe('MyStack', () => {
  it('creates S3 bucket with encryption', () => {
    const app = new App()
    const stack = new MyStack(app, 'TestStack')
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [{
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        }]
      }
    })
  })
})
```

### Snapshot Tests

```typescript
it('matches snapshot', () => {
  const app = new App()
  const stack = new MyStack(app, 'TestStack')
  const template = Template.fromStack(stack)

  expect(template.toJSON()).toMatchSnapshot()
})
```

### Validation Functions

```typescript
// ✅ Fail fast with descriptive errors
function validateFargateConfig(cpu: number, memory: number): void {
  const validMemory = FARGATE_MEMORY[cpu]

  if (!validMemory?.includes(memory)) {
    throw new Error(
      `Invalid Fargate configuration: CPU ${cpu} does not support memory ${memory}.\n` +
      `Valid memory options for CPU ${cpu}: ${validMemory?.join(', ') || 'none'}\n` +
      `See: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html`
    )
  }
}
```

---

## MCP Server Integration

### Available CDK MCP Tools

When working with CDK, you have access to specialized MCP server tools:

**1. General Guidance:**
```typescript
// Use: mcp__cdk-mcp-server__CDKGeneralGuidance
// When: You need best practices or architectural advice
```

**2. CDK Nag Rule Explanation:**
```typescript
// Use: mcp__cdk-mcp-server__ExplainCDKNagRule
// When: You encounter a CDK Nag warning/error
// Example: rule_id: "AwsSolutions-IAM4"
```

**3. GenAI CDK Constructs Search:**
```typescript
// Use: mcp__cdk-mcp-server__SearchGenAICDKConstructs
// When: Building GenAI/Bedrock applications
// Example: query: "bedrock agent", construct_type: "bedrock"
```

**4. AWS Solutions Constructs:**
```typescript
// Use: mcp__cdk-mcp-server__GetAwsSolutionsConstructPattern
// When: Implementing common architecture patterns
// Example: pattern_name: "aws-lambda-dynamodb"
```

**5. Bedrock Agent Schema Generation:**
```typescript
// Use: mcp__cdk-mcp-server__GenerateBedrockAgentSchema
// When: Creating Bedrock Agent Action Groups
```

**6. Lambda Layer Documentation:**
```typescript
// Use: mcp__cdk-mcp-server__LambdaLayerDocumentationProvider
// When: Working with Lambda layers
// Example: layer_type: "python"
```

### When to Use MCP Tools

**Before starting any CDK task:**
1. Check if there's an AWS Solutions Construct for your use case
2. Look for existing patterns in GenAI constructs
3. Get general CDK guidance for complex scenarios

**During development:**
1. Explain CDK Nag warnings immediately
2. Search for construct examples when stuck
3. Generate schemas for Bedrock integrations

**Example workflow:**
```typescript
// User asks: "I need to create an API Gateway backed by Lambda with DynamoDB"

// Step 1: Check for Solutions Construct
// Use: mcp__cdk-mcp-server__GetAwsSolutionsConstructPattern
// pattern_name: "aws-apigateway-lambda-dynamodb"
// Result: Returns vetted pattern with best practices

// Step 2: If custom implementation needed, get guidance
// Use: mcp__cdk-mcp-server__CDKGeneralGuidance
// Result: Returns architectural recommendations

// Step 3: Implement with CDK Nag
// Apply AwsSolutionsChecks
// If warnings appear, use ExplainCDKNagRule for each
```

---

## Troubleshooting

### Common CDK Errors

**"Resolution error: Cannot find module"**
```bash
# Fix: Install missing dependencies
npm install @aws-cdk/aws-{service}-alpha
```

**"Stack has been deleted"**
```bash
# Fix: Re-bootstrap CDK
cdk bootstrap aws://{account}/{region}
```

**"No stacks match"**
```bash
# Fix: Check cdk.json for correct entry point
# Verify: "app": "npx ts-node bin/app.ts"
```

**"Resource replacement requires approval"**
```bash
# Option 1: Review and approve
cdk deploy --require-approval never

# Option 2: Use overrideLogicalId() to prevent replacement
```

### CloudFormation Drift

```bash
# Detect drift
aws cloudformation detect-stack-drift --stack-name MyStack

# View drift details
aws cloudformation describe-stack-resource-drifts --stack-name MyStack
```

---

## Workflow Integration

### When to Use This Skill

**Invoke this skill when:**
- Starting any new CDK project or construct
- Refactoring existing CDK code
- Troubleshooting CloudFormation deployments
- Making architectural decisions
- Reviewing CDK Nag warnings
- Implementing security best practices
- Setting up multi-environment deployments

**Don't invoke for:**
- Simple syntax questions (use IDE autocomplete)
- Non-CDK AWS tasks (use general AWS knowledge)
- Reading existing code (use Read tool directly)

### Decision Trees

See supporting files for detailed decision trees:
- `refactoring-decision-tree.md`: When and how to refactor
- `naming-strategy-decision-tree.md`: Choosing resource naming approach
- `construct-patterns.md`: Which construct pattern to use
- `security-checklist.md`: Pre-deployment security review

---

## Best Practices Summary

✅ **Do:**
- Use L2 constructs when available
- Apply principle of least privilege for IAM
- Use CDK Nag for security validation
- Test infrastructure with unit tests
- Use centralized resource naming
- Check `cdk diff` before deployment
- Use AWS Solutions Constructs for common patterns
- Leverage MCP server tools for guidance

❌ **Don't:**
- Hardcode secrets or sensitive values
- Use wildcard IAM permissions without justification
- Refactor without checking CloudFormation diffs
- Extract methods unless they'll be reused
- Ignore CDK Nag warnings without investigation
- Deploy to production without testing in lower environments

---

## Project-Specific Configuration

This skill can be customized using `.claude/config/cdk-expert.yaml` in your project.

**When to create:** If the user specifies project-specific CDK requirements, conventions, or patterns.

**Example config:**
```yaml
project: my-cdk-project

# Project-specific naming conventions
naming:
  pattern: "${service}-${environment}-${resource}"
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

## Additional Resources

- **AWS CDK Documentation**: https://docs.aws.amazon.com/cdk/
- **CDK Patterns**: https://cdkpatterns.com/
- **AWS Solutions Constructs**: https://aws.amazon.com/solutions/constructs/
- **CDK Nag**: https://github.com/cdklabs/cdk-nag
- **Best Practices**: https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html