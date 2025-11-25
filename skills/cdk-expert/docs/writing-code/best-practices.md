# CDK Development Best Practices

This guide captures battle-tested best practices learned from real-world CDK infrastructure development, refactoring, and troubleshooting.

## Table of Contents

- [Code Quality](#code-quality)
  - [Question Everything - Especially Legacy Code](#question-everything---especially-legacy-code)
  - [Duplicate Code is a Code Smell](#duplicate-code-is-a-code-smell)
  - [Naming Reveals Redundancy](#naming-reveals-redundancy)
- [Safe Development](#safe-development)
  - [Feature Flags Enable Safe Experimentation](#feature-flags-enable-safe-experimentation)
  - [CloudFormation Safety Requires Vigilance](#cloudformation-safety-requires-vigilance)
  - [Decision Framework: Conditional Logic vs Separate Constructs](#decision-framework-conditional-logic-vs-separate-constructs)
  - [Incremental Deployment Is Risk Management](#incremental-deployment-is-risk-management)
- [Collaboration](#collaboration)
  - [User Questions Drive Better Solutions](#user-questions-drive-better-solutions)

---

## Code Quality

### Question Everything - Especially Legacy Code

**Principle:** Don't fix bugs in legacy code without asking "Should this code exist at all?"

**Why it matters:**
- Legacy code often contains workarounds that are no longer needed
- Technology changes make old patterns obsolete
- Dead code accumulates over time if not questioned

**Real-world example:**

During ECR cache implementation, encountered syntax error in post-build.sh script that used brace blocks `{ ... }` for grouping commands to write appspec.yaml.

**❌ Wrong approach:**
```bash
# Fix the parser to handle brace blocks
{
  echo "line1"
  echo "line2"
} > appspec.yaml
```

**✅ Right approach:**
```typescript
// Question: "Do we even need appspec creation?"
// Investigation: Service uses ECS rolling deployment (DeploymentControllerType.ECS), not Blue/Green CodeDeploy
// Result: appspec.yaml is Blue/Green artifact - completely unused
// Action: Delete entire section (15+ lines of dead code)
```

**When to question code:**
- Encountering errors in legacy code
- Code has workarounds or "magic" that isn't clear
- Comments like "TODO", "HACK", "FIXME"
- Code duplicated across files
- Patterns that feel overcomplicated

**Questions to ask:**
1. Why does this code exist?
2. What problem was it solving?
3. Is that problem still relevant?
4. Has AWS/CDK introduced better solutions since this was written?
5. What happens if I delete it?

**Action:** Create backlog items for refactoring instead of band-aid fixes.

---

### Duplicate Code is a Code Smell

**Principle:** If you see the same code in multiple places, one of them is probably wrong or unnecessary.

**Real-world example:**

Found ECR login in both `install.sh` and `post-build.sh` scripts:

```bash
# install.sh
aws ecr get-login-password | docker login ...

# post-build.sh
aws ecr get-login-password | docker login ...  # ❌ Duplicate!
```

**Investigation revealed:**
- AWS CodeBuild credentials persist across all phases (install → pre_build → build → post_build)
- Second login was completely unnecessary
- Added duplicate authentication latency (~2-3 seconds per build)

**✅ Solution:**
```bash
# install.sh - Login ONCE
echo "Logging in to ECR..."
aws ecr get-login-password | docker login ...

# post-build.sh - Comment explaining why no login needed
# ECR login is performed in install phase - credentials persist across all phases
docker push "$REPOSITORY_URI":latest
```

**When you see duplication:**
1. **Stop** - Don't copy-paste without understanding
2. **Investigate** - Why was it duplicated?
3. **Question** - Is both instances needed?
4. **Document** - Add comments explaining why if truly needed
5. **Refactor** - Remove duplication if possible

**Common causes of duplication:**
- Copy-paste programming without understanding
- Defensive coding ("better safe than sorry")
- Evolution of codebase (old pattern + new pattern coexist)
- Lack of shared utilities or constructs

---

### Naming Reveals Redundancy

**Principle:** If you need to add redundant information to a name, the architecture might be wrong.

**Real-world example:**

ECR cache implementation used cache tag `${environment}-cache` (e.g., `dev-cache`):

```typescript
CACHE_TAG: {
  type: BuildEnvironmentVariableType.PLAINTEXT,
  value: `${environment}-cache`,  // "dev-cache", "staging-cache", etc.
}
```

**Problem identified:**
- ECR repository is already service-specific per environment
- Repository name: `{account}-{service}` in separate AWS accounts per environment
- The `${environment}-` prefix is redundant - repository already isolated by environment

**Better naming:**
```typescript
CACHE_TAG: {
  type: BuildEnvironmentVariableType.PLAINTEXT,
  value: 'cache',  // Simple, since repo is already env-specific
}
```

**When naming reveals redundancy:**
- `dev-dev-something` - Double environment prefix
- `service-name-service` - Service mentioned twice
- `{account}-{region}-{env}-{service}` when some info is already in ARN

**Action steps:**
1. **Identify** - Write out the full resource identifier path
2. **Analyze** - What context is already known from parent resource?
3. **Simplify** - Remove redundant segments
4. **Document** - Add TODO comment if keeping redundant name for migration safety

**Example from project:**
```typescript
// TODO: Simplify to just "cache" since ECR repository is already service-specific
// The environment prefix is redundant given repository isolation per service.
// However, keeping current naming for consistency with potential multi-environment
// cache strategies or shared ECR namespaces in the future.
value: `${environment}-cache`,
```

---

## Safe Development

### Feature Flags Enable Safe Experimentation

**Principle:** Feature flags allow you to deploy new implementations alongside old ones, enabling safe rollout and instant rollback.

**Why it matters:**
- Zero-downtime switching between implementations
- A/B testing infrastructure changes
- Gradual rollout (one service → one environment → all)
- Instant rollback without redeployment

**Real-world example:**

ECR remote cache implementation for CodeBuild:

```yaml
# feature-flags.yaml
service-deployment:
  dev:
    yozm:
      experimental-ecr-cache: true  # Single service, single environment
```

```typescript
// Construct selection based on feature flag
const useEcrCache =
  FEATURE_FLAGS['service-deployment']?.[environment]?.[serviceName]?.['experimental-ecr-cache'] === true

const CodeBuildConstruct = useEcrCache
  ? EcrCacheCodeBuildProject   // New implementation
  : LegacyCodeBuildProject      // Proven implementation

if (useEcrCache) {
  console.log(`[Service] ${serviceName}: Using experimental ECR cache CodeBuild`)
}

// Both constructs have identical interface (drop-in replacement)
new CodeBuildConstruct(this, 'CodeBuildProjectConstruct', props)
```

**Rollout strategy:**
1. **Phase 1**: Deploy with flag disabled → no impact
2. **Phase 2**: Enable for 1 service in DEV → monitor
3. **Phase 3**: Enable for all services in DEV → validate savings
4. **Phase 4**: Enable in STAGING → production-like testing
5. **Phase 5**: Enable in PROD → full rollout
6. **Phase 6**: Remove flag, delete old construct

**Rollback:** Change YAML from `true` → `false`, deploy (instant switch back)

**Feature flag types:**

**1. Boolean flags (simple on/off):**
```yaml
feature-name: true
```

**2. Environment-based flags:**
```yaml
feature-name:
  enabled: true
  environments: [dev, staging]  # Exclude production
```

**3. Service-deployment matrix (most granular):**
```yaml
service-deployment:
  dev:
    service-a: { feature-x: true }
    service-b: { feature-x: false }
  production:
    service-a: { feature-x: false }
    service-b: { feature-x: false }
```

**4. Percentage rollout:**
```yaml
feature-name:
  enabled: true
  rollout_percentage: 25  # 25% of services
```

**Best practices:**
- Use descriptive flag names: `experimental-ecr-cache`, not `new-build`
- Start with kebab-case and `experimental-` prefix for risky changes
- Both implementations must have identical interface
- Log when experimental path is taken
- Clean up flags after full rollout (don't accumulate flag debt)
- Document expected behavior in both states

**When NOT to use feature flags:**
- Simple configuration changes (use config matrix)
- One-way migrations (can't easily rollback anyway)
- Temporary debugging code (use environment variables)

---

### CloudFormation Safety Requires Vigilance

**Principle:** Always check `cdk diff` before deployment, even for "simple" changes. CloudFormation resource replacement can cause downtime or data loss.

**Why it matters:**
- Changing construct IDs triggers resource replacement (DELETE + CREATE)
- Stateful resources lose data on replacement (databases, S3 buckets)
- Even stateless resources cause downtime during replacement
- CloudFormation logical ID is determined by construct path + ID

**Pre-deployment checklist:**

```bash
# 1. Always run diff first
npm run diff:dev  # or npx cdk diff --profile fe-dev

# 2. Look for these symbols in output:
[+]  CREATE resource         # ✅ Safe (new resource)
[-]  DELETE resource         # ⚠️  Check if intentional
[~]  UPDATE resource         # ✅ Usually safe (in-place update)
[-/+] REPLACE resource       # 🚨 DANGER! Resource will be deleted and recreated
```

**Real-world example - Safe refactoring:**

```typescript
// Both constructs use SAME construct ID
// CloudFormation logical ID: ServiceyozmCodeBuildProjectConstruct8A6F9C3E

// Legacy construct
export class CodeBuildProjectConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)  // id = 'CodeBuildProjectConstruct'
  }
}

// New construct (same ID!)
export class CodeBuildProjectConstruct extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id)  // id = 'CodeBuildProjectConstruct' (unchanged!)
  }
}

// Usage - same instantiation
new CodeBuildConstruct(this, 'CodeBuildProjectConstruct', props)

// Result: cdk diff shows [~] UPDATE, not [-/+] REPLACE
```

**Common causes of resource replacement:**

| Change | Impact | Solution |
|--------|--------|----------|
| Rename construct ID | Replacement | Use `overrideLogicalId()` or `cdk refactor` |
| Move resource to new construct | Replacement | Use `cdk refactor` command |
| Change resource type | Replacement | Create new, migrate data, delete old |
| Change immutable property | Replacement | Check CloudFormation docs |

**Safe refactoring strategies:**

**Option 1: Use `cdk refactor` (recommended)**
```bash
# Automatically updates logical IDs without replacement
npx cdk refactor --from OldConstruct --to NewConstruct
```

**Option 2: Preserve logical ID manually**
```typescript
// For L1 (Cfn*) constructs only
const bucket = new s3.CfnBucket(this, 'NewID', { /* ... */ })
bucket.overrideLogicalId('OldLogicalID')  // Preserve CloudFormation ID
```

**Option 3: Accept replacement (if safe)**
- Resource is stateless (CodeBuild project, Lambda function)
- Testing in DEV environment first
- Downtime is acceptable
- Data can be recreated

**Stateful resources requiring extra care:**
- S3 buckets (use RemovalPolicy.RETAIN)
- DynamoDB tables (export data first)
- RDS databases (take snapshot)
- Route53 hosted zones (NS records referenced externally)
- EBS volumes (snapshot before replacement)

**Example - Route53 protection:**
```typescript
const hostedZone = new HostedZone(this, 'HostedZone', {
  zoneName: 'qa.wishdev.net',
})

// CRITICAL: Prevent deletion on stack destroy
// NS records are referenced by parent DNS (CloudFlare)
hostedZone.applyRemovalPolicy(RemovalPolicy.RETAIN)
```

**Testing strategy:**
1. Deploy to DEV first (always)
2. Monitor for 24-48 hours
3. Deploy to STAGING
4. Monitor for 1 week
5. Deploy to PROD

See [cloudformation-safety.md](./cloudformation-safety.md) for complete guide.

### Decision Framework: Conditional Logic vs Separate Constructs

**Principle:** When adding phased deployment or feature toggles to existing constructs, prefer conditional logic over extracting separate constructs.

**Decision tree:**

| Scenario | Approach | Reason |
|----------|----------|--------|
| Adding phases to **existing** construct | Conditional logic | Preserves CloudFormation Logical IDs |
| Creating **new** feature from scratch | Separate constructs | Clean hierarchy, no legacy IDs to preserve |
| Real code reuse across stacks | Separate constructs | DRY principle |
| Team willing to maintain `overrideLogicalId()` | Either | But conditional is simpler |

**Key insight:** Choose safety over visual organization in CloudFormation console.

**Example: Two-phase service deployment**
```typescript
// ✅ GOOD: Conditional logic preserves Logical IDs
export class Service extends Construct {
  constructor(scope, id, props) {
    super(scope, id)

    const infraEnabled = isServiceDeploymentPhaseEnabled(env, service, 'infra')
    const serviceEnabled = isServiceDeploymentPhaseEnabled(env, service, 'service')

    // PHASE 1: Build infrastructure (conditionally created)
    if (infraEnabled) {
      new EcrRepository(this, 'ECR', {...})  // Logical ID preserved!
      new TaskDefinition(this, 'TaskDefinition', {...})
    }

    // PHASE 2: Runtime service (conditionally created)
    if (serviceEnabled) {
      new FargateService(this, 'FargateService', {...})  // Logical ID preserved!
    }
  }
}
```

```typescript
// ❌ RISKY: Separate constructs change Logical IDs
export class Service extends Construct {
  constructor(scope, id, props) {
    super(scope, id)

    new ServiceInfraConstruct(this, 'Infra', {...})
    // All child Logical IDs now have "Infra" prefix!
    // CloudFormation sees: Auth/Infra/ECR instead of Auth/ECR
    // → Resource replacement unless overrideLogicalId() for every resource
  }
}
```

See [cloudformation-safety.md](./cloudformation-safety.md) § Option D for complete implementation guide.

---

### Incremental Deployment Is Risk Management

**Principle:** Deploy changes to a single service in a single environment first, monitor, then expand gradually. Never deploy to all services and environments simultaneously.

**Why it matters:**
- Limits blast radius of failures
- Allows performance validation before wide rollout
- Enables learning from edge cases
- Faster rollback (fewer affected resources)
- Easier troubleshooting (fewer variables changed)

**Anti-pattern:**
```yaml
# ❌ DON'T: Enable for all services in all environments at once
service-deployment:
  dev:
    auth: { experimental-ecr-cache: true }
    yozm: { experimental-ecr-cache: true }
    support: { experimental-ecr-cache: true }
    # ... all 7 services
  staging:
    auth: { experimental-ecr-cache: true }
    # ... all services
  production:
    auth: { experimental-ecr-cache: true }
    # ... all services
```

**✅ Incremental rollout strategy:**

**Phase 1: Single service, DEV environment**
```yaml
service-deployment:
  dev:
    yozm: { experimental-ecr-cache: true }  # Only this one!
```

**Monitoring checklist:**
- [ ] Build succeeds
- [ ] Build time reduced (expected: 25-30%)
- [ ] No new errors in CloudWatch Logs
- [ ] Docker images pushed successfully
- [ ] ECS service updates without issues
- [ ] Monitor for 24-48 hours

**Phase 2: All services, DEV environment**
```yaml
service-deployment:
  dev:
    auth: { experimental-ecr-cache: true }
    yozm: { experimental-ecr-cache: true }
    support: { experimental-ecr-cache: true }
    # ... expand to all 7 services
```

**Phase 3: Single service, STAGING**
```yaml
service-deployment:
  dev:
    # ... all services enabled
  staging:
    yozm: { experimental-ecr-cache: true }  # Test in prod-like environment
```

**Phase 4: All services, STAGING**
**Phase 5: Gradual PROD rollout (one service per week)**
**Phase 6: Remove feature flag, delete legacy code**

**Rollout timeline example:**
- Week 1: dev.yozm
- Week 2: dev.* (all services)
- Week 3: staging.yozm
- Week 4: staging.* (all services)
- Week 5: prod.yozm
- Week 6: prod.auth
- Week 7: prod.support
- ... (continue gradually)
- Week 13: All services, all environments → Remove flag

**Rollback at each phase:**
```yaml
# Instant rollback - change flag and deploy
service-deployment:
  dev:
    yozm: { experimental-ecr-cache: false }  # Revert to legacy
```

**Metrics to track:**
- Build duration (before/after)
- Success rate (any new failures?)
- Resource utilization (CodeBuild minutes, ECR storage)
- Deployment frequency (any slowdowns?)
- Error rates (application still healthy?)

**Decision criteria to move to next phase:**
- Zero build failures for 48 hours
- Performance improvement validated
- No increase in error rates
- Team confidence high
- Rollback plan tested and verified

**When to pause rollout:**
- Build failures in new implementation
- Performance worse than expected
- Unexpected costs (ECR storage, CodeBuild minutes)
- Team concerns or questions
- Approaching major release or holiday freeze

---

## Collaboration

### User Questions Drive Better Solutions

**Principle:** When users question your implementation, treat it as an opportunity to improve the solution, not defend the code.

**Why it matters:**
- Users often spot issues you missed
- Questions reveal assumptions you didn't communicate
- "Why?" questions lead to better understanding
- Defensive responses prevent learning

**Real-world examples:**

**Question 1: "Do we even need appspec creation?"**
- Initial response: Started to explain appspec.yaml syntax
- Better response: Investigated whether appspec.yaml is actually used
- Result: Discovered 15+ lines of dead code for Blue/Green deployment that project doesn't use

**Question 2: "Don't we need two logins?"**
- Initial thought: "I already added ECR login to install.sh"
- User observation: Found duplicate login in post-build.sh
- Result: Removed unnecessary duplicate authentication

**Question 3: "Why new key? I thought we are adding a key under dev.yozm"**
- Initial plan: Create new top-level feature flag key
- User correction: Use existing service-deployment matrix
- Result: More consistent feature flag structure

**Question 4: "Why ${environment}-cache when ECR repo is already env-specific?"**
- Initial response: "It's good to be explicit"
- Deeper analysis: Environment prefix is redundant
- Result: Added TODO to simplify, documented rationale

**Response framework:**

**❌ Defensive response:**
```
"That's how the AWS blog post recommended it"
"It's safer to be explicit"
"The old code did it this way"
"I already tested it and it works"
```

**✅ Investigative response:**
```
"Let me check if appspec.yaml is actually used in our deployment"
"Good point - let me trace where this value is referenced"
"I'll compare with the legacy implementation"
"Let me verify whether these credentials persist across phases"
```

**Process:**
1. **Acknowledge** - "That's a good question"
2. **Investigate** - Actually check the codebase/docs
3. **Explain** - Share what you found
4. **Decide** - Together determine best path
5. **Document** - Record decision and rationale

**Questions that should trigger investigation:**
- "Do we really need X?"
- "Why not use Y instead?"
- "Isn't this redundant with Z?"
- "What happens if we remove this?"
- "Can you explain why...?"

**When user points out duplication or complexity:**
- Don't explain it away
- Investigate if it's truly necessary
- Simplify if possible
- Document if complexity is required

**Document decisions:**
```typescript
/**
 * Cache tag for ECR remote cache image
 *
 * Current: `${environment}-cache` (e.g., "dev-cache")
 *
 * TODO: Simplify to just "cache" since ECR repository is already service-specific
 * The environment prefix is redundant given repository isolation per service.
 * However, keeping current naming for consistency with potential multi-environment
 * cache strategies or shared ECR namespaces in the future.
 */
```

This makes future developers (including yourself) understand **why** the code is the way it is.

---

## Summary

**Code Quality:**
- Question legacy code before fixing it
- Duplication is a code smell - investigate and eliminate
- Naming redundancy reveals architecture redundancy

**Safe Development:**
- Feature flags enable safe experimentation and instant rollback
- CloudFormation safety requires running `cdk diff` and understanding logical IDs
- Incremental deployment limits blast radius and builds confidence

**Collaboration:**
- User questions are opportunities to improve, not challenges to defend
- Investigate first, explain second
- Document decisions and rationale

**Remember:** Infrastructure code runs your production systems. Take time to do it right, question assumptions, and deploy incrementally. Speed comes from confidence, not recklessness.