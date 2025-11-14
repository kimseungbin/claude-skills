---
implementation: cdk-infrastructure
project_types:
  - AWS CDK
  - Infrastructure as Code
  - CloudFormation
  - Terraform (adaptable)
---

# CDK Infrastructure Documentation Guide

This guide provides CDK-specific patterns for maintaining documentation when working with Infrastructure as Code projects.

## Infrastructure Categories

CDK/IaC projects typically have these distinct categories of changes:

### 1. IaC Code Structure
**Definition:** How your IaC code is organized (constructs, stacks, modules, files, directories).

**Examples:**
- Adding new CDK construct to `lib/constructs/`
- Reorganizing directory structure
- Creating new stack files
- Splitting monolithic stack into smaller stacks
- Moving resources between constructs

**CLAUDE.md Sections to Update:**
- Architecture diagram (stack composition)
- Key Directories section
- Constructs/modules listing
- Stack hierarchy description

**README.md Updates:**
- Project structure overview (if major reorganization)

### 2. Service Infrastructure (or Application Infrastructure)
**Definition:** The actual services/applications being deployed and their AWS resources.

**Examples:**
- Adding new microservice (e.g., auth, api, frontend)
- Removing deprecated service
- Changing service resources (ECS→Lambda, ALB→API Gateway)
- Modifying service architecture pattern
- Adding AWS resources (RDS, S3, CloudFront, SQS)

**CLAUDE.md Sections to Update:**
- Services Managed table/list
- Architecture Overview diagram
- Important Implementation Details (if resource types change)
- Service-specific configuration paths

**README.md Updates:**
- Managed services list
- Architecture overview (if visual diagram exists)
- Technology stack (if resource types change)

**docs/ to Create/Update:**
- Service-specific architecture guides
- Service deployment procedures
- Service interaction diagrams

### 3. CDK Pipeline Infrastructure (or Deployment Infrastructure)
**Definition:** The CI/CD pipeline that deploys the IaC itself (not the application pipelines).

**Examples:**
- Modifying CDK Pipeline stages/actions
- Changing synth/deploy process
- Adding manual approval stages
- Modifying cross-account deployment setup
- Changing build/test steps in pipeline
- Adding/removing environments

**CLAUDE.md Sections to Update:**
- Deployment Flow section
- CI/CD configuration paths (`.github/workflows`, `buildspec.yml`)
- Environment list
- Cross-account deployment patterns
- Bootstrap/setup procedures

**README.md Updates:**
- Deployment process overview
- Environment list
- Quick start deployment instructions

**docs/ to Create/Update:**
- Detailed deployment guide
- Environment setup procedures
- Rollback procedures
- Pipeline architecture diagrams

### 4. Deployment Safety Mechanisms
**Definition:** Infrastructure that prevents dangerous deployments, detects resource replacements, and requires manual approval.

**Examples:**
- Git pre-push hooks (running `cdk diff` before deployment)
- Deployment approval scripts (analyzing CloudFormation changes)
- Resource replacement detection logic
- Deployment footer validation (commit-msg hooks)
- CloudFormation logical ID preservation strategies
- Manual deletion procedures for fixed-name resources

**CLAUDE.md Sections to Update:**
- Git Workflow & Version Control → Pre-Push Hook Integration
- Important Patterns and Conventions → Resource Naming
- Deployment Considerations

**README.md Updates:**
- Development workflow setup (git hooks installation)
- Quick start prerequisites (git hooks setup)

**docs/ to Create/Update:**
- `docs/GIT_HOOKS_SETUP.md` - Complete git hooks setup guide
- `docs/DEPLOYMENT_APPROVAL_WORKFLOW.md` - How to handle blocked deployments
- `docs/RESOURCE_NAMING_FIXED_VS_AUTO.md` - Fixed vs auto-generated naming
- `docs/REFACTORING_STRATEGY_FIXED_NAMES.md` - Safe refactoring patterns
- `docs/CDK_DIFF_EXPLAINED.md` - Understanding cdk diff output
- `scripts/analyze-and-approve-deployment.sh` - Deployment analysis script
- `scripts/setup-git-hooks.sh` - Git hooks installation script
- `.githooks/pre-push` - Pre-push hook implementation

**Skill Updates to Create/Update:**
- `.claude/config/git-strategy.md` - Add "Pre-Push Hook Integration" section
- `.claude/skills/conventional-commits/` - Add deployment footer documentation
- `.claude/skills/cdk-expert/docs/cloudformation-safety.md` - Add pre-push hook workflow

