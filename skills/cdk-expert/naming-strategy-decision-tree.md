a# CDK Deployment Conflict Prevention Guide

Prevent and resolve CloudFormation deployment conflicts including naming conflicts, resource conflicts, and external resource conflicts.

## Part 1: Pre-Deployment Conflict Detection

**ALWAYS run these checks BEFORE deploying:**

### 1. Check for External Resource Conflicts

Some AWS resources enforce **global uniqueness constraints** that CloudFormation cannot detect until deployment:

| Resource Type | Conflict Scope | Check Method | Common Issues |
|---------------|----------------|--------------|---------------|
| **AWS Chatbot SlackChannelConfiguration** | Per Slack channel per AWS account | AWS Console | Same Slack channel already configured in this account |
| **S3 Bucket** | Global (all AWS accounts) | `aws s3 ls s3://bucket-name` | Bucket name taken by another account |
| **CloudFront Distribution** | Per domain | AWS Console | Domain already has distribution |
| **ACM Certificate** | Per domain per region | `aws acm list-certificates` | Domain already has cert |
| **Route53 Hosted Zone** | Per domain | `aws route53 list-hosted-zones` | Hosted zone already exists |
| **IAM Role** (with path) | Per account | `aws iam get-role --role-name X` | Role name already exists |

**Pre-Deployment Checklist:**

```bash
# Before adding AWS Chatbot SlackChannelConfiguration
# 1. Check AWS Chatbot console manually (no CLI support yet)
#    https://console.aws.amazon.com/chatbot/
# 2. Look for existing configurations with same slackChannelId
# 3. Delete old configuration if not managed by CloudFormation

# Before creating S3 bucket with fixed name
aws s3 ls s3://your-bucket-name 2>&1 | grep -q "NoSuchBucket" && echo "✅ Available" || echo "❌ Exists"

# Before creating IAM role
aws iam get-role --role-name YourRoleName 2>&1 | grep -q "NoSuchEntity" && echo "✅ Available" || echo "❌ Exists"

# Before creating hosted zone
aws route53 list-hosted-zones | grep -q "yourdomain.com" && echo "❌ Exists" || echo "✅ Available"
```

### 2. Identify Manually Created Resources

**Problem:** You're adding a resource to CDK that was previously created manually or deleted from CDK.

**Detection:**

```bash
# Check if resource exists outside CloudFormation
aws cloudformation list-stack-resources --stack-name YourStack \
  --query 'StackResourceSummaries[?ResourceType==`AWS::Chatbot::SlackChannelConfiguration`]' \
  --output table

# If empty but deployment fails → Resource exists outside CloudFormation
```

**Solution Options:**

1. **Import existing resource into CloudFormation** (if supported)
   ```bash
   # Not all resources support import (Chatbot doesn't)
   ```

2. **Delete external resource and let CDK create it**
   ```bash
   # Delete manually created AWS Chatbot configuration
   # Go to: https://console.aws.amazon.com/chatbot/
   # Then re-deploy CDK
   ```

3. **Use different name/identifier**
   ```typescript
   // Change slackChannelConfigurationName to avoid conflict
   new SlackChannelConfiguration(this, 'PipelineChatOps', {
     slackChannelConfigurationName: 'InfraDeployments-v2', // New name
     // ... but same slackChannelId will still conflict!
   })
   ```

### 3. Run `cdk diff` to Preview Changes

```bash
npm run cdk diff

# Look for:
# [-/+] = Replacement (DANGEROUS - data loss risk)
# [+]   = New resource (check for external conflicts)
# [~]   = Update (usually safe)
# [-]   = Delete (check if resource is used elsewhere)
```

---

## Common Deployment Conflicts & Solutions

### AWS Chatbot SlackChannelConfiguration Conflict

**Error Message:**
```
Resource handler returned message: "Slack channel with ID C081EH1ULAJ in Slack team T04T133J2
has already been configured for AWS account 202533536029."
(Service: AWSChatbot; Status Code: 400; Error Code: InvalidRequestException)
```

