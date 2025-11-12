# CDK Lambda Patterns

Best practices for AWS Lambda functions in CDK projects.

## NodejsFunction with TypeScript Source

**✅ Best Practice: Use TypeScript source directly**

```typescript
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'

// ✅ Point to TypeScript source - CDK bundles with esbuild
const workspaceEntry = path.join(
  __dirname,
  '../../../packages/lambda/my-function/src/index.ts'  // .ts source
)

const fn = new NodejsFunction(this, 'MyFunction', {
  entry: workspaceEntry,
  handler: 'handler',
  runtime: Runtime.NODEJS_LATEST,
  bundling: {
    externalModules: ['@aws-sdk/*'],  // AWS SDK v3 in Lambda runtime
    minify: true,
    sourceMap: true,
  },
})
```

**❌ Anti-pattern: Pre-compiled JavaScript**

```typescript
// ❌ Don't do this - requires manual build and committing dist/
const workspaceEntry = path.join(
  __dirname,
  '../../../packages/lambda/my-function/dist/index.js'  // Pre-compiled
)
```

**Why TypeScript source is better:**

1. **No manual builds** - CDK compiles automatically during `cdk synth`
2. **Cleaner git** - No need to commit compiled JavaScript
3. **Always fresh** - Can't forget to rebuild before deploying
4. **Standard practice** - How `NodejsFunction` is designed to work
5. **Type safety** - CDK can validate imports during synthesis

---

## Lambda Workspace Structure

**Monorepo pattern for multiple Lambda functions:**

```
packages/
└── lambda/
    ├── package.json              # Parent workspace
    ├── function-a/
    │   ├── package.json
    │   ├── src/
    │   │   └── index.ts         # Lambda handler (TypeScript)
    │   └── tsconfig.json
    ├── function-b/
    │   ├── package.json
    │   ├── src/
    │   │   └── index.ts
    │   └── tsconfig.json
    └── shared/                   # Shared utilities
        ├── package.json
        └── src/
            └── utils.ts
```

**.gitignore for Lambda workspaces:**

```gitignore
# Ignore all JS/compiled output
*.js
*.d.ts
*.js.map

# Except specific files you need
!jest.config.js
!lib/constructs/cloudfront/*.js  # Legacy Lambda@Edge (if needed)

# CDK handles Lambda compilation - don't commit dist/
# (No exceptions needed for packages/lambda/*/dist/)
```

---

## Lambda Props Patterns

**Type-safe construct with ConfigService:**

```typescript
interface LambdaConstructProps {
  sourceTopic: Topic
  centralTopicArn: string
  environment: Environment  // From types/general.ts
}

export class MessageTransformerConstruct extends Construct {
  public readonly function: NodejsFunction

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id)

    const { sourceTopic, centralTopicArn, environment } = props

    // Environment-specific configuration
    const emojiMap: Record<Environment, string> = {
      [Environment.DEV]: '🟢',
      [Environment.QA]: '🔵',
      [Environment.STAGING]: '🟡',
      [Environment.PROD]: '🔴',
    }

    this.function = new NodejsFunction(this, 'Function', {
      entry: path.join(__dirname, '../../../packages/lambda/transformer/src/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_LATEST,
      environment: {
        CENTRAL_TOPIC_ARN: centralTopicArn,
        ENVIRONMENT: environment,
        EMOJI: emojiMap[environment],
      },
    })

    // Grant permissions
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [centralTopicArn],
      })
    )

    // Subscribe to topic
    sourceTopic.addSubscription(new LambdaSubscription(this.function))
  }
}
```

---

## Common Lambda Anti-patterns

### ❌ Anti-pattern 1: Committing compiled code

```typescript
// ❌ Don't commit dist/ directories
packages/lambda/my-function/dist/index.js  // In git
packages/lambda/my-function/dist/index.js.map  // In git

// Problem: Manual build step, git bloat, merge conflicts
```

**✅ Solution: Let CDK bundle**

```typescript
// ✅ Only commit TypeScript source
packages/lambda/my-function/src/index.ts  // In git

// CDK handles compilation automatically
// Add to .gitignore: packages/lambda/*/dist/
```

### ❌ Anti-pattern 2: Bundling AWS SDK

```typescript
// ❌ Don't bundle AWS SDK v3 (already in Lambda runtime)
bundling: {
  // externalModules not specified - bundles everything
}
```

**✅ Solution: Mark AWS SDK as external**

```typescript
// ✅ Exclude AWS SDK from bundle
bundling: {
  externalModules: ['@aws-sdk/*'],  // Provided by Lambda runtime
  minify: true,
  sourceMap: true,
}
```

### ❌ Anti-pattern 3: Inline Lambda code in construct

```typescript
// ❌ Don't inline Lambda code
const fn = new Function(this, 'Fn', {
  runtime: Runtime.NODEJS_LATEST,
  handler: 'index.handler',
  code: Code.fromInline(`
    exports.handler = async (event) => {
      // Complex logic here...
    }
  `),
})
```

**✅ Solution: Use workspace packages**

```typescript
// ✅ Separate Lambda code in workspace
const fn = new NodejsFunction(this, 'Fn', {
  entry: path.join(__dirname, '../../../packages/lambda/my-fn/src/index.ts'),
  // Benefits: Type safety, testing, reusability
})
```

---

## Build-free Deployment Workflow

**Traditional (manual build):**

```bash
# ❌ Old way - manual steps
cd packages/lambda/my-function
npm run build                    # Compile TypeScript
cd ../../../
git add packages/lambda/*/dist/  # Commit compiled code
git commit -m "Update Lambda"
cdk deploy                       # Deploy
```

**CDK Auto-bundling:**

```bash
# ✅ New way - CDK handles it
# (No build step needed)
git add packages/lambda/my-function/src/index.ts
git commit -m "Update Lambda"
cdk deploy  # CDK compiles during synth
```

**How it works:**

1. `cdk synth` triggers `NodejsFunction` bundling
2. CDK runs `esbuild` on TypeScript source
3. Compiled code packaged as Lambda asset
4. Asset uploaded to S3 during `cdk deploy`
5. Lambda function updated with new code

**No manual compilation needed!**

---

## Quick Reference

### DO ✅

- Point `NodejsFunction.entry` to TypeScript source (`.ts` files)
- Add `packages/lambda/*/dist/` to `.gitignore`
- Mark AWS SDK as external: `externalModules: ['@aws-sdk/*']`
- Use workspace packages for Lambda code organization
- Let CDK handle compilation during `cdk synth`

### DON'T ❌

- Commit `dist/` directories to git
- Point entry to pre-compiled JavaScript (`.js` files)
- Bundle AWS SDK v3 (already in Lambda runtime)
- Inline complex Lambda code in constructs
- Run manual `npm run build` before deployment

---

## Related Documentation

- **NodejsFunction API**: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html
- **Lambda runtimes**: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
- **esbuild bundling**: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html#bundling