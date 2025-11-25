# Stacks & Deployment

Organizing CDK applications into stacks and managing multi-environment deployments.

## Stack Organization

Choose the right stack organization strategy based on project complexity.

### Option 1: Single Stack (Simple Projects)

Best for small applications with few resources.

```typescript
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // All resources in one stack
    const vpc = new Vpc(this, 'Vpc')
    const cluster = new Cluster(this, 'Cluster', { vpc })
    const service = new Service(this, 'Service', { cluster })
  }
}

// In bin/app.ts
const app = new App()
new AppStack(app, 'MyApp', {
  env: { account: '123456789012', region: 'us-east-1' },
})
```

**Pros:**
- Simple to understand
- Fast deployment
- No cross-stack dependencies

**Cons:**
- All resources update together (slower deployments)
- Can't share resources across apps
- Harder to manage large applications

---

### Option 2: Multiple Stacks (Modular)

Split infrastructure into logical boundaries.

```typescript
// vpc-stack.ts
export class VpcStack extends Stack {
  public readonly vpc: IVpc

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    })
  }
}

// compute-stack.ts
export class ComputeStack extends Stack {
  public readonly cluster: ICluster

  constructor(scope: Construct, id: string, props: { vpc: IVpc }) {
    super(scope, id)
    this.cluster = new Cluster(this, 'Cluster', {
      vpc: props.vpc,
    })
  }
}

// data-stack.ts
export class DataStack extends Stack {
  constructor(scope: Construct, id: string, props: { vpc: IVpc }) {
    super(scope, id)
    new Database(this, 'Database', {
      vpc: props.vpc,
    })
  }
}

// In bin/app.ts
const app = new App()
const vpcStack = new VpcStack(app, 'Vpc', { env })
const computeStack = new ComputeStack(app, 'Compute', { env, vpc: vpcStack.vpc })
new DataStack(app, 'Data', { env, vpc: vpcStack.vpc })
```