**Root Cause:**
- AWS Chatbot enforces **one configuration per Slack channel per AWS account**
- The Slack channel was previously configured (manually or via deleted CDK stack)
- CloudFormation cannot detect this until deployment time

**Solution:**

1. **Find and delete existing configuration:**
   ```bash
   # Open AWS Chatbot console
   # https://console.aws.amazon.com/chatbot/

   # Navigate to: Configured clients → Slack
   # Find configuration with matching slackChannelId (e.g., C081EH1ULAJ)
   # Delete the configuration
   ```

2. **Verify deletion in CloudFormation:**
   ```bash
   aws cloudformation list-stack-resources --stack-name DeploymentStack \
     --query 'StackResourceSummaries[?ResourceType==`AWS::Chatbot::SlackChannelConfiguration`]' \
     --output table

   # Should be empty (or only show old stack with DELETE_COMPLETE)
   ```

3. **Check rollback status:**
   ```bash
   aws cloudformation describe-stacks --stack-name DeploymentStack \
     --query 'Stacks[0].StackStatus' --output text

   # If UPDATE_ROLLBACK_COMPLETE, you must continue update:
   aws cloudformation continue-update-rollback --stack-name DeploymentStack
   # Wait for status to return to UPDATE_COMPLETE or CREATE_COMPLETE
   ```

4. **Retry deployment:**
   ```bash
   npm run cdk deploy
   ```

**Prevention:**
- Always check AWS Chatbot console before adding `SlackChannelConfiguration` to CDK
- Document existing manual configurations before migrating to CDK
- Use unique configuration names to track which stack owns which configuration

---

### S3 Bucket Name Conflict

**Error Message:**
```
Bucket name already exists (Service: S3; Status Code: 409; Error Code: BucketAlreadyExists)
```

**Solution:**
```bash
# Check if bucket exists
aws s3 ls s3://your-bucket-name

# If owned by different account, use different name
# If owned by your account but different region/stack:
aws s3api get-bucket-location --bucket your-bucket-name

# Import into CloudFormation or delete and recreate
```

---

### IAM Role Name Conflict

**Error Message:**
```
Role with name XYZ already exists (Service: IAM; Status Code: 409; Error Code: EntityAlreadyExists)
```

**Solution:**
```bash
# Check existing role
aws iam get-role --role-name YourRoleName

# If managed by different stack, import or use different name
# If orphaned, delete manually:
aws iam delete-role --role-name YourRoleName
```

---

## Part 2: Resource Naming Strategy

Choose between fixed and dynamic resource naming in AWS CDK.

### Core Strategy: Environment-Based Evolution

**Golden Rule:**
- **DEV**: Dynamic names are acceptable (rapid iteration, easy replacement)
- **STAGING/PROD**: Fixed names are required (predictability, stability)

**Workflow:**
1. Start with dynamic names in DEV (fast development)
2. Before promoting to STAGING, convert to fixed names
3. Production always has fixed names

---

## Quick Decision Tree

```
Is resource only in DEV environment?
├─ Yes → ✅ Dynamic names OK (will fix before promoting)
└─ No (STAGING or PROD) → ✅ Must use fixed names
```

---

## Migration Strategies: DEV (Dynamic) → STAGING (Fixed)

When adding fixed names to existing resources, you have 3 options:

### Solution 1: Use overrideLogicalId() (Zero Downtime)

**Best for:** All resources when possible

```typescript
// Step 1: Find current logical ID
// npm run cdk synth > before.json
// grep "DataBucket" before.json
// Result: "MyStackDataBucketABC12345": { ... }

// Step 2: Add fixed name + preserve logical ID
const bucket = new Bucket(this, 'DataBucket', {
  bucketName: naming.getBucketName('data')
})

const cfnBucket = bucket.node.defaultChild as CfnBucket
cfnBucket.overrideLogicalId('MyStackDataBucketABC12345')

// Result: Same CloudFormation logical ID → UPDATE instead of REPLACE
```

**Pros:** ✅ Zero downtime, no data migration
**Cons:** ❌ Logical ID divorced from construct tree (harder to maintain)

