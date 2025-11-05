---
name: NestJS Patterns
description: |
    Use when working with NestJS applications implementing repository pattern,
    dependency injection, testing strategies, or ESM configuration.
    Covers abstract classes vs interfaces, async repository methods, and test setup patterns.
---

# NestJS Patterns

Best practices and patterns for NestJS applications with repository pattern, dependency injection, and comprehensive testing strategies.

## When to Use This Skill

- Implementing repository pattern with abstract classes
- Setting up dependency injection with custom providers
- Configuring NestJS with ES modules (ESM)
- Writing unit/integration tests for services and repositories
- Choosing between abstract classes and interfaces for DI
- Designing for future database migrations (in-memory → Redis/PostgreSQL)

## Core Patterns

### 1. Repository Pattern with Abstract Classes

**Why Abstract Classes (not Interfaces)?**

- ✅ NestJS DI works better with abstract classes (can inject directly)
- ✅ Can provide default implementations for common methods in future
- ✅ Better for inheritance hierarchies
- ✅ Runtime checking (interfaces are compile-time only)

**Structure:**

```
src/
├── context/
│   ├── types/
│   │   └── context.types.ts              # ChannelFact, ContextAllocation types
│   ├── repositories/
│   │   ├── channel-fact.repository.ts    # Abstract base class
│   │   ├── in-memory-channel.repository.ts
│   │   └── redis-channel.repository.ts   # Future implementation
│   ├── channel-memory.service.ts         # Business logic using repository
│   ├── context-manager.service.ts        # Orchestration layer
│   └── context.module.ts                 # DI configuration
```

**Abstract Repository Pattern:**

```typescript
// channel-fact.repository.ts
export abstract class ChannelFactRepository {
    abstract getFacts(channelId: string): Promise<ChannelFact[]>
    abstract addFact(channelId: string, fact: ChannelFact): Promise<void>
    abstract updateFact(channelId: string, factContent: string, updates: Partial<ChannelFact>): Promise<void>
    abstract deleteFact(channelId: string, factContent: string): Promise<void>
    abstract clear(channelId: string): Promise<void>
    abstract getChannelCount(): Promise<number>
    abstract getTotalFactCount(): Promise<number>
}
```

**Concrete Implementation:**

```typescript
// in-memory-channel.repository.ts
@Injectable()
export class InMemoryChannelRepository extends ChannelFactRepository {
    private readonly logger = new Logger(InMemoryChannelRepository.name)
    private readonly memoryStore = new Map<string, ChannelFact[]>()

    async getFacts(channelId: string): Promise<ChannelFact[]> {
        return this.memoryStore.get(channelId) ?? []
    }

    async addFact(channelId: string, fact: ChannelFact): Promise<void> {
        const facts = this.memoryStore.get(channelId) ?? []
        facts.push(fact)
        this.memoryStore.set(channelId, facts)

        this.logger.log(`Added fact to channel ${channelId}`)
    }

    // ... other methods
}
```

**Service Layer Using Repository:**

```typescript
// channel-memory.service.ts
@Injectable()
export class ChannelMemoryService {
    constructor(private readonly repository: ChannelFactRepository) {}

    async getFacts(channelId: string): Promise<ChannelFact[]> {
        const facts = await this.repository.getFacts(channelId)
        // Business logic: Sort by most recent
        return facts.sort((a, b) => b.lastConfirmed.getTime() - a.lastConfirmed.getTime())
    }

    async addFact(channelId: string, fact: ChannelFact): Promise<void> {
        // Business logic: Validate before adding
        await this.repository.addFact(channelId, fact)
        this.logger.log(`Added fact: "${fact.fact.substring(0, 50)}..."`)
    }
}
```

### 2. Dependency Injection Configuration

**Module Setup:**

```typescript
// context.module.ts
@Module({
    providers: [
        {
            provide: ChannelFactRepository,
            useClass: InMemoryChannelRepository, // ← Swap to RedisChannelRepository later
        },
        ChannelMemoryService,
        ContextManagerService,
    ],
    exports: [ContextManagerService, ChannelMemoryService],
})
export class ContextModule {}
```

**Why This Pattern?**

- One-line change to swap implementations (in-memory → Redis)
- Services depend on abstract class, not concrete implementation
- Easy to mock in tests
- Clear separation: module knows implementation, services don't

**Migration Example:**

```typescript
// Before (development)
{
    provide: ChannelFactRepository,
    useClass: InMemoryChannelRepository,
}

// After (production) - ONE LINE CHANGE
{
    provide: ChannelFactRepository,
    useClass: RedisChannelRepository,
}
```

