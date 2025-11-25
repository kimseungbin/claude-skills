# Construct Patterns

Best practices for designing and organizing CDK constructs.

## Construct Design Principles

### Single Responsibility

Each construct should have one clear purpose.

```typescript
// ❌ Bad: God construct doing everything
export class Service extends Construct {
  constructor() {
    // Creates: ECR, ECS, ALB, CloudFront, CodeBuild, Auto-scaling, etc.
    // Problem: Too many responsibilities, hard to test, difficult to modify
  }
}

// ✅ Good: Focused constructs
export class ComputeService extends Construct {  // ECS/Fargate only
  constructor(scope: Construct, id: string, props: ComputeProps) {
    super(scope, id)
    // Creates: Task Definition, Service, Auto-scaling
  }
}

export class NetworkService extends Construct {  // ALB/Target Groups
  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id)
    // Creates: ALB, Target Groups, Listeners
  }
}

export class BuildService extends Construct {    // CodeBuild
  constructor(scope: Construct, id: string, props: BuildProps) {
    super(scope, id)
    // Creates: CodeBuild Project, IAM Roles
  }
}

export class DistributionService extends Construct { // CloudFront
  constructor(scope: Construct, id: string, props: DistributionProps) {
    super(scope, id)
    // Creates: CloudFront Distribution, Origin, Behaviors
  }
}
```

**Benefits:**
- Easier to test each component
- Simpler to modify without side effects
- Clear boundaries and responsibilities
- Reusable across different stacks

### Composition over Inheritance

Build complex systems by composing simple constructs.

```typescript
// ✅ Compose multiple focused constructs
export class ServiceOrchestrator extends Construct {
  public readonly service: ComputeService
  public readonly loadBalancer: NetworkService
  public readonly distribution: DistributionService

  constructor(scope: Construct, id: string, props: OrchestratorProps) {
    super(scope, id)

    // Compose focused constructs
    this.service = new ComputeService(this, 'Compute', {
      vpc: props.vpc,
      cluster: props.cluster,
      cpu: props.cpu,
      memory: props.memory,
    })

    this.loadBalancer = new NetworkService(this, 'Network', {
      vpc: props.vpc,
      targets: [this.service.service],
    })

    this.distribution = new DistributionService(this, 'Distribution', {
      origin: this.loadBalancer.loadBalancer,
      certificateArn: props.certificateArn,
    })
  }
}
```

**Why composition:**
- Avoids deep inheritance hierarchies
- More flexible - can swap implementations
- Easier to understand flow
- Natural dependency management

---

## Props Pattern

Define clear, type-safe props interfaces for constructs.

### Basic Props Interface

```typescript
// ✅ Define clear prop interfaces
export interface ServiceProps {
  // Required props (no defaults)
  readonly vpc: IVpc
  readonly cluster: ICluster

  // Optional props with defaults
  readonly cpu?: number // Default: 256
  readonly memory?: number // Default: 512
  readonly desiredCount?: number // Default: 1

  // Optional advanced config
  readonly autoScaling?: {
    minCapacity: number
    maxCapacity: number
    targetCpuPercent: number
  }
}

export class Service extends Construct {
  constructor(scope: Construct, id: string, props: ServiceProps) {
    super(scope, id)

    // Apply defaults
    const cpu = props.cpu ?? 256
    const memory = props.memory ?? 512
    const desiredCount = props.desiredCount ?? 1

    // Use props
    const taskDef = new TaskDefinition(this, 'TaskDef', {
      cpu: cpu.toString(),
      memoryMiB: memory.toString(),
    })
  }
}
```

### Props with Validation

```typescript
export interface ScalingProps {
  readonly minCapacity: number
  readonly maxCapacity: number
  readonly targetCpuPercent: number
}

export class AutoScalingService extends Construct {
  constructor(scope: Construct, id: string, props: ScalingProps) {
    super(scope, id)

    // Validate props
    if (props.minCapacity > props.maxCapacity) {
      throw new Error('minCapacity cannot exceed maxCapacity')
    }

    if (props.targetCpuPercent < 1 || props.targetCpuPercent > 100) {
      throw new Error('targetCpuPercent must be between 1 and 100')
    }

    // Construct implementation
  }
}
```

### Shared vs Construct-Specific Props

```typescript
// Shared resources passed as props
export interface ServiceProps {
  // ✅ Pass shared infrastructure
  readonly vpc: IVpc
  readonly cluster: ICluster
  readonly securityGroup: ISecurityGroup

  // ✅ Service-specific config
  readonly serviceName: string
  readonly containerImage: ContainerImage
  readonly environment: { [key: string]: string }
}

// ❌ Don't create shared resources inside constructs
export class BadService extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    // ❌ Bad: Creating VPC inside service construct
    const vpc = new Vpc(this, 'VPC')  // Should be passed as prop!
  }
}
```