---

### Solution 2: Import Existing Resource (Manual Migration)

**Best for:** Stateful resources with data to preserve

```typescript
// Phase 1: Reference existing bucket (read-only)
const oldBucket = Bucket.fromBucketName(
  this,
  'OldDataBucket',
  'MyStackDataBucketABC12345'  // Old auto-generated name
)

// Phase 2: Create new bucket with fixed name
const newBucket = new Bucket(this, 'DataBucket', {
  bucketName: naming.getBucketName('data')
})

// Phase 3: Manually migrate data
// aws s3 sync s3://MyStackDataBucketABC12345 s3://myservice-data-staging-123456789012

// Phase 4: Update application to use newBucket

// Phase 5: Remove oldBucket from code, delete in AWS
```

**Pros:** ✅ Full control over migration, can validate before switching
**Cons:** ❌ Manual data migration, potential downtime

---

### Solution 3: Blue-Green Deployment (Two-Step, Quick Succession)

**Best for:** Resources that need zero downtime but can't use overrideLogicalId()

**⚠️ CRITICAL: Both deployments must happen quickly (within minutes)**

#### Step 1: Create Dummy Placeholder (Deployment 1)

```typescript
export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id)

    const naming = new ResourceNamingService(environment, serviceName)

    // Create NEW bucket with intended fixed name
    const newBucket = new Bucket(this, 'DataBucketV2', {
      bucketName: naming.getBucketName('data'),  // Fixed name!
      removalPolicy: RemovalPolicy.RETAIN  // Keep if stack deleted
    })

    // Keep OLD bucket (still in use by application)
    const oldBucket = Bucket.fromBucketName(
      this,
      'DataBucket',
      'MyStackDataBucketABC12345'  // Auto-generated name
    )

    // Application still uses oldBucket
    // newBucket exists but not used yet
  }
}
```

**Deploy Deployment 1:**
```bash
npm run cdk deploy
# Creates: myservice-data-staging-123456789012 (empty, not used)
# Keeps: MyStackDataBucketABC12345 (still in use)
```

#### Step 2: Switch to New Resource (Deployment 2 - QUICK!)

```typescript
export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id)

    const naming = new ResourceNamingService(environment, serviceName)

    // Use NEW bucket with fixed name (promoted from V2 to main)
    const bucket = new Bucket(this, 'DataBucket', {
      bucketName: naming.getBucketName('data')
    })

    // Remove reference to old bucket
    // (will be deleted by CloudFormation)

    // Application now uses bucket (with fixed name)
  }
}
```

**Deploy Deployment 2 (IMMEDIATELY after Deployment 1):**
```bash
npm run cdk deploy
# Updates: Application switches to myservice-data-staging-123456789012
# Deletes: MyStackDataBucketABC12345 (old bucket)
```

**Why two deployments?**
- CloudFormation won't let you delete a resource and create one with same name in single deployment
- Two-step allows: Create → Switch → Delete

**⚠️ Risks:**
- If Step 2 is delayed, you have TWO buckets (confusion, cost)
- If Step 2 fails, rollback is manual
- Data must be synced between Step 1 and Step 2

#### Blue-Green with Data Sync

For stateful resources, add data sync between deployments:

```typescript
// Step 1: Create new bucket + data sync Lambda
export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id)

    const naming = new ResourceNamingService(environment, serviceName)

    const oldBucket = Bucket.fromBucketName(this, 'OldBucket', 'MyStackDataBucketABC12345')
    const newBucket = new Bucket(this, 'DataBucketV2', {
      bucketName: naming.getBucketName('data')
    })

    // Lambda to sync old → new (one-way)
    const syncFn = new Function(this, 'SyncFunction', {
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: Code.fromInline(`
import boto3
s3 = boto3.client('s3')

