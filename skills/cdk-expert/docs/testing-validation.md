# Testing & Validation

Testing strategies and validation patterns for CDK infrastructure code.

## Unit Tests

### Testing with CDK Assertions

```typescript
import { App, Stack } from 'aws-cdk-lib'
import { Template, Match } from 'aws-cdk-lib/assertions'
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3'

describe('MyStack', () => {
  it('creates S3 bucket with encryption', () => {
    const app = new App()
    const stack = new Stack(app, 'TestStack')

    // Create resource
    new Bucket(stack, 'MyBucket', {
      encryption: BucketEncryption.S3_MANAGED,
    })

    // Assert properties
    const template = Template.fromStack(stack)
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    })
  })

  it('creates exactly 1 S3 bucket', () => {
    const app = new App()
    const stack = new Stack(app, 'TestStack')
    new Bucket(stack, 'MyBucket')

    const template = Template.fromStack(stack)
    template.resourceCountIs('AWS::S3::Bucket', 1)
  })
})
```

### Testing Resource Counts

```typescript
it('creates required resources', () => {
  const template = Template.fromStack(stack)

  template.resourceCountIs('AWS::S3::Bucket', 1)
  template.resourceCountIs('AWS::Lambda::Function', 3)
  template.resourceCountIs('AWS::IAM::Role', 2)
})
```

### Testing with Matchers

```typescript
it('configures IAM policy correctly', () => {
  const template = Template.fromStack(stack)

  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Effect: 'Allow',
          Action: 's3:GetObject',
          Resource: Match.stringLikeRegexp('arn:aws:s3:::.*'),
        }),
      ]),
    },
  })
})
```

---

## Snapshot Tests

### Basic Snapshot Testing

```typescript
it('matches snapshot', () => {
  const app = new App()
  const stack = new MyStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  })

  const template = Template.fromStack(stack)
  expect(template.toJSON()).toMatchSnapshot()
})
```

### When to Use Snapshots

**✅ Good for:**
- Detecting unintended changes to infrastructure
- Documenting current state of stack
- Catching breaking changes in dependencies

**❌ Not good for:**
- First line of testing (too coarse-grained)
- Testing specific properties (use assertions instead)
- Rapidly changing infrastructure (snapshots become outdated)

### Updating Snapshots

```bash
# Update all snapshots
npm test -- -u

# Update specific snapshot
npm test -- MyStack.test.ts -u
```

---

## Validation Functions

### Input Validation

```typescript
// ✅ Fail fast with descriptive errors
export function validateFargateConfig(cpu: number, memory: number): void {
  const FARGATE_MEMORY: Record<number, number[]> = {
    256: [512, 1024, 2048],
    512: [1024, 2048, 3072, 4096],
    1024: [2048, 3072, 4096, 5120, 6144, 7168, 8192],
    // ... more configurations
  }

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

### Custom Validation in Constructs

```typescript
export interface ServiceProps {
  readonly minCapacity: number
  readonly maxCapacity: number
}

export class ServiceConstruct extends Construct {
  constructor(scope: Construct, id: string, props: ServiceProps) {
    super(scope, id)

    // Validate props before creating resources
    this.validateProps(props)

    // ... create resources
  }

  private validateProps(props: ServiceProps): void {
    if (props.minCapacity > props.maxCapacity) {
      throw new Error(
        `minCapacity (${props.minCapacity}) cannot exceed maxCapacity (${props.maxCapacity})`
      )
    }

    if (props.minCapacity < 1) {
      throw new Error('minCapacity must be at least 1')
    }
  }
}
```

### Environment Validation

```typescript
export function validateEnvironment(envName: string): void {
  const validEnvironments = ['dev', 'staging', 'prod']

  if (!validEnvironments.includes(envName)) {
    throw new Error(
      `Invalid environment: "${envName}". ` +
        `Valid options: ${validEnvironments.join(', ')}`
    )
  }
}
```

---

## Integration Testing

### Testing with Deployed Stacks

```typescript
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation'

describe('Deployed Stack', () => {
  it('stack exists in AWS', async () => {
    const client = new CloudFormationClient({ region: 'us-east-1' })

    const response = await client.send(
      new DescribeStacksCommand({ StackName: 'MyStack' })
    )

    expect(response.Stacks).toHaveLength(1)
    expect(response.Stacks?.[0].StackStatus).toBe('CREATE_COMPLETE')
  })
})
```

### Testing Stack Outputs

```typescript
it('exports required outputs', () => {
  const template = Template.fromStack(stack)

  template.hasOutput('BucketName', {
    Value: Match.anyValue(),
  })

  template.hasOutput('ApiEndpoint', {
    Value: Match.stringLikeRegexp('https://.*'),
  })
})
```

---

## CDK Nag Integration

### Running CDK Nag in Tests

```typescript
import { Annotations, Match } from 'aws-cdk-lib/assertions'
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib'

describe('Security Compliance', () => {
  it('passes CDK Nag checks', () => {
    const app = new App()
    const stack = new MyStack(app, 'TestStack')

    // Apply CDK Nag
    Aspects.of(stack).add(new AwsSolutionsChecks({ verbose: true }))

    // Synthesize to trigger checks
    app.synth()

    // Assert no errors
    const errors = Annotations.fromStack(stack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*')
    )

    expect(errors).toHaveLength(0)
  })
})
```

---

## Pre-Deployment Validation

### Checklist Before Deployment

```typescript
// pre-deploy-validation.ts
export function validateBeforeDeployment(stack: Stack): void {
  const template = Template.fromStack(stack)

  // 1. Check for unencrypted S3 buckets
  const buckets = template.findResources('AWS::S3::Bucket')
  Object.entries(buckets).forEach(([id, resource]) => {
    if (!resource.Properties?.BucketEncryption) {
      throw new Error(`Bucket ${id} is not encrypted`)
    }
  })

  // 2. Check for overly permissive IAM policies
  const policies = template.findResources('AWS::IAM::Policy')
  Object.entries(policies).forEach(([id, resource]) => {
    const statements = resource.Properties?.PolicyDocument?.Statement || []
    statements.forEach((stmt: any) => {
      if (stmt.Resource === '*' && stmt.Effect === 'Allow') {
        console.warn(`⚠️  Policy ${id} has wildcard resource`)
      }
    })
  })

  // 3. Check for public accessibility
  const bucketPolicies = template.findResources('AWS::S3::BucketPolicy')
  Object.entries(bucketPolicies).forEach(([id, resource]) => {
    const statements = resource.Properties?.PolicyDocument?.Statement || []
    statements.forEach((stmt: any) => {
      if (stmt.Principal === '*') {
        console.warn(`⚠️  BucketPolicy ${id} allows public access`)
      }
    })
  })
}
```

---

## Best Practices

✅ **Do:**
- Write unit tests for custom constructs
- Use specific assertions over snapshots
- Validate props in construct constructors
- Run CDK Nag in CI/CD pipeline
- Test with actual account/region values
- Use descriptive error messages

❌ **Don't:**
- Rely solely on snapshot tests
- Skip validation for user inputs
- Test implementation details
- Ignore CDK Nag warnings
- Hard-code test values that should be dynamic

---

## Related Documentation

- **CDK Assertions**: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions-readme.html
- **CDK Nag**: https://github.com/cdklabs/cdk-nag
- **Security Practices**: `docs/security-practices.md`
- **CloudFormation Safety**: `docs/cloudformation-safety.md`
