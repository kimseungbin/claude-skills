# Troubleshooting

Common CDK errors, solutions, and debugging strategies.

## Common CDK Errors

### "Resolution error: Cannot find module"

**Error:**
```
Resolution error: Cannot find module '@aws-cdk/aws-lambda-alpha'
```

**Cause:** Missing or outdated dependencies

**Solution:**
```bash
# Install missing dependency
npm install @aws-cdk/aws-lambda-alpha

# Or install all dependencies
npm install

# Clear cache if issues persist
rm -rf node_modules package-lock.json
npm install
```

---

### "Stack has been deleted"

**Error:**
```
Stack MyStack was deleted, skipping deployment
```

**Cause:** CDKToolkit bootstrap stack was deleted or doesn't exist

**Solution:**
```bash
# Re-bootstrap CDK
cdk bootstrap aws://{account}/{region}

# Example
cdk bootstrap aws://123456789012/us-east-1

# For multiple regions
cdk bootstrap aws://123456789012/us-east-1 aws://123456789012/us-west-2
```

---

### "No stacks match"

**Error:**
```
No stacks match the criteria
```

**Cause:** CDK app entry point not found or incorrect

**Solution:**
```bash
# Check cdk.json for correct entry point
cat cdk.json | grep "app"

# Should be something like:
# "app": "npx ts-node --prefer-ts-exts bin/app.ts"

# Verify file exists
ls bin/app.ts

# Try explicit synthesis
npx ts-node bin/app.ts
```

---

### "Resource replacement requires approval"

**Error:**
```
This deployment will make potentially sensitive changes according to your current security approval level.
Please confirm you intend to make the following modifications:

IAM Statement Changes
┌───┬─────────────────┬────────┬────────────────┬───────────────┐
│   │ Resource        │ Effect │ Action         │ Principal     │
├───┼─────────────────┼────────┼────────────────┼───────────────┤
│ + │ ${MyBucket.Arn} │ Allow  │ s3:GetObject   │ AWS:${Role}   │
└───┴─────────────────┴────────┴────────────────┴───────────────┘
```

**Solution Option 1: Review and approve**
```bash
# Deploy with automatic approval (use carefully!)
cdk deploy --require-approval never

# Better: Review changes first
cdk diff
# Then approve if safe
cdk deploy
```

**Solution Option 2: Use overrideLogicalId()**
```typescript
// If replacement is unintended, preserve logical ID
const resource = new CfnResource(this, 'Resource', {...})
resource.overrideLogicalId('ExistingLogicalID')
```

---

### "Circular dependency"

**Error:**
```
Error: Cannot add dependency on stack B - it would create a circular dependency
```

**Cause:** Stack A depends on Stack B, and Stack B depends on Stack A

**Solution:**
```typescript
// Option 1: Merge stacks
// If tightly coupled, combine into single stack

// Option 2: Extract shared resource to new stack
export class SharedStack extends Stack {
  public readonly sharedResource: Resource

  constructor(scope, id) {
    super(scope, id)
    this.sharedResource = new Resource(this, 'Shared')
  }
}

// Both stacks depend on SharedStack (no circular dependency)
const shared = new SharedStack(app, 'Shared')
new StackA(app, 'A', { shared })
new StackB(app, 'B', { shared })
```

---

### "Cannot find context value"

**Error:**
```
Error: Cannot find context value for availability zones
```

**Cause:** CDK context not set or region not specified

**Solution:**
```typescript
// Specify env with account and region
new MyStack(app, 'Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
})

// Or use explicit values
new MyStack(app, 'Stack', {
  env: {
    account: '123456789012',
    region: 'us-east-1',
  },
})
```

---

## CloudFormation Issues

### Detecting Drift

**What is drift?**
Manual changes made to resources outside of CDK/CloudFormation

**Detect drift:**
```bash
# Start drift detection
aws cloudformation detect-stack-drift --stack-name MyStack

# Get drift detection ID
DRIFT_ID=$(aws cloudformation detect-stack-drift \
  --stack-name MyStack \
  --query 'StackDriftDetectionId' \
  --output text)

# Check status
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id $DRIFT_ID

# View drift details
aws cloudformation describe-stack-resource-drifts \
  --stack-name MyStack \
  --stack-resource-drift-status-filters MODIFIED DELETED
```