def handler(event, context):
    # Sync from old to new bucket
    # This runs continuously until Step 2 deployment
    old_bucket = '${oldBucket.bucketName}'
    new_bucket = '${newBucket.bucketName}'

    # Copy new/updated objects only
    paginator = s3.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=old_bucket):
        for obj in page.get('Contents', []):
            s3.copy_object(
                CopySource={'Bucket': old_bucket, 'Key': obj['Key']},
                Bucket=new_bucket,
                Key=obj['Key']
            )
      `)
    })

    // Trigger sync every 1 minute
    const rule = new Rule(this, 'SyncRule', {
      schedule: Schedule.rate(Duration.minutes(1))
    })
    rule.addTarget(new LambdaFunction(syncFn))
  }
}
```

**Deploy Step 1:**
```bash
npm run cdk deploy
# Creates newBucket, starts background sync
```

**Wait for sync to catch up (check CloudWatch Logs)**

**Deploy Step 2 (switch to new bucket, remove sync):**
```bash
npm run cdk deploy
# Switches application to newBucket
# Removes sync Lambda
# Deletes oldBucket
```

---

### Comparison Matrix

| Solution | Downtime | Data Migration | Complexity | Risk |
|----------|----------|----------------|------------|------|
| **1. overrideLogicalId()** | ✅ Zero | ✅ None needed | ⚠️ Medium | ✅ Low |
| **2. Import Existing** | ❌ Manual cutover | ⚠️ Manual sync | ⚠️ Medium | ⚠️ Medium |
| **3. Blue-Green (no data)** | ✅ Zero | ✅ None (empty resource) | ❌ High | ⚠️ Medium |
| **3. Blue-Green (with sync)** | ✅ Zero | ✅ Automated | ❌ Very High | ❌ High |

**Recommendation:**
- **First choice:** Solution 1 (overrideLogicalId)
- **Second choice:** Solution 2 (manual migration)
- **Last resort:** Solution 3 (blue-green, only if 1 & 2 impossible)

---

## Blue-Green Deployment Checklist

**Before Starting:**
- [ ] Can't use overrideLogicalId()? (Why not?)
- [ ] Resource is stateful? (Need data migration)
- [ ] Resource can coexist with old version? (No name conflicts)
- [ ] You can deploy twice within short timeframe (<30 minutes)
- [ ] Rollback plan documented

**Step 1 Deployment:**
- [ ] Create new resource with fixed name (different logical ID)
- [ ] Keep old resource (application still uses it)
- [ ] Add data sync if stateful
- [ ] Deploy and verify new resource is healthy
- [ ] Monitor sync progress (if applicable)

**Between Deployments:**
- [ ] Verify new resource is ready
- [ ] Verify data sync is caught up (if applicable)
- [ ] Test new resource manually
- [ ] Prepare rollback commands

