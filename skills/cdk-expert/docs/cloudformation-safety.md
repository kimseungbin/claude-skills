# CloudFormation Safety

Critical guide to preventing accidental resource replacements during CDK refactoring.

## Table of Contents

1. [Understanding Logical IDs](#understanding-logical-ids)
2. [Safe Refactoring](#safe-refactoring-no-replacement)
3. [Dangerous Refactoring](#dangerous-refactoring-will-replace)
4. [Using overrideLogicalId()](#using-overridelogicalid)
5. [Safe vs Unsafe Replacements](#safe-vs-unsafe-replacements)
6. [Complete Workflow](#complete-overridelogicalid-workflow)
7. [Pre-Refactoring Checklist](#pre-refactoring-checklist)

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

## Using overrideLogicalId()

### When to Use

Use `overrideLogicalId()` to preserve logical IDs when refactoring:

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

---

## Related Documentation

- **CDK Fundamentals**: `docs/cdk-fundamentals.md`
- **Refactoring Strategy**: `docs/refactoring-decision-tree.md`
- **Resource Naming**: `docs/naming-strategy-decision-tree.md`