---

## Factory Pattern

Use factories for creating multiple similar constructs.

### Basic Factory

```typescript
// ✅ Use factories for repeated instantiation
export class ServiceFactory {
  constructor(
    private readonly scope: Construct,
    private readonly sharedResources: SharedResources
  ) {}

  createService(serviceName: ServiceName): Service {
    const config = this.getServiceConfig(serviceName)

    return new Service(this.scope, serviceName, {
      vpc: this.sharedResources.vpc,
      cluster: this.sharedResources.cluster,
      serviceName,
      cpu: config.cpu,
      memory: config.memory,
      desiredCount: config.desiredCount,
    })
  }

  private getServiceConfig(name: ServiceName): ServiceConfig {
    // Load from config service or data structure
    return configService.getServiceConfig(name)
  }
}

// Usage in stack
const factory = new ServiceFactory(this, sharedResources)
const services = [ServiceName.AUTH, ServiceName.API, ServiceName.WEB]
services.forEach(name => factory.createService(name))
```

### Factory with Dependency Injection

```typescript
export interface FactoryDependencies {
  readonly vpc: IVpc
  readonly cluster: ICluster
  readonly certificateArn: string
  readonly configService: ConfigService
}

export class MicroserviceFactory {
  constructor(
    private readonly scope: Construct,
    private readonly deps: FactoryDependencies
  ) {}

  createMicroservice(name: string): MicroserviceConstruct {
    const config = this.deps.configService.getConfig(name)

    return new MicroserviceConstruct(this.scope, name, {
      ...this.deps,
      ...config,
    })
  }
}
```

---

## Lambda Patterns

**See dedicated guide:** [`lambda-patterns.md`](./lambda-patterns.md)

Comprehensive Lambda best practices including:
- NodejsFunction with TypeScript source (not pre-compiled JS)
- Lambda workspace structure for monorepos
- .gitignore patterns for CDK auto-bundling
- Common anti-patterns and solutions
- Build-free deployment workflow

**Quick reference:**
- ✅ DO: Point `entry` to `.ts` files, let CDK bundle with esbuild
- ❌ DON'T: Commit `dist/` directories or pre-compile Lambda code
- ✅ DO: Mark AWS SDK as external: `externalModules: ['@aws-sdk/*']`

---

## Additional Patterns

### Builder Pattern

For complex constructs with many optional configurations:

```typescript
export class ServiceBuilder {
  private props: Partial<ServiceProps> = {}

  withVpc(vpc: IVpc): this {
    this.props.vpc = vpc
    return this
  }

  withCluster(cluster: ICluster): this {
    this.props.cluster = cluster
    return this
  }

  withAutoScaling(min: number, max: number): this {
    this.props.autoScaling = { minCapacity: min, maxCapacity: max }
    return this
  }

  build(scope: Construct, id: string): Service {
    if (!this.props.vpc || !this.props.cluster) {
      throw new Error('VPC and Cluster are required')
    }
    return new Service(scope, id, this.props as ServiceProps)
  }
}

// Usage
const service = new ServiceBuilder()
  .withVpc(vpc)
  .withCluster(cluster)
  .withAutoScaling(1, 10)
  .build(this, 'MyService')
```

### Provider Pattern

For sharing context across nested constructs:

```typescript
export class InfraContext {
  constructor(
    public readonly vpc: IVpc,
    public readonly cluster: ICluster,
    public readonly environment: Environment
  ) {}

  static of(scope: Construct): InfraContext {
    const ctx = scope.node.tryGetContext('infraContext')
    if (!ctx) {
      throw new Error('InfraContext not found in construct tree')
    }
    return ctx
  }
}

// Set context at stack level
export class MainStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const context = new InfraContext(vpc, cluster, Environment.PROD)
    this.node.setContext('infraContext', context)

    // Child constructs can access context
    new ServiceConstruct(this, 'Service')
  }
}

// Access in nested construct
export class ServiceConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const ctx = InfraContext.of(this)
    // Use ctx.vpc, ctx.cluster, etc.
  }
}
```

---

## Best Practices

✅ **Do:**
- Keep constructs focused and single-purpose
- Use composition over inheritance
- Define clear prop interfaces with readonly properties
- Validate props in constructor
- Pass shared resources as props, don't create them internally
- Use factories for creating multiple similar resources
- Export public resources for cross-construct wiring

❌ **Don't:**
- Create "god constructs" that do everything
- Use deep inheritance hierarchies
- Create shared resources inside constructs
- Hardcode values that should be props
- Mutate props after construct creation