### 3. Async Repository Methods

**Rule: All repository methods MUST be async, even for in-memory implementations**

**Why?**

- ✅ Future-proof: Redis/PostgreSQL operations are async
- ✅ No breaking changes when migrating storage backends
- ✅ Consistent API across all implementations
- ✅ Enables future optimizations (batching, caching)

**Trade-offs:**

- ⚠️ Slight overhead for in-memory (wrapping synchronous operations in Promises)
- ⚠️ Must use `await` everywhere

**Example:**

```typescript
// ✅ Correct: Async even for in-memory
async getFacts(channelId: string): Promise<ChannelFact[]> {
    return this.memoryStore.get(channelId) ?? []
}

// ❌ Wrong: Synchronous
getFacts(channelId: string): ChannelFact[] {
    return this.memoryStore.get(channelId) ?? []
}
```

### 4. Configuration Management

**Pattern: Export Constants for Test Imports**

**Problem:** Tests need configuration values but ConfigService requires environment variables.

**Solution:** Export configuration constants separately from ConfigService.

```typescript
// config.service.ts
export const DEFAULT_CONTEXT_LIMITS: ContextLimitsConfig = {
    softContextLimit: 150000,
    allocation: {
        threadContextRatio: 0.7,
        channelContextRatio: 0.3,
    },
    truncation: {
        keepRecentThreadMessages: 50,
        keepRecentChannelFacts: 20,
    },
}

@Injectable()
export class ConfigService {
    getBedrockConfig() {
        return {
            contextLimits: DEFAULT_CONTEXT_LIMITS,
            // ... other config
        }
    }
}
```

**Test Usage:**

```typescript
// context-manager.service.test.ts
import { DEFAULT_CONTEXT_LIMITS } from '../config/config.service.js'

const mockConfigService = {
    getBedrockConfig: () => ({
        contextLimits: DEFAULT_CONTEXT_LIMITS, // ← Import from source
    }),
}
```

**Anti-pattern: Duplication**

```typescript
// ❌ Wrong: Duplicate configuration
export interface AppConfig {
    bedrock: {
        softContextLimit: 150000,  // Duplicate!
        contextLimits: {
            softContextLimit: 150000,  // Duplicate!
        }
    }
}

// ✅ Correct: Single source of truth
export interface AppConfig {
    bedrock: {
        contextLimits: ContextLimitsConfig  // Only location
    }
}

export const DEFAULT_CONTEXT_LIMITS: ContextLimitsConfig = {
    softContextLimit: 150000,  // ✅ Single source
}
```

### 5. Testing Strategies

#### Repository Tests (Unit)

**Focus: Data operations, storage constraints**

```typescript
// in-memory-channel.repository.spec.ts
describe('InMemoryChannelRepository', () => {
    let repository: InMemoryChannelRepository

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [InMemoryChannelRepository],
        }).compile()

        repository = module.get<InMemoryChannelRepository>(InMemoryChannelRepository)
    })

    it('should store and retrieve a single fact', async () => {
        const fact: ChannelFact = {
            fact: 'Team standup is at 10am',
            confidence: 0.9,
            channels: ['C123'],
            firstChannel: 'C123',
            visibility: 'channel',
            lastConfirmed: new Date('2025-01-01'),
        }

        await repository.addFact('C123', fact)
        const facts = await repository.getFacts('C123')

        expect(facts).toHaveLength(1)
        expect(facts[0]).toEqual(fact)
    })

    it('should enforce LRU eviction (50 facts max per channel)', async () => {
        // Add 51 facts to trigger eviction
        for (let i = 0; i < 51; i++) {
            await repository.addFact('C123', {
                fact: `Fact ${i}`,
                confidence: 0.9,
                channels: ['C123'],
                firstChannel: 'C123',
                visibility: 'channel',
                lastConfirmed: new Date(2025, 0, i + 1),
            })
        }

        const facts = await repository.getFacts('C123')
        expect(facts).toHaveLength(50)

        // Should evict oldest (Fact 0)
        const factContents = facts.map(f => f.fact)
        expect(factContents).not.toContain('Fact 0')
        expect(factContents).toContain('Fact 50')
    })
})
```

#### Service Tests (Unit with Mocked Repository)

**Focus: Business logic, repository interaction**