**When this category applies:**
- Implementing git hooks for deployment safety
- Adding deployment approval mechanisms
- Creating scripts for analyzing CloudFormation changes
- Updating resource naming to prevent replacements
- Adding footer validation to commits
- Implementing manual deletion workflows

### 5. Patterns and Conventions
**Definition:** Coding patterns, naming conventions, validation rules, and development workflows.

**Examples:**
- Resource naming conventions
- Tagging strategies
- Stack naming patterns
- Validation logic (e.g., CPU/memory validators)
- Feature flag systems
- Code organization principles
- Security patterns (IAM, networking)

**CLAUDE.md Sections to Update:**
- Important Patterns and Conventions
- Development Workflow
- Code Organization Principles
- Best Practices sections

**README.md Updates:**
- Development guidelines link
- Contributing section

**docs/ to Create/Update:**
- Coding standards guide
- Architecture decision records (ADRs)
- Best practices documentation

### 6. CDK Construct Dependency Patterns
**Definition:** How dependencies are passed between CDK constructs (ConfigService, shared resources, etc.)

**Common Anti-Patterns:**

**❌ Using setContext for application dependencies:**
```typescript
// ANTI-PATTERN: Loses type safety
this.node.setContext('configService', configService)
const config = scope.node.tryGetContext('configService') // Returns 'any'
```

**Problems:**
- Loses TypeScript type safety (returns `any`)
- Makes dependencies implicit and hard to track
- Causes runtime errors instead of compile-time errors
- Difficult to refactor and test
- No IDE autocomplete support

**✅ Recommended: Explicit Props Injection:**
```typescript
// PREFERRED: Type-safe, explicit
export interface MyConstructProps {
  readonly configService: ConfigService  // Explicit in interface
}

new MyConstruct(this, 'MyConstruct', {
  configService  // TypeScript validates this exists
})
```

**Benefits:**
- Type safety: Compile-time validation
- Explicit contract: Props document dependencies
- Easy refactoring: "Find References" works
- Better testing: Easy to mock
- IDE support: Autocomplete and type hints

**When setContext IS appropriate:**
- CDK-internal values only (e.g., availability zones, CDK version flags)
- AWS account/region info provided by CDK
- **Rule of thumb:** If you created it, pass it via props. If CDK created it, setContext is okay.

**CLAUDE.md Sections to Update:**
- Important Patterns and Conventions → Configuration Service Pattern
- Code Organization Principles

**README.md Updates:**
- None (internal implementation detail)

**docs/ to Create:**
- `docs/best-practices/TYPE_SAFE_DEPENDENCY_INJECTION.md`
  - Real-world example showing before/after
  - Migration strategy for existing setContext code
  - When to use each approach
  - Comparison table

**Example Reference:**
- fe-infra project: `docs/best-practices/TYPE_SAFE_DEPENDENCY_INJECTION.md`
- Real bug: Feature flags defaulted to DEV because setContext failed
- Fix: Explicit ConfigService props, feature flags work correctly

## Decision Tree

Use this decision tree to determine which documentation needs updating:

```
Code Change Made
│
├─ Changed file/directory structure?
│  ├─ YES → Update CLAUDE.md "Key Directories"
│  └─ NO → Continue
│
├─ Added/removed/modified service/application?
│  ├─ YES → Update CLAUDE.md "Services Managed"
│  │       Update CLAUDE.md "Architecture Overview"
│  │       Update README.md managed services list
│  └─ NO → Continue
│
├─ Changed AWS resource types for services?
│  ├─ YES → Update CLAUDE.md "Important Implementation Details"
│  │       Update README.md tech stack (if significant)
│  └─ NO → Continue
│
├─ Modified CDK Pipeline/deployment process?
│  ├─ YES → Update CLAUDE.md "Deployment Flow"
│  │       Update CLAUDE.md CI/CD paths
│  │       Update README.md deployment instructions
│  └─ NO → Continue
│
├─ Implemented deployment safety mechanisms?
│  ├─ YES → Update CLAUDE.md "Git Workflow & Version Control"
│  │       Add "Pre-Push Hook Integration" section
│  │       Update CLAUDE.md "Important Patterns and Conventions"
│  │       Update README.md development workflow setup
│  │       Create docs/GIT_HOOKS_SETUP.md
│  │       Create docs/DEPLOYMENT_APPROVAL_WORKFLOW.md
│  │       Create docs/RESOURCE_NAMING_FIXED_VS_AUTO.md (if relevant)
│  │       Create scripts/analyze-and-approve-deployment.sh
│  │       Create scripts/setup-git-hooks.sh
│  │       Create .githooks/pre-push
│  │       Update .claude/config/git-strategy.md (if exists)
│  │       Update .claude/skills/conventional-commits/ deployment footer docs
│  │       Update .claude/skills/cdk-expert/docs/cloudformation-safety.md
│  └─ NO → Continue
│
├─ Introduced new pattern/convention/workflow?
│  ├─ YES → Update CLAUDE.md "Important Patterns and Conventions"
│  │       Consider creating docs/PATTERN_NAME.md
│  │       Update README.md if affects onboarding
│  └─ NO → Continue
│
├─ Changed CDK construct dependency pattern?
│  ├─ YES → Update CLAUDE.md "Important Patterns and Conventions"
│  │       Update "Configuration Service Pattern" section
│  │       If anti-pattern identified:
│  │         → Document with ❌ marker in CLAUDE.md
│  │         → Create docs/best-practices/PATTERN_NAME.md
│  │         → Include real-world example (before/after)
│  │       If switching from setContext to props:
│  │         → Document migration strategy
│  │         → Add TODO comments in code
│  └─ NO → Continue
│
└─ Created comprehensive guide?
   ├─ YES → Create docs/GUIDE_NAME.md
   │       Add link to README.md documentation section
   │       Add to CLAUDE.md "Key Documentation Files" table
   └─ NO → Done
```

