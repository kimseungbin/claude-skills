# CloudFormation Safety

Critical guide to preventing accidental resource replacements during CDK refactoring.

## Table of Contents

1. [Understanding Logical IDs](#understanding-logical-ids)
2. [Safe Refactoring](#safe-refactoring-no-replacement)
3. [Dangerous Refactoring](#dangerous-refactoring-will-replace)
4. [Handling Logical ID Changes](#handling-logical-id-changes-two-approaches)
   - Option 1: CDK Refactor Command
   - Option C: Two-Step Deployment with Feature Flags
   - **Option D: Conditional Logic** (Recommended for phased deployment)
   - Option 2: overrideLogicalId()
5. [Safe vs Unsafe Replacements](#safe-vs-unsafe-replacements)
6. [Complete Workflow](#complete-overridelogicalid-workflow)
7. [Pre-Refactoring Checklist](#pre-refactoring-checklist)
8. [Pre-Push Hook Integration](#pre-push-hook-integration)
9. [Cross-Region Exports and Logical ID Constraints](#cross-region-exports-and-logical-id-constraints)

---

## Understanding Logical IDs

### What is a Logical ID?

**CloudFormation Logical ID:**
- Unique identifier for each resource in CloudFormation template
- Used by CloudFormation to track resources across updates
- **Changing the logical ID forces resource replacement** (DELETE + CREATE)

**How CDK generates Logical IDs:**
- Auto-generated from construct tree path: `{ParentId}{ChildId}{Hash}`
- Example: `CloudFrontCommonCloudFrontLOgsDatabaseABC123`
- Hash suffix ensures uniqueness within stack

```typescript
export class MyStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id)  // id = "MyStack"

    new Bucket(this, 'Assets')
    // Logical ID: MyStackAssetsXXXXXXXX
    //             ^^^^^^^^ from Stack id
    //                     ^^^^^^ from Bucket id ("Assets")
    //                           ^^^^^^^^ hash suffix
  }
}
```

**Critical Rule:**
> If logical ID changes, CloudFormation treats it as a different resource and replaces it (DELETE old, CREATE new).

---

## Safe Refactoring (No Replacement)

These refactoring operations **DO NOT** change logical IDs:

### Extracting Methods

```typescript
// ✅ Before
export class MyConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "MyConstruct"

    const bucket = new Bucket(this, 'Bucket', {
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
    })
    // Logical ID: MyConstructBucketXXXXXXXX
  }
}

// ✅ After: Extract method - logical ID unchanged
export class MyConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // Still "MyConstruct"
    this.bucket = this.createBucket()
  }

  private createBucket(): Bucket {
    return new Bucket(this, 'Bucket', {  // Still "Bucket"
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
    })
    // Logical ID: MyConstructBucketXXXXXXXX (unchanged!)
  }
}
```

**Why it's safe:** Parent ID and child ID remain the same.

### Renaming Variables

```typescript
// ✅ Renaming variables is safe
const bucket = new Bucket(this, 'Assets')
// vs
const assetsBucket = new Bucket(this, 'Assets')

// Logical ID depends on the second parameter ('Assets'), not variable name
```

### Changing Implementation Details

```typescript
// ✅ Before
const bucket = new Bucket(this, 'Data', {
  versioned: false,
})

// ✅ After: Change props - no replacement (unless props themselves trigger it)
const bucket = new Bucket(this, 'Data', {
  versioned: true,  // This specific change is safe
})
```

---

## Dangerous Refactoring (Will Replace!)

These operations **WILL** change logical IDs and cause replacement:

### Moving to New Construct

```typescript
// ⚠️ Before:
export class OldConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Old"
    const db = new CfnDatabase(this, 'Database', {...})
    // Logical ID: OldDatabaseABC123
  }
}

// ⚠️ After: New construct - DIFFERENT logical ID!
export class NewConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "New"
    const db = new CfnDatabase(this, 'Database', {...})
    // Logical ID: NewDatabaseXYZ789  ❌ DIFFERENT!
    // CloudFormation will DELETE old DB and CREATE new one
  }
}
```

**Result:** Database deleted and recreated (DATA LOSS!)

### Changing Construct ID

```typescript
// ⚠️ Before:
new MyConstruct(this, 'OldId')
// Logical ID prefix: OldId...

// ⚠️ After:
new MyConstruct(this, 'NewId')
// Logical ID prefix: NewId...  ❌ DIFFERENT!
```

### Changing Resource ID

```typescript
// ⚠️ Before:
new Bucket(this, 'OldBucket')
// Logical ID: ParentOldBucketXXXXXX

// ⚠️ After:
new Bucket(this, 'NewBucket')
// Logical ID: ParentNewBucketYYYYYY  ❌ DIFFERENT!
```

---

## Handling Logical ID Changes: Two Approaches

When refactoring causes logical ID changes, you have two options:

### Option 1: CDK Refactor Command (Recommended for Simple Changes)

**Best for:** Simple renames and moves within existing construct structure

The `cdk refactor` command uses CloudFormation's refactoring API to update logical IDs in-place without resource replacement.

**When to use:**
- Renaming construct IDs at the same level
- Moving resources between stacks (same account/region)
- Simple path changes without hierarchy restructuring

**Workflow:**
```bash
# 1. Make code changes that affect logical IDs
# (e.g., rename construct, move between stacks)

# 2. Validate refactoring
npm run cdk synth -- --unstable=refactor

# 3. Preview logical ID mapping
npm run cdk diff -- --unstable=refactor
# Shows: OldLogicalID → NewLogicalID (no resource replacement)

# 4. Apply refactoring (separate from other changes!)
npm run cdk -- refactor --unstable=refactor

# 5. Deploy normally
npm run cdk deploy
```

**Important constraints:**
- ⚠️ Preview feature (requires `--unstable=refactor` flag)
- ⚠️ Must refactor separately from other infrastructure changes
- ⚠️ Resources must stay in same AWS account/region
- ⚠️ Requires up-to-date CDK bootstrap

**Critical Limitation - Structural Hierarchy Changes:**

`cdk refactor` **CANNOT handle** introducing intermediate parent constructs:

```typescript
// ❌ This type of refactoring FAILS with cdk refactor
// BEFORE:
Profile/CodeBuildProjectConstruct/CodeBuildProject/Resource

// AFTER (adding intermediate "Infra" construct):
Profile/Infra/CodeBuildProjectConstruct/CodeBuildProject/Resource
//       ^^^^^ New intermediate parent construct

// Error from cdk refactor:
// ❌ Refactor failed: A refactor operation cannot add, remove or update resources.
//    Only resource moves and renames are allowed.
```

**Why it fails:**
- `cdk refactor` sees this as **adding new resources** (Profile/Infra/...) and **deleting old ones** (Profile/...)
- Adding intermediate constructs changes the **entire construct tree hierarchy**
- CDK treats these as different resources, not moves

**What cdk refactor CAN do:**
- ✅ Rename at same level: `MyQueue` → `MyRenamedQueue` (same parent)
- ✅ Move between stacks: `StackA/Queue` → `StackB/Queue`
- ✅ Simple path change: `Service/Queue` → `MyService/Queue` (same depth)

**What cdk refactor CANNOT do:**
- ❌ Add intermediate parents: `Service/Queue` → `Service/Infra/Queue`
- ❌ Restructure construct hierarchy
- ❌ Extract to mid-level constructs with different tree structure

**When cdk refactor doesn't work, use:**
- **Option A**: Manual AWS CLI deletion + clean deployment (acceptable in DEV)
- **Option B**: `overrideLogicalId()` for every resource (permanent technical debt)

**IMPORTANT: Why CLI deletion, not CloudFormation context flags?**

When you have multiple environments (DEV, QA, STAGING, PROD) deploying from the same codebase:

❌ **DON'T use CDK context or conditional code:**
```typescript
// ❌ BAD: Affects CloudFormation template, complicates multi-env deployments
const skipProfile = this.node.tryGetContext('skipProfileMigration') === 'true'
if (shouldDeployService('profile') && !skipProfile) {
  new ProfileServiceV2(this, 'Profile', {...})
}
```

**Why this is problematic:**
- CloudFormation templates are generated during `cdk synth`
- Context flags must be coordinated across all environment deployments
- Risk of accidentally deploying with wrong context to wrong environment
- Creates temporary migration logic that stays in code forever
- Harder to reason about what's deployed where

✅ **DO use AWS CLI for direct resource deletion:**
```bash
# Delete specific resources in DEV only via AWS CLI
AWS_PROFILE=fe-dev AWS_REGION=ap-northeast-2 aws cloudformation delete-stack \
  --stack-name dev \
  --retain-resources ProfileECRRepo49C9B6B6 ProfileTaskDefinition2F1814FB

# Or delete individual resources
AWS_PROFILE=fe-dev aws ecs delete-service \
  --cluster dev --service profile --force
```

**Why CLI deletion is better:**
- ✅ Direct, explicit control over what gets deleted
- ✅ No code changes that could affect other environments
- ✅ No risk of wrong context flag in wrong environment
- ✅ Clear audit trail in AWS CloudTrail
- ✅ Can retain specific resources if needed (ECR images, etc.)

**See also:**
- `/TEMP_CDK_REFACTOR_RESEARCH.md` for comprehensive guide
- `docs/refactoring/high/ARCH-14.md` for real-world failure example

### Option C: Two-Step Deployment with Feature Flags (Recommended for Multi-Environment)

**Best for:** Multi-environment projects with feature flag system, stateless resource refactoring

When `cdk refactor` fails due to intermediate parent constructs and you have a feature flag system, use two-step deployment:

**Step 1: Disable → Deploy (removes resources)**
```yaml
# feature-flags.yaml
pipeline-notifications:
  enabled: true
  environments: []  # Disable for all environments
```
```bash
cdk deploy DeploymentStack --profile fe-dev
# CloudFormation deletes PipelineAlertsTopic, MessageTransformer, etc.
```

**Step 2: Re-enable → Deploy (creates with new logical IDs)**
```yaml
# feature-flags.yaml
pipeline-notifications:
  enabled: true
  environments: [dev, stag, production]  # Re-enable
```
```bash
cdk deploy DeploymentStack --profile fe-dev
# CloudFormation creates PipelineNotification/PipelineAlertsTopic, etc.
```

**Benefits over CLI deletion:**
- ✅ No manual AWS CLI commands
- ✅ CloudFormation manages deletion (safer, respects dependencies)
- ✅ Works across all environments without code changes
- ✅ Reusable pattern for future refactorings
- ✅ Clear intent in version control (feature flag changes)

**ONLY safe for stateless resources:**
- ✅ SNS topics (subscribers will reconnect)
- ✅ Lambda functions (code is ephemeral)
- ✅ IAM roles (no data loss)
- ✅ NotificationRules (configuration only)

**NEVER use for stateful resources:**
- ❌ S3 buckets (data loss)
- ❌ DynamoDB tables (data loss)
- ❌ RDS databases (data loss)
- ❌ EFS file systems (data loss)

**Real-world example:**
Extracting `PipelineNotificationConstruct` from `deployment-stack.ts` changed logical IDs from `PipelineAlertsTopic2E9A9233` to `PipelineNotification/PipelineAlertsTopic...`. Two-step deployment enabled safe refactoring without `overrideLogicalId()` technical debt.

**See also:**
- `CLAUDE.md` § Feature Flags for Safe Refactoring
- `packages/infra/src/feature-flags/README.md` for feature flag implementation

### Option D: Conditional Logic Within Existing Construct (Recommended for Phased Deployment)

**Best for:** Adding phased deployment capability without changing CloudFormation logical IDs

When you need to enable/disable groups of resources within an existing construct (e.g., deploy ECR/CodeBuild before ECS/ALB), use **conditional logic** instead of extracting to separate constructs.

**Why conditional logic over construct extraction:**

| Approach | Risk | Maintenance | Visual Hierarchy |
|----------|------|-------------|------------------|
| Conditional logic | ✅ Zero (preserves Logical IDs) | ✅ Simple | ❌ Flat in CloudFormation |
| Separate constructs + `overrideLogicalId()` | 🚨 High (30+ overrides per service) | ❌ Complex | ✅ Hierarchical |

**Key insight:** Choose safety over visual organization in CloudFormation console.

**Implementation pattern:**

```typescript
export class Service extends Construct {
  constructor(scope: Construct, id: string, props: ServiceProps) {
    super(scope, id)

    // Two-phase deployment control via feature flags
    const infraEnabled = isServiceDeploymentPhaseEnabled(environment, serviceName, 'infra')
    const serviceEnabled = isServiceDeploymentPhaseEnabled(environment, serviceName, 'service')

    // ===================================================================
    // PHASE 1: Build Infrastructure (ECR + CodeBuild + TaskDefinition)
    // ===================================================================
    let taskDefinition: TaskDefinition | undefined

    if (infraEnabled) {
      const repository = new EcrRepository(this, 'ECR', {...})
      taskDefinition = new TaskDefinition(this, 'TaskDefinition', {...})
      new CodeBuildProject(this, 'CodeBuildProjectConstruct', {...})
    }

    // ===================================================================
    // PHASE 2: Runtime Service (ECS + ALB + CloudFront)
    // ===================================================================
    if (serviceEnabled) {
      if (!taskDefinition) {
        throw new Error(`Phase 2 requires Phase 1 to be enabled first`)
      }
      new FargateService(this, 'FargateService', { taskDefinition, ... })
      new ALB(this, 'ALB', {...})
      new CloudFront(this, 'CloudFront', {...})
    }
  }
}
```

**Feature flag configuration:**

```yaml
# feature-flags.yaml
service-deployment:
  qa:
    auth:
      infra: true      # Phase 1: Deploy ECR, CodeBuild, TaskDefinition
      service: false   # Phase 2: Wait for Docker image before enabling
```

**Deployment workflow for new environments:**

```bash
# Step 1: Deploy Phase 1 (infrastructure)
# feature-flags.yaml: qa.auth.infra=true, qa.auth.service=false
git push origin master
# → Creates ECR, CodeBuild, TaskDefinition

# Step 2: Manual intervention - push Docker image
aws ecr get-login-password | docker login ...
docker build && docker push <ecr-uri>:latest

# Step 3: Deploy Phase 2 (service)
# feature-flags.yaml: qa.auth.infra=true, qa.auth.service=true
git push origin master
# → Creates ECS Service, ALB, CloudFront
```

**When to use conditional logic:**
- ✅ Phased deployment needed (infra before service)
- ✅ Feature flags control resource creation
- ✅ Refactoring existing code (must preserve Logical IDs)
- ✅ Safety is paramount

**When to use separate constructs:**
- ✅ Building **new** features (no existing Logical IDs to preserve)
- ✅ Real code reuse across multiple stacks
- ✅ Team can maintain `overrideLogicalId()` complexity
- ✅ Visual hierarchy is operationally critical

**Real-world validation:**
- ✅ Captured 30 Auth service Logical IDs before implementation
- ✅ Verified all 30 IDs preserved after conditional logic added
- ✅ `cdk diff` showed zero `[-/+]` resource replacements

**See also:**
- `CLAUDE.md` § Two-Phase Service Deployment
- `lib/constructs/service/index.ts` for implementation

### Option 2: overrideLogicalId() (Manual Fallback)

**Best for:** When `cdk refactor` is not viable (cross-account, specific resource types)

Use `overrideLogicalId()` to manually preserve logical IDs when refactoring:

```typescript
// ✅ Preserve logical ID to avoid replacement
export class NewConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "New"

    const db = new CfnDatabase(this, 'Database', {...})

    // Preserve the old logical ID
    db.overrideLogicalId('OldDatabaseABC123')

    // CloudFormation recognizes as same resource → UPDATE only (no replacement)
  }
}
```

### Finding Existing Logical IDs

**Method 1: Synthesize template**
```bash
npm run cdk synth > template.json
grep -B 2 -A 5 "Database" template.json
```

Output:
```json
{
  "Resources": {
    "OldDatabaseABC123": {
      "Type": "AWS::Glue::Database",
      "Properties": {
        ...
      }
    }
  }
}
```

**Method 2: AWS Console**
1. Go to CloudFormation console
2. Select your stack
3. Click "Resources" tab
4. Find resource and copy "Logical ID" column value

**Method 3: AWS CLI**
```bash
aws cloudformation describe-stack-resources \
  --stack-name MyStack \
  --query 'StackResources[?ResourceType==`AWS::Glue::Database`].[LogicalResourceId]' \
  --output text
```

### Important Limitations

**Only works with L1 (Cfn\*) constructs:**
```typescript
// ✅ Works - L1 construct
const cfnBucket = new s3.CfnBucket(this, 'Bucket')
cfnBucket.overrideLogicalId('ExistingLogicalID')

// ❌ Won't work - L2 construct
const bucket = new s3.Bucket(this, 'Bucket')
bucket.overrideLogicalId('ExistingLogicalID')  // Error: method doesn't exist

// L2 constructs create multiple L1 resources internally
```

**For L2 constructs, access underlying L1:**
```typescript
const bucket = new s3.Bucket(this, 'Bucket')
const cfnBucket = bucket.node.defaultChild as s3.CfnBucket
cfnBucket.overrideLogicalId('ExistingLogicalID')
```

---

## Safe vs Unsafe Replacements

### Safe to Replace (Stateless)

These resources can be replaced without data loss:

| Resource Type | Why Safe | Notes |
|--------------|----------|-------|
| **Glue databases/tables** | Metadata only, data in S3 | May affect running queries |
| **Lambda functions** | Code stored in S3 | Will have downtime during replacement |
| **IAM roles** | No state | Check if ARNs referenced elsewhere |
| **CloudFront distributions** | Config only | DNS propagation takes time |
| **API Gateway** | Config only | May affect clients during replacement |
| **EventBridge rules** | Config only | Events may be missed during replacement |

### Unsafe to Replace (Stateful)

These resources **MUST NOT** be replaced without migration:

| Resource Type | Risk | Mitigation |
|--------------|------|------------|
| **S3 buckets** | Data loss | Export data, recreate, re-import |
| **DynamoDB tables** | Data loss | Point-in-time backup, restore |
| **RDS databases** | Data loss | Snapshot, restore to new instance |
| **ECR repositories** | Image history lost | Push images to new repo |
| **EFS file systems** | Data loss | Backup to S3, restore |
| **ECS services** | Downtime | Use blue/green deployment |
| **ALB/NLB** | DNS changes, downtime | Plan DNS update |

### Replacement Impact Matrix

| Impact Level | Resource Examples | Action Required |
|-------------|-------------------|-----------------|
| **Critical** | RDS, DynamoDB, S3 | Data backup + migration plan |
| **High** | ECR, ECS, ALB | Downtime planning |
| **Medium** | Lambda, API Gateway | Test thoroughly in DEV |
| **Low** | IAM roles, CloudWatch alarms | Verify references |

---

## Complete overrideLogicalId() Workflow

### Step-by-Step Example

**Scenario:** Moving Glue Database from CloudFrontCommonConstruct to new LogAnalyticsConstruct

**Step 1: Current State**
```typescript
// BEFORE: Everything in CloudFrontCommonConstruct
export class CloudFrontCommonConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)  // id = "CloudFrontCommon"

    const db = new CfnDatabase(this, 'CloudFrontLOgsDatabase', {
      catalogId: Stack.of(this).account,
      databaseInput: {
        name: 'cloudfront_logs',
      },
    })
    // Logical ID: CloudFrontCommonCloudFrontLOgsDatabaseABC123
  }
}
```

**Step 2: Find Existing Logical ID**
```bash
# Synthesize current template
npm run cdk synth > before.json

# Find the logical ID
grep -o '"CloudFrontCommon[^"]*Database[^"]*"' before.json

# Output: "CloudFrontCommonCloudFrontLOgsDatabaseABC123"
```

**Step 3: Create New Construct with overrideLogicalId()**
```typescript
// AFTER: Split into separate construct
export class LogAnalyticsConstruct extends Construct {
  public readonly database: CfnDatabase

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)  // id = "LogAnalytics"

    this.database = new CfnDatabase(this, 'CloudFrontLOgsDatabase', {
      catalogId: Stack.of(this).account,
      databaseInput: {
        name: 'cloudfront_logs',
      },
    })

    // ✅ CRITICAL: Preserve old logical ID
    this.database.overrideLogicalId('CloudFrontCommonCloudFrontLOgsDatabaseABC123')
  }
}
```

**Step 4: Verify No Replacement**
```bash
# Synthesize after refactoring
npm run cdk synth > after.json

# Compare logical IDs
diff <(grep -o '"CloudFrontCommon[^"]*Database[^"]*"' before.json) \
     <(grep -o '"CloudFrontCommon[^"]*Database[^"]*"' after.json)

# Should show no differences!

# Check CloudFormation diff
npm run cdk diff

# Look for:
# [~] AWS::Glue::Database CloudFrontCommonCloudFrontLOgsDatabaseABC123
#     (means UPDATE, not REPLACE)

# Watch out for:
# [-] AWS::Glue::Database CloudFrontCommonCloudFrontLOgsDatabaseABC123  # OLD
# [+] AWS::Glue::Database LogAnalyticsCloudFrontLOgsDatabaseXYZ789      # NEW
#     (means REPLACEMENT - DON'T DEPLOY!)
```

---

## Real Production Incident: Service Construct Refactoring Failure

**Date:** 2025-11-12
**Severity:** CRITICAL - Production rollback, all CodeBuild projects deleted
**Root Cause:** Mid-level construct refactoring without `overrideLogicalId()`

### What Happened

**Goal:** Refactor Service construct to support two-phase deployment (infrastructure vs application)

**Implementation (WRONG):**
```typescript
// BEFORE: Flat structure (Working)
export class Service extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Auth"

    const repository = new EcrRepository(this, 'ECR', {...})
    // Logical ID: AuthECRRepo72FDEBC1

    const codeBuild = new CodeBuildProjectConstruct(this, 'CodeBuildProjectConstruct', {...})
    // Logical ID: AuthCodeBuildProjectConstruct...

    const service = new FargateService(this, 'FargateService', {...})
    // Logical ID: AuthFargateService...
  }
}

// AFTER: Mid-level constructs (BROKEN - No overrideLogicalId!)
export class Service extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Auth"

    const infra = new ServiceInfraConstruct(this, 'Infra', {...})
    // ❌ New parent scope adds "Infra" prefix!

    const app = new ServiceAppConstruct(this, 'App', {...})
    // ❌ New parent scope adds "App" prefix!
  }
}

export class ServiceInfraConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Infra"

    const repository = new EcrRepository(this, 'ECR', {...})
    // Logical ID: AuthInfraECRRepo21DBF314  ❌ DIFFERENT!

    const codeBuild = new CodeBuildProjectConstruct(this, 'CodeBuildProjectConstruct', {...})
    // Logical ID: AuthInfraCodeBuildProject...  ❌ DIFFERENT!
  }
}
```

### CloudFormation Behavior

```
Logical ID Changed: AuthECRRepo72FDEBC1 → AuthInfraECRRepo21DBF314

CloudFormation interprets this as:
1. DELETE old resource (AuthECRRepo72FDEBC1)
2. CREATE new resource (AuthInfraECRRepo21DBF314)

But both try to use same physical name "auth" → CONFLICT!

Error: "auth already exists in stack arn:aws:cloudformation:..."
```

### Impact

**Resources Affected:**
- ❌ All 7 CodeBuild projects: DELETED
- ❌ ECR repositories: Attempted deletion
- ❌ ECS services: Attempted recreation
- ❌ ALB target groups: Name conflicts

**Stack State:** `UPDATE_ROLLBACK_COMPLETE` (unable to update, only delete)

**Recovery Time:** 4+ hours to rollback, delete stack, clean up orphaned resources, and redeploy

### Why It Failed

**Missing Step:** Neither `cdk refactor` command nor `overrideLogicalId()` was used to preserve Logical IDs.

### How CDK Refactor Would Have Prevented This

**The BEST approach would have been using `cdk refactor`:**

```bash
# 1. Make the construct hierarchy changes (add ServiceInfraConstruct)
# 2. Apply refactoring FIRST (before any other changes)
npm run cdk -- refactor --unstable=refactor
# CDK detects logical ID changes and updates them in-place
# No resource replacement, no conflicts, no downtime!

# 3. Then deploy normally
npm run cdk deploy
```

**Why `cdk refactor` is ideal for this scenario:**
- ✅ Automatically detects all logical ID changes across all 7 services
- ✅ Updates CloudFormation logical IDs without resource replacement
- ✅ No manual work needed to find and override each logical ID
- ✅ Works with mid-level construct refactoring (ServiceInfra, ServiceApp)
- ✅ Prevents the name conflict that caused the failure

### Fallback: Manual overrideLogicalId() Approach

**If `cdk refactor` isn't available, use `overrideLogicalId()`:**

```typescript
export class ServiceInfraConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id = "Infra"

    const repository = new EcrRepository(this, 'ECR', {...})

    // ✅ CRITICAL: Preserve original Logical ID
    const cfnRepo = repository.node.defaultChild as CfnRepository
    cfnRepo.overrideLogicalId('AuthECRRepo72FDEBC1')  // Exact match!

    const codeBuild = new CodeBuildProjectConstruct(this, 'CodeBuildProjectConstruct', {...})
    const cfnCodeBuild = codeBuild.node.defaultChild as CfnProject
    cfnCodeBuild.overrideLogicalId('AuthCodeBuildProjectConstruct...')  // Exact match!
  }
}
```

### Lessons Learned

**1. ALWAYS run `cdk diff` before deploying refactored code**
```bash
# Would have shown:
[-] AWS::ECR::Repository AuthECRRepo72FDEBC1
[+] AWS::ECR::Repository AuthInfraECRRepo21DBF314
# ❌ This is REPLACEMENT - DO NOT DEPLOY!
```

**2. Hierarchical construct changes = Logical ID changes**
- Adding parent constructs changes the construct tree path
- Construct tree path determines Logical ID
- Different Logical ID = CloudFormation replacement

**3. `overrideLogicalId()` is MANDATORY when:**
- Moving resources between constructs
- Adding wrapper/parent constructs
- Changing construct hierarchy
- Any refactoring that changes construct tree

**4. Test in DEV first, one service at a time**
- Don't migrate all services at once
- Verify zero CloudFormation changes
- Rollback plan ready

### Correct Refactoring Approach

**Step 1: Capture existing Logical IDs**
```bash
npm run cdk synth > before.yaml
grep -E "^  Auth[A-Z]" before.yaml > auth-logical-ids.txt
```

**Step 2: Implement with `overrideLogicalId()`**
```typescript
export class ServiceInfraConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)

    // For EVERY resource, override Logical ID to match original
    const repository = new EcrRepository(this, 'ECR', {...})
    const cfnRepo = repository.node.defaultChild as CfnRepository
    cfnRepo.overrideLogicalId('AuthECRRepo72FDEBC1')

    const codeBuild = new CodeBuildProjectConstruct(this, 'CodeBuildProjectConstruct', {...})
    const cfnCodeBuild = codeBuild.node.defaultChild as CfnProject
    cfnCodeBuild.overrideLogicalId('AuthCodeBuildProjectConstruct...')

    // Repeat for ALL resources in the construct
  }
}
```

**Step 3: Verify zero changes**
```bash
npm run cdk synth > after.yaml
diff before.yaml after.yaml  # Should show ZERO Logical ID differences

npm run cdk diff  # Should show NO resource replacements
```

**Step 4: Test with ONE service first**
```typescript
// Only migrate auth, leave others unchanged
const services = {
  [ServiceName.AUTH]: new ServiceV2(this, 'Auth', {...}),  // New
  [ServiceName.YOZM]: new Service(this, 'Yozm', {...}),    // Old
  // ... others stay on old Service
}
```

**Step 5: Deploy and verify**
```bash
# Deploy to DEV
git checkout -b refactor/service-v2-auth-test
git push origin refactor/service-v2-auth-test

# Monitor CloudFormation - should see UPDATE, not REPLACE
# Verify auth service remains healthy
# Only then migrate next service
```

### Prevention Checklist

Before ANY construct refactoring:

- [ ] Read CloudFormation Safety documentation
- [ ] Run `cdk synth` to capture current Logical IDs
- [ ] Plan use of `overrideLogicalId()` for ALL resources
- [ ] Test in DEV environment first
- [ ] Migrate one service/construct at a time
- [ ] Verify `cdk diff` shows zero replacements
- [ ] Have rollback plan ready (git revert)
- [ ] Monitor CloudFormation events during deployment

**Step 5: Test in DEV**
```bash
# Deploy to DEV first
cdk deploy --context environment=dev

# Verify resource not replaced
aws cloudformation describe-stack-events \
  --stack-name dev \
  --query 'StackEvents[?ResourceType==`AWS::Glue::Database`]'

# Should show "UPDATE_COMPLETE", not "CREATE_COMPLETE"
```

### Risks and Gotchas

**1. Typos are Dangerous**
```typescript
// ❌ Typo in logical ID
db.overrideLogicalId('CloudFrontCommonCloudFrontLogsDatabaseABC123')  // "Logs" not "LOgs"
// Result: Creates NEW database, old one remains (data not migrated)
```

**2. Hard to Maintain**
```typescript
// ❌ Logical ID divorced from code structure
// Future developers won't understand why "CloudFrontCommon" prefix exists
// in LogAnalyticsConstruct

// Consider adding comment:
// IMPORTANT: Logical ID preserved from original CloudFrontCommonConstruct
// to prevent database replacement. Do not change without data migration plan.
this.database.overrideLogicalId('CloudFrontCommonCloudFrontLOgsDatabaseABC123')
```

**3. Breaks CDK Naming Conventions**
```typescript
// ❌ Code structure says "LogAnalytics" but CloudFormation sees "CloudFrontCommon"
// Makes debugging harder when reading CloudFormation console
```

**4. Hash Suffix May Change**
```typescript
// CDK may regenerate hash if:
// - Significant prop changes
// - Dependency changes
// - CDK version upgrade

// If hash changes, old overrideLogicalId() is wrong!
// Monitor for hash changes in cdk synth output
```

---

## Pre-Refactoring Checklist

Before refactoring infrastructure code, complete this checklist:

### Planning Phase

- [ ] **Identify refactoring goal**: What are we trying to achieve?
- [ ] **Document current state**: Run `cdk synth` and save template
- [ ] **List affected resources**: Which constructs/resources will change?
- [ ] **Assess replacement impact**: Stateful vs stateless resources

### Safety Checks

- [ ] **Run `cdk diff`**: Review all changes before deployment
- [ ] **Identify replacements**: Look for `[-/+]` (replace) vs `[~]` (update)
- [ ] **Check stateful resources**: S3, RDS, DynamoDB, ECR, EFS
- [ ] **Plan data migration**: Backup strategy for stateful resources
- [ ] **Consider overrideLogicalId()**: Can we preserve logical IDs?

### Testing Strategy

- [ ] **Test in DEV first**: Never test refactoring in production
- [ ] **Verify no data loss**: Check resources still accessible
- [ ] **Monitor stack events**: Watch CloudFormation progress
- [ ] **Validate application**: Ensure app works after refactoring
- [ ] **Document the change**: Update CLAUDE.md, comments, etc.

### Rollback Plan

- [ ] **Know how to rollback**: Can we revert the CDK code?
- [ ] **Data recovery plan**: How to restore data if lost?
- [ ] **Communication plan**: Who to notify if issues occur?

---

## Pre-Push Hook Integration

### Automated Safety Detection

Infrastructure projects can use **pre-push hooks** to automatically detect dangerous refactoring before deployment.

**Hook behavior:**
```
Developer → git push → Pre-push hook → cdk diff → Detect [-/+] → Block if dangerous
```

**What it detects:**
- Resource replacements (logical ID changes)
- Fixed-name resource recreations (CodeBuild, ECS)
- Changes that would cause downtime

### When Pre-Push Hook Blocks Your Refactoring

**Scenario:** You refactored code and tried to push, but hook blocked it.

```bash
$ git push origin master

❌ DANGEROUS DEPLOYMENT DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Resource replacements detected:
  [-/+] AWS::CodeBuild::Project (dev-service-auth-build)
  [-/+] AWS::ECS::Service (dev-service-auth)

BLOCKED: These changes will DELETE and RECREATE resources!
```

**This is the hook doing its job!** It detected that your refactoring changed logical IDs.

### Three Options When Hook Blocks

#### Option 1: Fix with `overrideLogicalId()` (Recommended)

Use `overrideLogicalId()` to preserve logical IDs after refactoring:

```typescript
// Your refactoring changed: ServiceConstruct → ServiceInfraConstruct
// This changed logical IDs, triggering hook

// FIX: Override to preserve old logical ID
const codeBuildProject = new Project(this, 'CodeBuildProject', {
  projectName: `${environment}-service-${serviceName}-build`,
})

// Preserve the old logical ID from before refactoring
codeBuildProject.node.addMetadata(
  'aws:cdk:logicalId',
  `Service${pascalCase(serviceName)}CodeBuild`  // Old ID from ServiceConstruct
)
```

**Then:**
```bash
git add .
git commit --amend --no-edit  # Update commit with fix
git push origin master  # Hook re-runs, now passes ✅
```

#### Option 2: Approve with Deployment Footer

If replacement is intentional and safe:

```bash
# Run analysis script
./scripts/analyze-and-approve-deployment.sh

# Script adds approval footer to commit:
# Safe-To-Deploy: manual-deletion-planned
# Analyzed-By: Your Name
# Services: auth
# Resources-Affected: CodeBuild=1

git push origin master  # Hook validates footer and allows push
```

**When to use:**
- Resource is stateless (safe to replace)
- You've planned manual deletion steps
- Incremental rollout (one service at a time)

#### Option 3: Bypass Hook (Emergency Only)

```bash
git push --no-verify origin master  # ⚠️ Bypasses all hooks!
```

**Only use for:**
- Testing the hook itself
- Emergency hotfixes where delay is critical
- Intentional resource recreation (document in commit)

### Refactoring Workflow with Pre-Push Hook

**Recommended workflow:**

1. **Plan refactoring:**
   - Identify constructs to extract
   - List resources that will be affected
   - Determine which logical IDs need preservation

2. **Implement with `overrideLogicalId()`:**
   ```typescript
   // Extract construct
   export class ServiceInfraConstruct extends Construct {
     constructor(scope, id, props) {
       super(scope, id)

       const build = new Project(this, 'Build', { /* ... */ })

       // Preserve old logical ID from before extraction
       build.node.addMetadata('aws:cdk:logicalId', 'OldLogicalId')
     }
   }
   ```

3. **Test locally:**
   ```bash
   cdk diff  # Verify no [-/+] patterns
   ```

4. **Commit and push:**
   ```bash
   git commit -m "refactor(service): Extract ServiceInfraConstruct"
   git push origin master  # Pre-push hook validates safety ✅
   ```

5. **If hook blocks:**
   - Review `cdk diff` output in error message
   - Fix with `overrideLogicalId()` (option 1)
   - OR approve with footer if intentional (option 2)

### Pre-Push Hook Best Practices

#### Always Fix (Never Approve) For:

- **Routine refactoring** - extract methods, rename files
- **Scope changes** - moving constructs to different files
- **Code organization** - directory restructuring
- **Any change where `overrideLogicalId()` can prevent replacement**

#### Consider Approval Footer For:

- **Intentional replacements** - upgrading to new resource type
- **Stateless resources** - Lambda functions (code-only updates)
- **Two-phase deployment** - separating build from runtime infrastructure
- **Testing in DEV** - validating new patterns before production

#### Never Bypass Hook For:

- Routine development work
- "I'll fix it later" situations
- Because you're in a hurry
- Without documenting why in commit message

### Troubleshooting Pre-Push Hook

**Hook blocks valid refactoring:**
```bash
# Check what changed
cdk diff

# If you used overrideLogicalId() but hook still blocks:
# 1. Verify logical ID string matches exactly
# 2. Check all affected resources have overrides
# 3. Review cdk diff output for remaining [-/+] patterns
```

**Hook doesn't detect issue:**
```bash
# Hook may not catch all scenarios
# Always manually review cdk diff:
cdk diff | grep -E '^\[.?\+\]'  # Find replacements
```

**Hook fails to run:**
```bash
# Verify hook is installed
ls -la .git/hooks/pre-push

# Re-install if missing
./scripts/setup-git-hooks.sh
```

### Example: Refactoring with Pre-Push Hook

**Scenario:** Extract `ServiceInfraConstruct` from `ServiceConstruct`

**Step 1: Identify affected resources**
```typescript
// Before: ServiceConstruct creates CodeBuild directly
const codeBuild = new Project(this, 'CodeBuild', {})
// Logical ID: ServiceAuthCodeBuild1234
```

**Step 2: Extract with overrides**
```typescript
// After: ServiceInfraConstruct now owns CodeBuild
export class ServiceInfraConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)  // id will be different!

    const codeBuild = new Project(this, 'CodeBuild', {})

    // Override to preserve old logical ID
    codeBuild.node.addMetadata('aws:cdk:logicalId', 'ServiceAuthCodeBuild1234')
  }
}
```

**Step 3: Verify with cdk diff**
```bash
cdk diff
# Should show no [-/+] for CodeBuild
# Only [~] (update) or nothing
```

**Step 4: Commit and push**
```bash
git commit -m "refactor(service): Extract ServiceInfraConstruct"
git push origin master
# ✅ Pre-push hook validates no replacements, allows push
```

**If hook had blocked:**
```bash
# Option 1: Review error, fix overrideLogicalId()
# Option 2: Run approval script if intentional
./scripts/analyze-and-approve-deployment.sh
```

---

## Cross-Region Exports and Logical ID Constraints

### Understanding Cross-Region Exports

When resources in one stack are referenced by another stack in a different region, CloudFormation creates **cross-region exports**. These exports have names **derived from the resource's logical ID**.

**Architecture Example:**
```
GlobalStack (us-east-1)
├── WAF/MonitoringWebAcl → export: devGlobalStackuseast1FnGetAttWAFMonitoringWebAcl...
├── WAF/BlockingWebAcl   → export: devGlobalStackuseast1FnGetAttWAFBlockingWebAcl...
└── ...

MainStack (ap-northeast-2)
├── Service/Auth → import: monitoringWebAclArn (cross-region reference)
├── Service/Yozm → import: monitoringWebAclArn (cross-region reference)
└── ...
```

### Why Cross-Region Exports Cannot Be Updated

**Critical Rule:**
> Cross-region exports **CANNOT be updated** while another stack is importing them.

**Error you'll see:**
```
Export devGlobalStackuseast1FnGetAttWAFMonitoringWebAclArn... cannot be updated as it is in use by dev
```

**Why this happens:**
1. Export names are generated from logical IDs
2. Changing logical ID = changing export name
3. Importing stack still references old export name
4. CloudFormation blocks the update to prevent broken references

### Real-World Incident: WAF Refactoring Failure (2025-12-05)

**Scenario:** Refactored `WafConstruct` in `packages/infra/src/constructs/waf/` with different logical ID structure.

**Before (original `lib/constructs/cloudfront/waf.ts`):**
```typescript
// Creates multiple WebACLs with specific IDs
new CfnWebACL(this, 'MonitoringWebAcl', {...})  // Logical ID: WAFMonitoringWebAcl...
new CfnWebACL(this, 'BlockingWebAcl', {...})    // Logical ID: WAFBlockingWebAcl...
```

**After (refactored `packages/infra/src/constructs/waf/index.ts`):**
```typescript
// Creates single WebACL with different ID
new CfnWebACL(this, 'WebAcl', {...})  // Logical ID: WAFWebAcl... ← DIFFERENT!
```

**Result:**
1. DEV deployment failed: `UPDATE_ROLLBACK_FAILED` state
2. Export names changed because logical IDs changed
3. MainStack (ap-northeast-2) still importing old exports
4. CloudFormation blocked the GlobalStack update

**Recovery steps required:**
```bash
# 1. First deploy MainStack exclusively (removes import references)
npx cdk deploy "DeploymentStack/MainStage/dev" --profile fe-dev --exclusively

# 2. Fix GlobalStack rollback state
aws cloudformation continue-update-rollback \
  --stack-name dev-GlobalStack \
  --region us-east-1 \
  --profile fe-dev \
  --resources-to-skip ExportsWriterapnortheast2AC4A0F1995E70D2E

# 3. Revert to original WafConstruct that preserves logical IDs
# 4. Deploy GlobalStack with correct logical IDs
```

### Prevention: Cross-Region Export Safety Rules

**Rule 1: Never change logical IDs of exported resources**
```typescript
// ❌ DANGEROUS: Changing construct ID changes logical ID
new CfnWebACL(this, 'NewWebAcl', {...})  // Different from 'MonitoringWebAcl'

// ✅ SAFE: Keep original construct ID
new CfnWebACL(this, 'MonitoringWebAcl', {...})  // Same logical ID
```

**Rule 2: When refactoring, use `overrideLogicalId()`**
```typescript
// If you must restructure, preserve the original logical ID
const webAcl = new CfnWebACL(this, 'WebAcl', {...})
webAcl.overrideLogicalId('WAFMonitoringWebAclABC123')  // Match original
```

**Rule 3: Check exports before refactoring**
```bash
# List all exports from a stack
aws cloudformation list-exports --region us-east-1 --profile fe-dev \
  --query 'Exports[?starts_with(Name, `devGlobal`)].Name'

# Check what's importing your exports
aws cloudformation list-imports --export-name "devGlobalStack..." --region ap-northeast-2
```

**Rule 4: Two-phase deployment for cross-region changes**
```bash
# Phase 1: Remove imports (deploy importing stack without references)
# Phase 2: Update exports (deploy exporting stack with new logical IDs)
# Phase 3: Re-add imports (deploy importing stack with new references)
```

### Cross-Region vs Same-Region Refactoring

| Aspect | Same-Region | Cross-Region |
|--------|-------------|--------------|
| `cdk refactor` | ✅ Works | ❌ Not supported |
| `overrideLogicalId()` | ✅ Works | ✅ Works (but limited) |
| Two-phase deployment | Optional | Often required |
| Export name change | Blocked if imported | Blocked if imported |
| Recovery complexity | Low | High (multi-stack) |

### Checklist: Before Refactoring Cross-Region Exported Resources

- [ ] **Identify exports:** Run `cdk synth` and search for `Fn::GetAtt` with cross-region references
- [ ] **List importers:** Check which stacks import these exports
- [ ] **Plan logical ID preservation:** Document which IDs must remain unchanged
- [ ] **Test in DEV:** Deploy to DEV environment first
- [ ] **Monitor both regions:** Watch CloudFormation events in BOTH us-east-1 and ap-northeast-2
- [ ] **Have rollback plan:** Know how to use `continue-update-rollback --resources-to-skip`

---

## Best Practices

✅ **Do:**
- Always run `cdk diff` before deployment
- Test refactoring in DEV environment first
- Document why overrideLogicalId() is used (comments)
- Keep logical ID overrides to minimum
- Use descriptive construct IDs that won't need changing
- Check CloudFormation console to verify UPDATE not REPLACE

❌ **Don't:**
- Refactor without checking `cdk diff` output
- Use overrideLogicalId() for new resources
- Forget to document logical ID preservation reasons
- Assume all replacements are safe
- Deploy to production without DEV testing

