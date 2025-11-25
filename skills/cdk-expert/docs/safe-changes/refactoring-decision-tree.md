# CDK Refactoring Decision Tree

Use this decision tree to determine if and how to refactor CDK code.

## Question 1: Why do you want to refactor?

### A) "The constructor is too long / code is messy"

→ Go to [Question 2: Length vs Complexity](#question-2-length-vs-complexity)

### B) "I want to reuse this code elsewhere"

→ Go to [Question 3: Reuse Strategy](#question-3-reuse-strategy)

### C) "Testing is difficult"

→ Go to [Question 4: Testing Difficulties](#question-4-testing-difficulties)

### D) "Concerns are mixed (e.g., CloudFront + logging together)"

→ Go to [Question 5: Separation of Concerns](#question-5-separation-of-concerns)

### E) "I'm following a refactoring checklist / TODO"

→ **STOP**: Validate that the refactoring adds actual value first

---

## Question 2: Length vs Complexity

**Your constructor is 100+ lines. Should you refactor?**

### A) Most lines are simple configuration (like Glue table columns)

**Answer**: ❌ **No, don't refactor**

- Long != complex
- Extracting to a method doesn't add value
- Keep it inline for clarity

**Example:**

```typescript
// ❌ Don't extract this
const columns = [
	{ name: 'date', type: 'date' },
	{ name: 'time', type: 'string' },
	// ... 30 more simple lines
]
```

### B) Lines contain complex logic (conditionals, loops, calculations)

**Answer**: ✅ **Yes, extract complex logic**

```typescript
// ✅ Extract complex logic
private calculateMemoryLimit(cpu: number, environment: string): number {
  const base = cpu * 2
  const multiplier = environment === 'prod' ? 2 : 1
  return Math.min(base * multiplier, 30720)
}
```

### C) Code is repeated in multiple places

**Answer**: ✅ **Yes, extract to reusable method**
→ Go to [Question 3: Reuse Strategy](#question-3-reuse-strategy)

---

## Question 3: Reuse Strategy

**You want to reuse code. Where will it be used?**

### A) Within the same construct (multiple times)

**Solution**: Extract to private method

```typescript
export class MyConstruct extends Construct {
	constructor(scope, id, props) {
		super(scope, id)
		this.logBucket = this.createBucket('Logs')
		this.assetBucket = this.createBucket('Assets') // Reused!
	}

	private createBucket(name: string): Bucket {
		return new Bucket(this, name, {
			/* common config */
		})
	}
}
```

### B) Across multiple constructs in same stack

**Solution**: Extract to shared construct

```typescript
export class SharedBucketConstruct extends Construct {
	readonly bucket: Bucket

	constructor(scope, id, props: { purpose: string }) {
		super(scope, id)
		this.bucket = new Bucket(this, 'Bucket', {
			/* config */
		})
	}
}

// Usage in other constructs
const logBucket = new SharedBucketConstruct(this, 'Logs', { purpose: 'logs' })
```

### C) Across multiple projects

**Solution**: Create L3 construct library

```typescript
// In separate npm package
export class StandardS3Bucket extends Construct {
	readonly bucket: Bucket

	constructor(scope, id, props?) {
		super(scope, id)
		this.bucket = new Bucket(this, 'Bucket', {
			encryption: BucketEncryption.S3_MANAGED,
			versioned: true,
			lifecycleRules: [{ expiration: Duration.days(90) }],
		})
	}
}
```

---

## Question 4: Testing Difficulties

**Why is testing difficult?**

### A) Too many dependencies required to instantiate construct

**Solution**: Use dependency injection

```typescript
// ❌ Hard to test: Requires entire Shared construct
export class Service extends Construct {
	constructor(scope, id, props: { shared: Shared }) {
		const vpc = props.shared.vpc
		const cluster = props.shared.cluster
		// ...
	}
}

// ✅ Easy to test: Only requires what you need
export class Service extends Construct {
	constructor(scope, id, props: { vpc: IVpc; cluster: ICluster }) {
		// Now you can pass mocks in tests
	}
}
```

### B) Construct does too many things (hard to test in isolation)

**Solution**: Split construct responsibilities
→ Go to [Question 5: Separation of Concerns](#question-5-separation-of-concerns)

### C) Can't test without deploying to AWS

**Solution**: Use CDK assertions library

```typescript
import { Template } from 'aws-cdk-lib/assertions'

it('creates encrypted bucket', () => {
	const stack = new Stack()
	new MyConstruct(stack, 'Test', {})

	const template = Template.fromStack(stack)
	template.hasResourceProperties('AWS::S3::Bucket', {
		BucketEncryption: {
			/* ... */
		},
	})
})
```

---

## Question 5: Separation of Concerns

**Are multiple unrelated concerns mixed together?**

### Identify the concerns:

**Example 1: CloudFront + Log Analytics**

- Concern A: CloudFront distribution (cache policy, functions)
- Concern B: Log analytics (Glue, Athena)
- **Relationship**: Logs come from CloudFront, but analytics is independent
- **Decision**: ✅ Separate into two constructs

**Example 2: ECS Service + Auto-scaling**

- Concern A: ECS service definition
- Concern B: Auto-scaling policies
- **Relationship**: Tightly coupled (auto-scaling requires service)
- **Decision**: ❌ Keep together (or use L3 pattern that handles both)

### Separation Decision Tree:

```
Can concern A exist without concern B?
├─ Yes
│  └─ Can concern B exist without concern A?
│     ├─ Yes → ✅ Separate into two constructs
│     └─ No → ⚠️ Consider making B depend on A (composition)
└─ No → ❌ Keep together
```

### How to separate:

**Step 1: Check CloudFormation impact**

```bash
# Before refactoring
npm run cdk synth > before.json

# After refactoring (with overrideLogicalId if needed)
npm run cdk synth > after.json

# Compare logical IDs
diff <(grep -o '"[^"]*"' before.json | sort) \
     <(grep -o '"[^"]*"' after.json | sort)
```

**Step 2: Determine replacement risk**

- Safe to replace: Glue tables, Lambda functions, IAM roles
- Unsafe to replace: S3 buckets, DynamoDB tables, RDS, ECR

**Step 3: Choose approach**

**Option A: CDK Refactor Command (Recommended)**

```bash
# 1. Make refactoring changes (move resources, rename constructs)
# 2. Apply refactoring FIRST (before other changes)
npm run cdk -- refactor --unstable=refactor
# CDK detects logical ID changes and updates them in-place
# No resource replacement!

# 3. Then deploy normally
npm run cdk deploy
```

**When to use:**
- Moving resources between constructs
- Renaming constructs
- Reorganizing construct hierarchy
- Any change that affects logical IDs

**Constraints:**
- ⚠️ Preview feature (requires `--unstable=refactor` flag)
- ⚠️ Must refactor separately from other infrastructure changes
- ⚠️ Resources must stay in same AWS account/region

**See:** `/TEMP_CDK_REFACTOR_RESEARCH.md` for complete guide

**Option B: Use overrideLogicalId() (Manual Fallback)**

```typescript
export class NewConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id)

    const resource = new CfnResource(this, 'Resource', {...})
    resource.overrideLogicalId('OldConstructResourceABC123')
    // Preserves CloudFormation logical ID → no replacement
  }
}
```

**When to use:**
- `cdk refactor` not viable (cross-account, specific resource types)
- Need fine-grained control over specific resources
- Legacy code maintenance

**Option C: Accept replacement (if safe)**

```typescript
// Old construct gone, new construct created
// CloudFormation will replace resources
```

**When to use:**
- Resources are stateless (Lambda, IAM roles, Glue tables)
- Testing in DEV environment
- Intentional resource recreation

**Option D: Incremental migration**

```typescript
// Phase 1: Keep old construct, add new construct (both exist)
// Phase 2: Migrate resources gradually
// Phase 3: Remove old construct when empty
```

**When to use:**
- High-risk production changes
- Large-scale refactoring across many services
- Need to validate each step

---

## Final Checklist

Before executing refactoring:

- [ ] I've identified a clear benefit (reuse, separation, testing)
- [ ] I've run `cdk diff` to check CloudFormation impact
- [ ] I've identified resources that will be replaced
- [ ] I've verified replaced resources are safe (stateless) OR planned to use `cdk refactor`
- [ ] I've chosen refactoring approach:
  - [ ] Option A: `cdk refactor` command (recommended for logical ID changes)
  - [ ] Option B: `overrideLogicalId()` (manual fallback)
  - [ ] Option C: Accept replacement (stateless resources only)
  - [ ] Option D: Incremental migration (high-risk changes)
- [ ] I'll test in DEV environment first
- [ ] I've documented the refactoring plan

**If any checkbox is unchecked, reconsider the refactoring.**

---

## Anti-Patterns to Avoid

### ❌ Extract Private Method (No Reuse)

```typescript
// Before: 113-line constructor
constructor() {
  // ... 113 lines of code
}

// After: Still 113 lines, just moved
constructor() {
  this.method1()
  this.method2()
  // ... 10 method calls
}

private method1() { /* 20 lines */ }
private method2() { /* 15 lines */ }
// ... 8 more private methods

// Result: No benefit, harder to read
```

### ❌ Premature Abstraction

```typescript
// You write it once, no reuse yet
export class AbstractBaseService extends Construct {
	// 200 lines of generic code
	// Trying to predict future needs
}

// Better: Wait until you have 2-3 concrete examples
// Then extract common patterns
```

### ❌ Refactor Without Checking CloudFormation

```typescript
// You move code to new construct
// Run cdk deploy
// Surprise! All your data is deleted

// Always check cdk diff first!
```

---

## When NOT to Refactor

**Don't refactor if:**

- ❌ Code works fine and has no clear issue
- ❌ You're just "cleaning up" for aesthetics
- ❌ No one else will maintain this code
- ❌ You don't understand what the code does
- ❌ You're close to a deadline
- ❌ The refactoring doesn't solve a real problem

**Wait until you have:**

- ✅ A clear problem to solve
- ✅ Evidence of duplication or complexity
- ✅ Time to test thoroughly
- ✅ Understanding of CloudFormation impact