**Step 2 Deployment (QUICK!):**
- [ ] Update application to use new resource
- [ ] Remove old resource reference
- [ ] Remove sync Lambda (if applicable)
- [ ] Deploy IMMEDIATELY (don't wait)
- [ ] Monitor for errors
- [ ] Keep old resource data for 24-48h (manual backup)

**After Step 2:**
- [ ] Verify application uses new resource
- [ ] Old resource is deleted
- [ ] No errors in logs
- [ ] Performance metrics normal
- [ ] Clean up any temporary resources

---

## Example: ECR Repository Blue-Green Migration

### Current State (DEV - Dynamic Name)
```typescript
const repository = new Repository(this, 'Repo', {
  // No repositoryName - auto-generated: "MyStackRepoABC12345"
})
```

### Step 1: Create New Repository with Fixed Name

```typescript
export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id)

    const naming = new ResourceNamingService(environment, serviceName)

    // NEW repo with fixed name
    const newRepository = new Repository(this, 'RepoV2', {
      repositoryName: naming.getEcrRepositoryName(),  // "myservice-staging"
      lifecycleRules: [{ maxImageAge: Duration.days(30) }]
    })

    // OLD repo still in use
    const oldRepository = Repository.fromRepositoryName(
      this,
      'Repo',
      'MyStackRepoABC12345'
    )

    // CodeBuild still pushes to oldRepository
    const build = new Project(this, 'Build', {
      environment: {
        buildImage: LinuxBuildImage.STANDARD_5_0,
        privileged: true
      },
      buildSpec: BuildSpec.fromObject({
        phases: {
          build: {
            commands: [
              'docker build -t app .',
              `docker tag app ${oldRepository.repositoryUri}:latest`,  // Old repo
              `docker tag app ${newRepository.repositoryUri}:latest`,   // Also push to new!
              `docker push ${oldRepository.repositoryUri}:latest`,
              `docker push ${newRepository.repositoryUri}:latest`
            ]
          }
        }
      })
    })
  }
}
```

**Deploy Step 1:**
```bash
npm run cdk deploy
# Creates: myservice-staging (empty)
# Keeps: MyStackRepoABC12345 (still used by ECS)
# Next build will push to BOTH repos
```

**Trigger a build to push image to both repos**

### Step 2: Switch ECS to New Repository (QUICK!)

```typescript
export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id)

    const naming = new ResourceNamingService(environment, serviceName)

    // Use NEW repo (promoted from V2 to main)
    const repository = new Repository(this, 'Repo', {
      repositoryName: naming.getEcrRepositoryName()  // "myservice-staging"
    })

    // OLD repo reference removed (will be deleted)

    const taskDefinition = new TaskDefinition(this, 'Task', {
      compatibility: Compatibility.FARGATE,
      cpu: '256',
      memoryMiB: '512'
    })

    taskDefinition.addContainer('App', {
      image: ContainerImage.fromEcrRepository(repository, 'latest'),  // NEW repo!
      // ECS now pulls from myservice-staging
    })
  }
}
```

**Deploy Step 2 (IMMEDIATELY):**
```bash
npm run cdk deploy
# Updates: ECS task definition uses myservice-staging
# Deletes: MyStackRepoABC12345
# ⚠️ If Step 2 delayed, you pay for two repos!
```

---

## When Blue-Green Is Required

**Can't use overrideLogicalId() because:**
- L2 construct creates multiple L1 resources (can't override all)
- Resource type doesn't support logical ID override
- Construct tree path has changed too much

**Can't use import because:**
- Resource doesn't support import (some resources can't be imported)
- Downtime is unacceptable
- Need automated migration

**Examples requiring blue-green:**
- ECS Services with rolling deployments
- Lambda functions with aliases
- API Gateway stages
- CloudFront distributions (can't coexist with same domain)

---

## Automation Script for Blue-Green

```typescript
// scripts/blue-green-migration.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function blueGreenMigration() {
  console.log('🔵 Step 1: Creating new resource with fixed name...')

  // Deploy with temporary V2 suffix
  await execAsync('npm run cdk deploy -- --require-approval never')

  console.log('✅ Step 1 complete. Verify new resource is healthy.')
  console.log('⏳ Waiting 60 seconds before Step 2...')

  await new Promise(resolve => setTimeout(resolve, 60000))

  console.log('🟢 Step 2: Switching to new resource and removing old...')

  // Switch to new resource (remove V2 suffix in code first!)
  console.log('⚠️  Update code to remove V2 suffix, then continue')
  console.log('Press Ctrl+C to stop, or wait to continue...')

  await new Promise(resolve => setTimeout(resolve, 10000))

  await execAsync('npm run cdk deploy -- --require-approval never')

  console.log('✅ Migration complete!')
  console.log('📊 Verify application is using new resource')
}

blueGreenMigration().catch(console.error)
```

---

## Summary

**Migration Strategy Selection:**

1. **Try overrideLogicalId() first** (safest, zero downtime)
2. **If that fails, try import + manual migration** (controlled, testable)
3. **Only use blue-green if necessary** (complex, risky, requires quick successive deployments)

**Blue-Green Golden Rules:**
- ⚠️ Both deployments must happen within 30 minutes
- ⚠️ Test Step 1 thoroughly before Step 2
- ⚠️ Have rollback plan ready
- ⚠️ Monitor closely during and after migration
- ⚠️ Keep backups of old resource data for 24-48 hours

**Best Practice:** Fix names in DEV first, validate with `cdk diff`, then promote to STAGING with chosen migration strategy.