```typescript
// channel-memory.service.spec.ts
describe('ChannelMemoryService', () => {
    let service: ChannelMemoryService
    let mockRepository: jest.Mocked<ChannelFactRepository>

    beforeEach(async () => {
        mockRepository = {
            getFacts: jest.fn(),
            addFact: jest.fn(),
            updateFact: jest.fn(),
            deleteFact: jest.fn(),
            clear: jest.fn(),
            getChannelCount: jest.fn(),
            getTotalFactCount: jest.fn(),
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChannelMemoryService,
                {
                    provide: ChannelFactRepository,
                    useValue: mockRepository,
                },
            ],
        }).compile()

        service = module.get<ChannelMemoryService>(ChannelMemoryService)
    })

    it('should delegate to repository for data operations', async () => {
        const facts: ChannelFact[] = [
            { fact: 'Test', confidence: 0.9, /* ... */ },
        ]
        mockRepository.getFacts.mockResolvedValue(facts)

        const result = await service.getFacts('C123')

        expect(mockRepository.getFacts).toHaveBeenCalledWith('C123')
        expect(result).toEqual(facts)
    })
})
```

#### Service Tests with Real ConfigService

**Pattern: Mock ConfigService to Avoid Environment Variables**

```typescript
// context-manager.service.test.ts
import { DEFAULT_CONTEXT_LIMITS } from '../config/config.service.js'

describe('ContextManagerService', () => {
    let service: ContextManagerService
    let configService: ConfigService

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContextManagerService,
                {
                    provide: ConfigService,
                    useValue: {
                        getBedrockConfig: () => ({
                            contextLimits: DEFAULT_CONTEXT_LIMITS,
                        }),
                    },
                },
            ],
        }).compile()

        service = module.get<ContextManagerService>(ContextManagerService)
        configService = module.get<ConfigService>(ConfigService)
    })

    it('should allocate 70% to thread and 30% to channel', () => {
        const config = configService.getBedrockConfig().contextLimits
        expect(config.allocation.threadContextRatio).toBe(0.7)
        expect(config.allocation.channelContextRatio).toBe(0.3)
    })
})
```

### 6. ESM Configuration for NestJS

**Required Configuration:**

**tsconfig.json:**

```json
{
    "compilerOptions": {
        "module": "ESNext",
        "moduleResolution": "node",
        "esModuleInterop": true,
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    }
}
```

**package.json:**

```json
{
    "type": "module",
    "scripts": {
        "start:dev": "nest start --watch"
    }
}
```

**Import Rules:**

```typescript
// ✅ Correct: Use .js extension even for .ts files
import { ChannelFactRepository } from './repositories/channel-fact.repository.js'

// ❌ Wrong: No extension
import { ChannelFactRepository } from './repositories/channel-fact.repository'

// ❌ Wrong: .ts extension
import { ChannelFactRepository } from './repositories/channel-fact.repository.ts'
```

**Why .js extension for .ts files?**

- ESM requires extensions in imports
- TypeScript compiler resolves .js → .ts during compilation
- NestJS with ESM needs this configuration

## Decision Trees

### Should LRU Eviction Live in Repository or Service?

```
Is eviction based on storage constraints (max size, TTL)?
├─ YES → Repository layer ✅
│  - Redis has native eviction (LTRIM, TTL)
│  - Each storage backend optimizes differently
│  - Service doesn't need to know storage limits
│
└─ NO → Service layer
   - Eviction based on business rules
   - Complex logic involving multiple entities
   - Need to notify users or log
```

**Examples:**

- LRU based on timestamps → Repository ✅
- "Never evict facts with confidence > 0.95" → Service
- "Evict oldest 50 items" → Repository ✅
- "Evict items user hasn't accessed in 7 days" → Service

### Abstract Class vs Interface for DI?

```
Need runtime injection with NestJS?
├─ YES → Abstract class ✅
│  - Can inject directly: constructor(private repo: ChannelFactRepository)
│  - No need for string tokens
│  - Better for future default implementations
│
└─ NO → Interface
   - Pure type checking only
   - No inheritance needed
   - Simple contracts
```

## Common Pitfalls

### 1. Forgetting .js Extensions

**Error:**

```
Error: Cannot find module './repositories/channel-fact.repository'
```

**Fix:**

```typescript
// Add .js extension
import { ChannelFactRepository } from './repositories/channel-fact.repository.js'
```

### 2. Config Duplication

**Problem:**

```typescript
// ❌ Same value in two places
export const DEFAULT_CONFIG = {
    softContextLimit: 150000,  // Duplicate 1
    contextLimits: {
        softContextLimit: 150000,  // Duplicate 2
    }
}
```

**Solution:**