## Configuration Principle

**CRITICAL for CDK projects:** Do NOT document configuration values in CLAUDE.md.

### ❌ Wrong: Documenting Values

```markdown
## Services

- **auth**: 1024 CPU, 2048 memory, 4 tasks in production, 1 task in dev
- **api**: 512 CPU, 1024 memory, 2 tasks in production, 1 task in dev
```

**Problems:**
- Becomes stale immediately when config changes
- Duplicates information from config files
- Creates maintenance burden

### ✅ Correct: Documenting Paths

```markdown
## Services

Service configurations defined in `src/config/config.data.ts`.

For service-specific settings (CPU, memory, task counts), read configuration file directly.
```

**Benefits:**
- Single source of truth (config file)
- Self-documenting (Claude reads file when needed)
- No drift between docs and reality

### What to Document vs Not Document

| Document in CLAUDE.md | Do NOT Document |
|----------------------|-----------------|
| File paths | Configuration values |
| Configuration structure | CPU/memory settings |
| How to read config | Environment-specific values |
| Config file locations | Task counts, timeouts |
| Config schema/types | Feature flags state |

**Rationale:** Claude can read configuration files directly. Documenting paths enables this; documenting values creates duplication and drift.

## CLAUDE.md Section Mappings

Standard sections in CDK/IaC CLAUDE.md and when to update them:

### Architecture Overview
**Update when:**
- Stack composition changes
- Service/application added/removed
- Major architectural shift

**Contains:**
- High-level stack diagram
- Service topology
- AWS account/region strategy
- Cross-stack dependencies

### Key Directories
**Update when:**
- New directory created
- Directory renamed/moved
- Directory purpose changes

**Contains:**
- `/lib` - Stack implementations
- `/lib/constructs` - Reusable constructs
- `/bin` - CDK app entry points
- `/src/config` - Configuration system
- `/scripts` - Deployment/setup scripts

### Services Managed
**Update when:**
- Service added/removed
- Service purpose changes
- Service repository changes

**Contains table with:**
- Service name
- Repository
- Description
- Key resources (ECS, Lambda, etc.)
- Notes (environment-specific behavior)

### Important Implementation Details
**Update when:**
- AWS resource types change
- Integration patterns change
- Key implementation decisions made

**Contains:**
- Resource-specific patterns (ECS task definitions, Lambda configuration)
- AWS service usage (S3, RDS, CloudFront)
- Integration points (APIs, message queues)
- Security implementations (IAM, VPC)

### Deployment Flow
**Update when:**
- CDK Pipeline stages change
- Deployment process modified
- New environments added
- CI/CD integration changes

**Contains:**
- Pipeline architecture
- Deployment stages
- Approval gates
- Cross-account deployment flow
- GitHub Actions / CI integration

### Important Patterns and Conventions
**Update when:**
- New patterns introduced
- Naming conventions change
- Coding standards updated
- New validators/checks added

**Contains:**
- Resource naming patterns
- Tagging strategies
- Code organization principles
- Validation rules
- Feature flag usage

## README.md Guidelines

README.md for CDK projects should be brief and link to detailed docs/.

### Structure (Typical CDK README)