**Pros:**
- Independent deployments (VPC changes don't redeploy compute)
- Share resources across stacks
- Better organization for large apps

**Cons:**
- More complex dependency management
- Cross-stack references create CloudFormation exports
- Must deploy in correct order

---

### Option 3: CDK Pipelines (Multi-Environment)

Automated CI/CD with multiple environments.

```typescript
// deployment-stack.ts
export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection('my-org/my-repo', 'main', {
          connectionArn: 'arn:aws:codestar-connections:...',
        }),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
    })

    // Add stages (environments)
    pipeline.addStage(new DevStage(this, 'Dev'))
    pipeline.addStage(new StagingStage(this, 'Staging'))
    pipeline.addStage(new ProdStage(this, 'Prod', {
      pre: [new ManualApprovalStep('PromoteToProd')],
    }))
  }
}

// app-stage.ts
export class DevStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props)

    // Deploy all stacks for this environment
    new VpcStack(this, 'Vpc')
    new ComputeStack(this, 'Compute')
    new DataStack(this, 'Data')
  }
}
```

**Pros:**
- Automated deployments on git push
- Multiple environments (DEV → STAGING → PROD)
- Self-updating pipeline
- Manual approval gates

**Cons:**
- More complex setup
- Requires AWS CodePipeline (costs)
- Harder to debug pipeline issues

---

## Cross-Stack References

### Exporting Values

```typescript
// ✅ Export values for cross-stack use
export class VpcStack extends Stack {
  public readonly vpc: IVpc
  public readonly securityGroup: ISecurityGroup

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: 2,
    })

    this.securityGroup = new SecurityGroup(this, 'SG', {
      vpc: this.vpc,
      allowAllOutbound: true,
    })
  }
}
```

### Importing Values

```typescript
// ✅ Type-safe reference
export interface ComputeStackProps extends StackProps {
  readonly vpcStack: VpcStack
}

export class ComputeStack extends Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props)

    // Type-safe access to exported values
    const vpc = props.vpcStack.vpc
    const securityGroup = props.vpcStack.securityGroup

    new Cluster(this, 'Cluster', {
      vpc,
      securityGroups: [securityGroup],
    })
  }
}

// In app
const vpcStack = new VpcStack(app, 'Vpc', { env })
const computeStack = new ComputeStack(app, 'Compute', {
  env,
  vpcStack,  // ✅ Pass entire stack for type safety
})
```

### Cross-Region References

For resources in different regions (e.g., CloudFront in us-east-1, ALB in us-west-2):

```typescript
// global-stack.ts (us-east-1)
export class GlobalStack extends Stack {
  public readonly certificateArn: string

  constructor(scope: Construct, id: string) {
    super(scope, id, { env: { region: 'us-east-1' } })

    const cert = new Certificate(this, 'Cert', {
      domainName: 'example.com',
    })

    // Export ARN manually (not IResource)
    this.certificateArn = cert.certificateArn
  }
}

// regional-stack.ts (us-west-2)
export class RegionalStack extends Stack {
  constructor(scope: Construct, id: string, props: { certArn: string }) {
    super(scope, id, { env: { region: 'us-west-2' } })

    // Use ARN string (can't use IResource cross-region)
    new Distribution(this, 'Distribution', {
      certificateArn: props.certArn,  // Pass as string
    })
  }
}
```

---

## Environment-Specific Configuration

### Type-Safe Configuration

```typescript
// config.ts
export interface EnvironmentConfig {
  readonly account: string
  readonly region: string
  readonly cpu: number
  readonly memory: number
  readonly desiredCount: number
  readonly enableXRay: boolean
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    account: '111111111111',
    region: 'us-east-1',
    cpu: 256,
    memory: 512,
    desiredCount: 1,
    enableXRay: false,
  },
  staging: {
    account: '222222222222',
    region: 'us-east-1',
    cpu: 512,
    memory: 1024,
    desiredCount: 2,
    enableXRay: true,
  },
  prod: {
    account: '333333333333',
    region: 'us-east-1',
    cpu: 1024,
    memory: 2048,
    desiredCount: 3,
    enableXRay: true,
  },
}

// Get config
export function getConfig(envName: string): EnvironmentConfig {
  const config = environments[envName]
  if (!config) {
    throw new Error(`Unknown environment: ${envName}`)
  }
  return config
}
```

### Using Configuration in Stacks

```typescript
// app.ts
const envName = process.env.ENVIRONMENT || 'dev'
const config = getConfig(envName)

new ServiceStack(app, 'Service', {
  env: {
    account: config.account,
    region: config.region,
  },
  cpu: config.cpu,
  memory: config.memory,
  desiredCount: config.desiredCount,
  enableXRay: config.enableXRay,
})
```

### CDK Context for Environment Detection

```typescript
// cdk.json
{
  "context": {
    "dev": {
      "cpu": 256,
      "memory": 512
    },
    "prod": {
      "cpu": 1024,
      "memory": 2048
    }
  }
}

// In stack
const envName = this.node.tryGetContext('environment') || 'dev'
const config = this.node.tryGetContext(envName)
```

---

## Deployment Strategies

### Blue/Green Deployment

```typescript
import { CfnTrafficRouting } from 'aws-cdk-lib/aws-codedeploy'

new EcsDeploymentGroup(this, 'BlueGreenDG', {
  service,
  blueGreenDeploymentConfig: {
    blueTargetGroup: blueTargetGroup,
    greenTargetGroup: greenTargetGroup,
    listener: listener,
    trafficRoutingConfig: new CfnTrafficRouting({
      type: 'TimeBasedLinear',
      timeBasedLinear: {
        intervalInMinutes: 1,
        percentagePerInterval: 20,
      },
    }),
  },
})
```

### Canary Deployment

```typescript
new Alias(this, 'ProdAlias', {
  aliasName: 'prod',
  version: newVersion,
  provisionedConcurrentExecutions: 10,

  // Canary: 10% traffic to new version for 5 minutes
  deploymentConfig: LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
})
```

### Rolling Update (ECS)

```typescript
new FargateService(this, 'Service', {
  cluster,
  taskDefinition,

  // Rolling update settings
  desiredCount: 4,
  minHealthyPercent: 50,   // Keep at least 2 tasks running
  maxHealthyPercent: 200,  // Can scale to 8 tasks during update

  deploymentAlarms: {
    alarmNames: ['HighErrorRate', 'HighLatency'],
    behavior: AlarmBehavior.ROLLBACK_ON_ALARM,
  },
})
```

---

## Multi-Account Deployment

### CDK Pipelines with Multiple Accounts

```typescript
export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      env: { account: 'PIPELINE_ACCOUNT', region: 'us-east-1' },
    })

    const pipeline = new CodePipeline(this, 'Pipeline', {
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection('org/repo', 'main'),
        commands: ['npm ci', 'npx cdk synth'],
      }),

      // Enable cross-account deployments
      crossAccountKeys: true,
    })

    // Deploy to different accounts
    pipeline.addStage(new DevStage(this, 'Dev', {
      env: { account: 'DEV_ACCOUNT', region: 'us-east-1' },
    }))

    pipeline.addStage(new ProdStage(this, 'Prod', {
      env: { account: 'PROD_ACCOUNT', region: 'us-east-1' },
    }))
  }
}
```

### Required IAM Setup

For cross-account pipelines, you need trust relationships:

```typescript
// In target accounts (DEV_ACCOUNT, PROD_ACCOUNT)
// Bootstrap with pipeline account trust
// cdk bootstrap \
//   --trust PIPELINE_ACCOUNT \
//   --cloudformation-execution-policies 'arn:aws:iam::aws:policy/AdministratorAccess' \
//   aws://TARGET_ACCOUNT/us-east-1
```

---

## Best Practices

✅ **Do:**
- Use separate accounts for DEV/STAGING/PROD
- Always specify `env` in stack props (account + region)
- Export resources as public properties for cross-stack refs
- Use type-safe configuration objects
- Enable `crossAccountKeys: true` for cross-account pipelines
- Test in DEV before promoting to PROD

❌ **Don't:**
- Deploy to multiple regions from same stack (use separate stacks)
- Hardcode account IDs in stack code (use config)
- Create circular dependencies between stacks
- Use environment variables for account IDs (use CDK context)
- Deploy PROD and DEV in same account (security isolation)

---

## Troubleshooting

### Circular Dependency Error

```
Error: Cannot add dependency on stack 'A' - it would create a circular dependency
```

**Solution:** Refactor to move shared resource to new stack, or merge stacks.

### Cross-Stack Reference Not Found

```
Error: No export named 'Stack1:ExportsOutputRefMyResource' found
```

**Solution:** Ensure dependency stack is deployed first:
```bash
cdk deploy VpcStack ComputeStack  # Deploy in order
```

### Cross-Region Reference Error

```
Error: Cannot reference resource across regions
```

**Solution:** Use ARN strings instead of IResource objects for cross-region.