```typescript
// ✅ Single source of truth
export const DEFAULT_CONTEXT_LIMITS = {
    softContextLimit: 150000,
}

export const DEFAULT_CONFIG = {
    contextLimits: DEFAULT_CONTEXT_LIMITS,  // Reference
}
```

### 3. Mixing Sync and Async Repository Methods

**Problem:**

```typescript
class InMemoryRepo extends ChannelFactRepository {
    getFacts(channelId: string): ChannelFact[] {  // ❌ Sync
        return this.memoryStore.get(channelId) ?? []
    }
}

class RedisRepo extends ChannelFactRepository {
    async getFacts(channelId: string): Promise<ChannelFact[]> {  // ✅ Async
        return await this.redis.get(channelId)
    }
}
```

**Breaking when switching implementations!**

**Solution: All async:**

```typescript
class InMemoryRepo extends ChannelFactRepository {
    async getFacts(channelId: string): Promise<ChannelFact[]> {  // ✅
        return this.memoryStore.get(channelId) ?? []
    }
}
```

### 4. Testing Without Mocking ConfigService

**Error:**

```
Error: SLACK_BOT_TOKEN environment variable is required
```

**Fix:**

```typescript
// ✅ Mock ConfigService
{
    provide: ConfigService,
    useValue: {
        getBedrockConfig: () => ({
            contextLimits: DEFAULT_CONTEXT_LIMITS,
        }),
    },
}
```

## TDD Workflow for Repository Pattern

1. **Write failing repository test** (data operation)
2. **Implement repository method** (pass test)
3. **Write failing service test** (business logic with mocked repository)
4. **Implement service method** (pass test)
5. **Write integration test** (service + real repository)
6. **Refactor** (DRY, optimize)

**Example cycle:**

```typescript
// Step 1: Repository test (it.todo → it)
it('should store and retrieve a single fact', async () => {
    await repository.addFact('C123', fact)
    const facts = await repository.getFacts('C123')
    expect(facts).toContain(fact)
})

// Step 2: Implement repository
async addFact(channelId: string, fact: ChannelFact): Promise<void> {
    const facts = this.memoryStore.get(channelId) ?? []
    facts.push(fact)
    this.memoryStore.set(channelId, facts)
}

// Step 3: Service test with mock
it('should delegate to repository', async () => {
    mockRepository.getFacts.mockResolvedValue([fact])
    const result = await service.getFacts('C123')
    expect(mockRepository.getFacts).toHaveBeenCalledWith('C123')
})

// Step 4: Implement service
async getFacts(channelId: string): Promise<ChannelFact[]> {
    return this.repository.getFacts(channelId)
}
```

## Migration Guide: In-Memory → Redis

**Step 1: Implement RedisChannelRepository**

```typescript
@Injectable()
export class RedisChannelRepository extends ChannelFactRepository {
    constructor(private readonly redis: Redis) {}

    async addFact(channelId: string, fact: ChannelFact): Promise<void> {
        const key = `channel_facts:${channelId}`
        await this.redis
            .multi()
            .lpush(key, JSON.stringify(fact))
            .ltrim(key, 0, 49)  // Keep 50 most recent
            .expire(key, 86400)  // 24h TTL
            .exec()
    }

    async getFacts(channelId: string): Promise<ChannelFact[]> {
        const key = `channel_facts:${channelId}`
        const values = await this.redis.lrange(key, 0, -1)
        return values.map(v => JSON.parse(v))
    }

    // ... implement other abstract methods
}
```

**Step 2: Update module (ONE LINE)**

```typescript
{
    provide: ChannelFactRepository,
    useClass: RedisChannelRepository,  // ← Only this changes!
}
```

**Step 3: No changes needed to:**

- ❌ ChannelMemoryService (uses abstract repository)
- ❌ ContextManagerService (doesn't know about storage)
- ❌ SlackService (uses service layer)
- ❌ Tests (can still mock ChannelFactRepository)

**That's it! Repository pattern enables zero-downtime migration.**

## Key Takeaways

1. **Abstract classes > Interfaces** for NestJS dependency injection
2. **All repository methods async** even for in-memory (future-proof)
3. **Export config constants** for test imports (avoid env var requirements)
4. **Single source of truth** for configuration values (no duplication)
5. **ESM requires .js extensions** even for .ts imports
6. **Mock ConfigService in tests** to avoid environment variable errors
7. **Repository = data, Service = business logic** - clear separation
8. **One-line module change** to swap repository implementations

## Reference

- See `docs/REPOSITORY-PATTERN.md` in projects using this pattern for detailed architecture decisions
- Example implementation: chatbot monorepo (packages/backend/src/context/)