```markdown
# Project Name

Brief description of what this infrastructure deploys.

## Architecture

[Link to architecture diagram or brief overview]

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture.

## Services Managed

- Service 1 - Description
- Service 2 - Description
- Service 3 - Description

See [CLAUDE.md](CLAUDE.md) for detailed service information.

## Environments

- **DEV**: Development environment
- **STAGING**: Staging environment
- **PROD**: Production environment

See [docs/ENVIRONMENTS.md](docs/ENVIRONMENTS.md) for environment details.

## Quick Start

### Prerequisites
- AWS CLI configured
- Node.js 18+
- AWS CDK installed

### Deployment
\`\`\`bash
npm install
npm run cdk deploy
\`\`\`

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for comprehensive deployment guide.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Adding New Service](docs/ADDING_SERVICE.md)
- [Rollback Procedures](docs/ROLLBACK.md)

See [CLAUDE.md](CLAUDE.md) for AI-oriented codebase guide.
```

### When to Update README.md

| Change Type | Update README? | What to Update |
|-------------|----------------|----------------|
| New service added | Yes | Add to managed services list |
| Service removed | Yes | Remove from managed services list |
| New environment | Yes | Add to environments section |
| New docs/ guide | Yes | Add link to documentation section |
| Major feature added | Maybe | Add to features section if end-user visible |
| IaC refactoring | No | Internal change, doesn't affect users |
| Pattern change | No | Unless affects setup/deployment |
| Resource type change | Maybe | If affects tech stack significantly |

## docs/ File Organization

Recommended structure for CDK project documentation:

```
docs/
├── ARCHITECTURE.md          # System architecture overview
├── DEPLOYMENT.md            # Comprehensive deployment guide
├── ADDING_SERVICE.md        # How to add new service
├── ADDING_ENVIRONMENT.md    # How to add new environment
├── ROLLBACK.md              # Rollback procedures
├── TROUBLESHOOTING.md       # Common issues and solutions
├── guides/                  # How-to guides
│   ├── setting-up-dev.md
│   ├── cross-account-access.md
│   └── feature-flags.md
├── reference/               # Technical references
│   ├── stack-parameters.md
│   ├── resource-naming.md
│   └── tagging-strategy.md
├── architecture/            # Architecture diagrams and ADRs
│   ├── diagrams/
│   └── decisions/
└── planning/                # Planning documents
    ├── BACKLOG.md
    ├── ROADMAP.md
    └── features/
```

## Example Scenarios

### Scenario 1: Adding New Microservice

**Code Changes:**
- Added `ServiceName.PROFILE` to `types/service.ts`
- Added profile configuration to `src/config/config.data.ts`
- Created profile construct in `lib/constructs/service-profile.ts`
- Deployed profile in `lib/main-stack.ts`

**Documentation Updates:**

1. **CLAUDE.md:**
   - Update "Services Managed" table (add profile row)
   - Update "Architecture Overview" diagram (add profile to stack)
   - Update "Key Directories" if new directories created

2. **README.md:**
   - Add profile to managed services list
   - Update architecture overview (if visual)

3. **docs/:** (Optional)
   - Create `docs/services/PROFILE_SERVICE.md` if complex

**Commit:**
```bash
git commit -m "feat(service): Add profile service

- Add ServiceName.PROFILE enum
- Configure profile service in config.data.ts
- Create ProfileServiceConstruct
- Deploy profile service to all environments
- Update CLAUDE.md Services Managed table
- Update CLAUDE.md Architecture Overview
- Add profile to README.md managed services"
```

### Scenario 2: Introducing Resource Naming Convention

**Code Changes:**
- Created `src/naming/ResourceNamingService.ts`
- Applied naming convention across all constructs
- Updated construct creation to use naming service

**Documentation Updates:**

1. **CLAUDE.md:**
   - Update "Important Patterns and Conventions" (document naming pattern)
   - Update "Key Directories" (add `/src/naming` description)

