# CDK Fundamentals

Core concepts and lifecycle of AWS CDK applications.

## L1, L2, L3 Constructs

### L1 (Cfn\*) - CloudFormation Resources

- Direct 1:1 mapping to CloudFormation
- Names start with `Cfn` (e.g., `CfnBucket`, `CfnDatabase`)
- Use when L2 doesn't exist or you need exact CloudFormation control
- **Important:** Only L1 constructs support `overrideLogicalId()`

**When to use L1:**
```typescript
// Example: Need exact CloudFormation control
const cfnBucket = new s3.CfnBucket(this, 'MyBucket', {
  bucketName: 'my-exact-name',
})

// Override logical ID to prevent replacement
cfnBucket.overrideLogicalId('ExistingLogicalID123')
```

### L2 - Curated Resources

- Higher-level abstractions with sensible defaults
- Better developer experience
- Most AWS resources have L2 constructs
- Recommended for most use cases

**When to use L2:**
```typescript
// Example: Standard resource with good defaults
const bucket = new s3.Bucket(this, 'MyBucket', {
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
})
```

### L3 - Patterns

- Multi-resource patterns (e.g., ApplicationLoadBalancedFargateService)
- AWS Solutions Constructs
- Custom patterns you build

**When to use L3:**
```typescript
// Example: Complete application pattern
new ApplicationLoadBalancedFargateService(this, 'Service', {
  cluster,
  taskImageOptions: { image: ContainerImage.fromRegistry('nginx') },
  // Creates: ALB, Target Group, ECS Service, Task Definition, Security Groups
})
```

---

## CDK App Lifecycle

```
cdk synth   →   CloudFormation Template   →   cdk deploy   →   AWS Resources
   ↓                                              ↓
Validation                                   Stack Updates
   ↓                                              ↓
Asset Build                                  Resource Changes
```

### Phase 1: Synthesis (cdk synth)

**What happens:**
- CDK app code executes (TypeScript/Python/etc.)
- Constructs build in-memory tree
- Validation runs (e.g., required props, CDK Nag)
- Assets compiled (Lambda functions, Docker images)
- CloudFormation template generated

**Output:**
- `cdk.out/` directory with CloudFormation JSON
- Asset manifests
- Tree.json (construct tree visualization)

### Phase 2: Deployment (cdk deploy)

**What happens:**
- Assets uploaded to S3 (Lambda code, Docker images)
- CloudFormation change set created
- Stack updated (creates/updates/deletes resources)
- Outputs displayed

**Deploy modes:**
- `cdk deploy` - Deploy stack
- `cdk deploy --all` - Deploy all stacks
- `cdk deploy --hotswap` - Fast dev deployments (skip CloudFormation for Lambdas)

### Phase 3: Resource Updates

**CloudFormation determines:**
- **Create:** New resource needed
- **Update:** Resource properties changed (no replacement)
- **Replace:** Resource replaced (old deleted, new created)
- **Delete:** Resource no longer needed

**Critical:** Replacements can cause:
- Data loss (S3, DynamoDB, RDS)
- Downtime (ALB, ECS)
- Breaking changes (ARN changes)

---

## CDK Commands Quick Reference

| Command | Description |
|---------|-------------|
| `cdk init` | Create new CDK app |
| `cdk synth` | Synthesize CloudFormation template |
| `cdk diff` | Show differences before deployment |
| `cdk deploy` | Deploy stack to AWS |
| `cdk destroy` | Delete stack from AWS |
| `cdk ls` | List stacks in app |
| `cdk doctor` | Check CDK environment |
| `cdk context` | Manage CDK context |

---

## Best Practices

✅ **Always run `cdk diff` before deployment**
- Shows resource changes (create/update/replace/delete)
- Identifies dangerous replacements
- Preview impact before committing

✅ **Use CDK context for environment-specific values**
```typescript
const vpc = Vpc.fromLookup(this, 'VPC', {
  vpcId: this.node.tryGetContext('vpcId'),
})
```

✅ **Leverage CDK validation**
```typescript
if (props.minCapacity > props.maxCapacity) {
  throw new Error('minCapacity cannot exceed maxCapacity')
}
```

❌ **Don't hardcode account/region**
```typescript
// ❌ Bad
const account = '123456789012'

// ✅ Good
const account = Stack.of(this).account
```