**Fix drift:**
```bash
# Option 1: Revert manual changes in AWS Console

# Option 2: Import changes to CDK
# Update CDK code to match actual state
# Then deploy
cdk deploy
```

---

### Stack is in UPDATE_ROLLBACK_COMPLETE state

**Error:**
```
Stack is in UPDATE_ROLLBACK_COMPLETE state and cannot be updated
```

**Cause:** Previous deployment failed and rolled back

**Solution:**
```bash
# Option 1: Continue update rollback
aws cloudformation continue-update-rollback --stack-name MyStack

# Option 2: Delete and recreate
aws cloudformation delete-stack --stack-name MyStack
# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name MyStack
# Redeploy
cdk deploy
```

---

## Deployment Issues

### Deployment hangs or takes too long

**Possible causes:**
- Large Lambda function deployment
- VPC creation (NAT Gateways take time)
- CloudFront distribution creation (15-20 minutes)
- Custom resource waiting for external dependency

**Solution:**
```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name MyStack \
  --max-items 20

# Look for "IN_PROGRESS" resources
# If stuck on specific resource, check resource-specific logs

# For Lambda, check CloudWatch Logs
# For Custom Resource, check Lambda logs
```

---

### "Bucket already exists"

**Error:**
```
MyBucket already exists
```

**Cause:** S3 bucket names are globally unique

**Solution:**
```typescript
// Don't hardcode bucket names
// ❌ Bad
new Bucket(this, 'MyBucket', {
  bucketName: 'my-app-bucket',  // May already exist globally
})

// ✅ Good: Let CDK generate unique name
new Bucket(this, 'MyBucket')

// ✅ Good: Add account/region to make unique
new Bucket(this, 'MyBucket', {
  bucketName: `my-app-${this.account}-${this.region}`,
})
```

---

## Debugging Strategies

### Enable CDK Debug Logging

```bash
# Verbose output
cdk deploy --verbose

# Debug mode
cdk deploy --debug

# Trace mode (most verbose)
cdk deploy --trace
```

### Synthesize and Inspect Template

```bash
# Generate CloudFormation template
cdk synth > template.json

# Pretty print
cdk synth | jq '.'

# Search for specific resource
cdk synth | jq '.Resources | with_entries(select(.value.Type == "AWS::S3::Bucket"))'
```

### Check CDK Context

```bash
# View context
cat cdk.context.json

# Clear cached context
cdk context --clear

# Reset specific context key
cdk context --reset availability-zones:account=123456789012:region=us-east-1
```

---

## Performance Issues

### Slow Synthesis

**Causes:**
- Too many resources in single stack
- Complex construct tree
- Slow validation functions

**Solutions:**
```typescript
// 1. Split into multiple stacks
// 2. Use CDK Pipelines for parallel deployment
// 3. Optimize validation functions
// 4. Cache expensive computations
```

### Slow Deployment

**Causes:**
- Many resources updating
- CloudFront distributions
- VPC creation

**Solutions:**
```bash
# Use hotswap for dev (fast Lambda updates)
cdk deploy --hotswap

# Deploy only changed stacks
cdk deploy Stack1 Stack2  # Not all stacks

# Use CDK Pipelines for parallel deployment
```

---

## Best Practices

✅ **Do:**
- Always run `cdk diff` before deployment
- Check CloudFormation events during deployment
- Enable CloudTrail for audit logs
- Use `cdk doctor` to check environment
- Keep CDK and constructs up to date

❌ **Don't:**
- Ignore warnings in `cdk diff`
- Deploy without testing in DEV first
- Make manual changes to deployed resources
- Delete CDKToolkit stack
- Use `--require-approval never` in production

---

## Useful Commands

```bash
# Check CDK environment
cdk doctor

# List all stacks
cdk ls

# Show differences
cdk diff

# Synthesize without deploying
cdk synth

# Deploy with rollback
cdk deploy --rollback

# Destroy stack (be careful!)
cdk destroy

# Get CloudFormation template
cdk synth -j > template.json
```