2. **README.md:**
   - No update (internal pattern, doesn't affect users)

3. **docs/:**
   - Create `docs/reference/RESOURCE_NAMING.md` (detailed rules)
   - Update CLAUDE.md "Key Documentation Files" table (link to new doc)

**Commit:**
```bash
git commit -m "feat(infra): Implement resource naming convention

- Add ResourceNamingService for consistent naming
- Apply naming pattern across all constructs
- Update CLAUDE.md Important Patterns and Conventions
- Update CLAUDE.md Key Directories
- Add docs/reference/RESOURCE_NAMING.md
- Update CLAUDE.md Key Documentation Files table"
```

### Scenario 3: Adding Manual Approval to CDK Pipeline

**Code Changes:**
- Modified `lib/deployment-stack.ts`
- Added manual approval stage before production deployment

**Documentation Updates:**

1. **CLAUDE.md:**
   - Update "Deployment Flow" section (document approval stage)
   - Update "Important Patterns and Conventions" (if pattern change)

2. **README.md:**
   - Update quick start (mention approval requirement)

3. **docs/:**
   - Update `docs/DEPLOYMENT.md` (add approval steps)

**Commit:**
```bash
git commit -m "feat(pipeline): Add manual approval for production

- Add manual approval stage to CDK Pipeline
- Require approval before production deployment
- Update CLAUDE.md Deployment Flow section
- Update README.md quick start
- Update docs/DEPLOYMENT.md with approval steps"
```

### Scenario 4: Refactoring Construct Organization

**Code Changes:**
- Moved constructs from `lib/constructs/` to `lib/constructs/aws/` and `lib/constructs/custom/`
- Updated imports throughout codebase

**Documentation Updates:**

1. **CLAUDE.md:**
   - Update "Key Directories" (new structure)
   - Update `/lib/constructs` section (new organization)

2. **README.md:**
   - No update (internal refactoring)

3. **docs/:**
   - No update (unless affects documented procedures)

**Commit:**
```bash
git commit -m "refactor(infra): Reorganize construct directory structure

- Move constructs to aws/ and custom/ subdirectories
- Update imports across codebase
- Update CLAUDE.md Key Directories
- Update CLAUDE.md /lib/constructs section"
```

## Verification Commands

CDK-specific verification commands to run before committing:

```bash
# Verify CLAUDE.md has required sections
grep -n "## Services Managed" CLAUDE.md
grep -n "## Architecture Overview" CLAUDE.md
grep -n "## Key Directories" CLAUDE.md
grep -n "## Deployment Flow" CLAUDE.md

# Verify service mentions are updated
grep -rn "profile" CLAUDE.md README.md  # If added profile service
grep -rn "ServiceName" CLAUDE.md        # Should not document enum values

# Check for config value leakage
grep -E "[0-9]{3,4} CPU|[0-9]{3,4} memory" CLAUDE.md  # Should not exist!

# Verify docs/ links
grep -rn "docs/" CLAUDE.md README.md    # Check all links valid

# Check stack/construct references
grep -rn "lib/constructs/" CLAUDE.md    # Verify paths accurate
```

## Common CDK-Specific Mistakes

### ❌ Documenting CloudFormation Logical IDs

```markdown
# WRONG
- Database: MyStackDatabaseABC123DEF
- Bucket: MyStackBucketXYZ789
```

**Why wrong:** Logical IDs are implementation details that change.

**Solution:** Document resource purpose, not logical ID.

### ❌ Documenting Stack Output Values

```markdown
# WRONG
Stack Outputs:
- ApiEndpoint: https://api.example.com
- DatabaseEndpoint: db.example.com:5432
```

**Why wrong:** Outputs change per environment/deployment.

**Solution:** Document output names, not values: "Stack outputs defined in `lib/main-stack.ts`"

### ❌ Hardcoding Environment Details

```markdown
# WRONG
## Environments
- DEV: Account 123456789012, Region us-east-1
- PROD: Account 987654321098, Region us-west-2
```

**Why wrong:** Account IDs are sensitive and change.

**Solution:** "Environment configuration in `cdk.json` context."

### ❌ Documenting cdk.json Context Values

```markdown
# WRONG
Context:
- @aws-cdk/core:newStyleStackSynthesis: true
- @aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId: true
```

**Why wrong:** CDK feature flags are implementation details.

**Solution:** Only document custom context keys: "Custom context keys in `cdk.json`"

## Integration with CDK-Specific Skills

This documentation skill works well with:

- **cdk-expert**: CDK-specific infrastructure patterns and best practices
- **git-strategy**: Environment-based branching for CDK deployments
- **conventional-commits**: Proper commit message formatting

**Workflow:**
1. Make CDK infrastructure change
2. Invoke `maintaining-documentation` skill (this)
3. Update CLAUDE.md, README.md, docs/ as guided
4. Invoke `conventional-commits` skill for commit message
5. Commit code + documentation together

## Notes

- **Stack composition** changes more frequently than service changes
- **Configuration files** are the source of truth for values
- **Cross-stack references** should be documented in Architecture Overview
- **Bootstrap requirements** belong in deployment documentation
- **Feature flags** (if used) belong in Patterns and Conventions
- **Multi-account/region** strategies belong in Architecture Overview
