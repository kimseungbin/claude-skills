# Security Best Practices

AWS CDK security guidance for IAM, secrets management, and compliance.

## IAM Policies

### Principle of Least Privilege

**❌ Avoid wildcards:**
```typescript
// Bad: Overly permissive
new PolicyStatement({
  actions: ['s3:*'],
  resources: ['*'],
})
```

**✅ Specific actions and resources:**
```typescript
// Good: Principle of least privilege
new PolicyStatement({
  actions: ['s3:GetObject', 's3:PutObject'],
  resources: [`arn:aws:s3:::${bucketName}/*`],
})
```

### IAM Role Best Practices

```typescript
// ✅ Create roles with specific trust policies
const role = new Role(this, 'LambdaRole', {
  assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
  description: 'Role for Lambda function to access S3',
})

// Add only required permissions
role.addToPolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['s3:GetObject'],
  resources: [`${bucket.bucketArn}/*`],
}))
```

---

## Secrets Management

### Never Hardcode Secrets

**❌ Hardcoded secrets:**
```typescript
// Bad: Secret in code
const apiKey = 'random-value-1234567890'
const dbPassword = 'supersecret123'
```

### Use AWS Secrets Manager

**✅ Reference secrets:**
```typescript
// Good: Reference from Secrets Manager
const secret = Secret.fromSecretNameV2(this, 'APIKey', 'my-api-key')

// In Lambda environment
lambdaFn.addEnvironment('API_KEY', secret.secretValue.unsafeUnwrap())

// In ECS task definition
container.addSecret('API_KEY', ecs.Secret.fromSecretsManager(secret))
```

### Use SSM Parameter Store

```typescript
// For non-secret configuration
const parameter = StringParameter.fromStringParameterName(
  this, 'Config',
  '/myapp/config'
)

lambdaFn.addEnvironment('CONFIG', parameter.stringValue)
```

---

## CDK Nag Integration

### Enable Security Checks

```typescript
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag'

const app = new App()
const stack = new MyStack(app, 'MyStack')

// Apply CDK Nag security checks
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
```

### Suppress Specific Rules (with Justification)

```typescript
// Suppress with documented reason
NagSuppressions.addResourceSuppressions(
  myConstruct,
  [
    {
      id: 'AwsSolutions-IAM4',
      reason: 'Using AWS managed policy for Lambda basic execution role',
    },
  ],
  true  // Apply to children
)
```

### Use CDK MCP Server for Rule Explanations

```typescript
// If you see: AwsSolutions-IAM4: The IAM user, role, or group uses AWS managed policies
// Use MCP tool: mcp__cdk-mcp-server__ExplainCDKNagRule
// with rule_id: "AwsSolutions-IAM4"
```

---

## Encryption

### S3 Bucket Encryption

```typescript
// ✅ Always enable encryption
new Bucket(this, 'Bucket', {
  encryption: BucketEncryption.S3_MANAGED,  // or KMS_MANAGED
  enforceSSL: true,  // Require HTTPS
})
```

### DynamoDB Encryption

```typescript
// ✅ Enable encryption at rest
new Table(this, 'Table', {
  encryption: TableEncryption.AWS_MANAGED,  // or CUSTOMER_MANAGED
})
```

### RDS Encryption

```typescript
// ✅ Enable storage encryption
new DatabaseInstance(this, 'Database', {
  storageEncrypted: true,
  deletionProtection: true,  // Prevent accidental deletion
})
```

---

## Network Security

### VPC Configuration

```typescript
// ✅ Isolate resources in private subnets
const vpc = new Vpc(this, 'VPC', {
  maxAzs: 2,
  natGateways: 1,
  subnetConfiguration: [
    {
      name: 'Public',
      subnetType: SubnetType.PUBLIC,
    },
    {
      name: 'Private',
      subnetType: SubnetType.PRIVATE_WITH_EGRESS,
    },
    {
      name: 'Isolated',
      subnetType: SubnetType.PRIVATE_ISOLATED,  // No internet access
    },
  ],
})
```

### Security Groups

```typescript
// ✅ Restrict ingress rules
const sg = new SecurityGroup(this, 'SG', {
  vpc,
  description: 'Allow HTTPS from ALB only',
  allowAllOutbound: false,  // Restrict egress too
})

// Specific ingress rule
sg.addIngressRule(
  albSecurityGroup,  // Source: ALB security group
  Port.tcp(443),
  'Allow HTTPS from ALB'
)

// Specific egress rule
sg.addEgressRule(
  Peer.ipv4('10.0.0.0/16'),  // Destination: VPC CIDR
  Port.tcp(443),
  'Allow HTTPS to internal services'
)
```

---

## Best Practices Checklist

✅ **IAM:**
- Use principle of least privilege
- Avoid wildcard permissions (*:*)
- Create service-specific roles
- Use managed policies sparingly
- Document IAM policy intent

✅ **Secrets:**
- Never hardcode secrets in code
- Use Secrets Manager for sensitive data
- Use SSM Parameter Store for configuration
- Rotate secrets regularly
- Enable automatic rotation where possible

✅ **Encryption:**
- Enable encryption at rest for all storage
- Require SSL/TLS for data in transit
- Use customer-managed KMS keys for sensitive data
- Enable CloudTrail for KMS key usage

✅ **Network:**
- Deploy resources in private subnets
- Use security groups (not NACLs as primary control)
- Restrict ingress/egress rules
- Enable VPC Flow Logs
- Use AWS PrivateLink for AWS service access

✅ **Monitoring:**
- Enable CloudTrail for API auditing
- Enable AWS Config for compliance
- Set up CloudWatch alarms for security events
- Use GuardDuty for threat detection

