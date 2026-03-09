# Project Detection Guide

How to analyze a project to generate appropriate git hooks.

## Overview

Before generating hooks, analyze the project to understand:

1. **Project type** (monorepo, single package, frontend, backend, infrastructure)
2. **Available tooling** (what scripts are in package.json)
3. **Tech stack** (TypeScript, frameworks, testing tools)
4. **Performance constraints** (what's fast enough for pre-commit)

## Step 1: Identify Project Type

### Monorepo Detection

**Indicators**:

- `workspaces` field in root `package.json`
- `lerna.json` exists (Lerna)
- `pnpm-workspace.yaml` exists (pnpm)
- `nx.json` exists (Nx)
- Multiple `packages/*/package.json` files

**Example**:

```json
// package.json
{
	"workspaces": ["packages/*", "apps/*"]
}
```

**Hook template**: `pre-commit-monorepo.sh`

### AWS CDK Project Detection

**Indicators**:

- `aws-cdk-lib` in dependencies
- `cdk.json` exists
- `bin/` and `lib/` directories with CDK stacks

**Example**:

```json
// package.json
{
	"dependencies": {
		"aws-cdk-lib": "^2.174.0",
		"constructs": "^10.0.0"
	}
}
```

**Hook template**: `pre-commit-aws-cdk.sh`

### Frontend Project Detection

**Indicators**:

- React: `react`, `react-dom` in dependencies
- Vue: `vue` in dependencies
- Svelte: `svelte` in dependencies
- Angular: `@angular/core` in dependencies
- Vite/Webpack config files

**Hook template**: `pre-commit-basic.sh` (may add visual regression checks)

### Backend Project Detection

**Indicators**:

- NestJS: `@nestjs/core` in dependencies
- Express: `express` in dependencies
- Fastify: `fastify` in dependencies
- Koa: `koa` in dependencies

**Hook template**: `pre-commit-basic.sh`

### TypeScript Project Detection

**Indicators**:

- `tsconfig.json` exists
- `typescript` in devDependencies
- `.ts` or `.tsx` files

**Hook additions**: Add `type-check` to pre-commit

## Step 2: Check Available Tooling

Read `package.json` scripts to see what commands are available:

```json
{
	"scripts": {
		"format": "prettier --write .",
		"format:check": "prettier --check .",
		"lint": "eslint .",
		"lint:fix": "eslint . --fix",
		"type-check": "tsc --noEmit",
		"build": "tsc",
		"test": "vitest",
		"test:unit": "vitest run",
		"test:e2e": "playwright test"
	}
}
```

### Formatting Tools

**Look for**:

- `format`, `format:check` - Project has Prettier setup
- `prettier` - Direct Prettier command
- `fmt` - Alternative formatting command

**Action**: Always include formatting in pre-commit (auto-fix)

### Linting Tools

**Look for**:

- `lint`, `lint:check` - Linting available
- `lint:fix` - Auto-fix available
- `eslint` - ESLint direct command

**Action**: Include linting in pre-commit with auto-fix

### Type Checking

**Look for**:

- `type-check` - Dedicated type-check script
- `tsc --noEmit` - TypeScript check without output
- `typecheck` (alternative spelling)

**Action**: Include type-check in pre-commit (blocking)

### Building

**Look for**:

- `build` - Project has build step
- `compile` - Alternative build command
- `tsc` - TypeScript compilation

**Action**: Consider for pre-commit if fast (<10s), otherwise move to pre-push

### Testing

**Look for**:

- `test` - Test command
- `test:unit` - Unit tests only (usually fast)
- `test:integration` - Integration tests (usually slow)
- `test:e2e` - End-to-end tests (always slow)

**Action**:

- Unit tests for changed files → Consider for pre-commit
- Integration/E2E tests → Move to pre-push
- Full test suite → Move to pre-push or CI

## Step 3: Performance Testing

Test how long each command takes:

```bash
# Time formatting
time npm run format

# Time linting
time npm run lint

# Time type-check
time npm run type-check

# Time build
time npm run build

# Time tests
time npm run test
```

**Rules**:

- **< 5s** → Always include in pre-commit
- **5-30s** → Include in pre-commit if important
- **> 30s** → Move to pre-push or CI

## Step 4: Check Testing Frameworks

### Unit Testing

**Jest**:

```json
// package.json
{
	"devDependencies": {
		"jest": "^29.0.0"
	}
}
```

**Vitest**:

```json
{
	"devDependencies": {
		"vitest": "^3.0.0"
	}
}
```

**Action**: Can run fast for changed files:

```bash
# Jest: test only changed files
jest --findRelatedTests --bail $(git diff --cached --name-only)

# Vitest: similar capability
vitest related $(git diff --cached --name-only)
```

### E2E Testing

**Playwright**:

```json
{
	"devDependencies": {
		"@playwright/test": "^1.0.0"
	}
}
```

**Cypress**:

```json
{
	"devDependencies": {
		"cypress": "^13.0.0"
	}
}
```

**Action**: Always move to pre-push (too slow for pre-commit)

## Step 5: Analyze Project Structure

```bash
# Check directory structure
ls -la

# Common patterns to look for
tree -L 2
```

### Monorepo Structure

```
project/
├── packages/
│   ├── backend/
│   ├── frontend/
│   └── shared/
├── package.json (workspace root)
└── tsconfig.base.json
```

**Hook strategy**: Workspace-level commands that run across all packages

### Separate Frontend/Backend

```
project/
├── src/
├── tests/
├── package.json
└── tsconfig.json
```

**Hook strategy**: Simple, single-package hooks

### Infrastructure (CDK)

```
project/
├── bin/
│   └── app.ts
├── lib/
│   └── stacks/
├── cdk.json
└── package.json
```

**Hook strategy**: Include `cdk synth` validation, check for IAM changes

## Detection Workflow Example

```typescript
interface ProjectAnalysis {
	type: 'monorepo' | 'cdk' | 'frontend' | 'backend' | 'simple'
	hasTypeScript: boolean
	availableScripts: string[]
	testingFramework?: 'jest' | 'vitest' | 'playwright' | 'cypress'
	fastChecks: string[] // <10s
	slowChecks: string[] // >30s
}

function analyzeProject(): ProjectAnalysis {
	const pkg = readPackageJson()

	// Detect monorepo
	const isMonorepo = pkg.workspaces || fs.existsSync('lerna.json') || fs.existsSync('pnpm-workspace.yaml')

	// Detect CDK
	const isCDK = pkg.dependencies?.['aws-cdk-lib'] || fs.existsSync('cdk.json')

	// Detect TypeScript
	const hasTypeScript = fs.existsSync('tsconfig.json')

	// Get available scripts
	const availableScripts = Object.keys(pkg.scripts || {})

	return {
		type: isMonorepo ? 'monorepo' : isCDK ? 'cdk' : 'simple',
		hasTypeScript,
		availableScripts,
		fastChecks: detectFastChecks(pkg.scripts),
		slowChecks: detectSlowChecks(pkg.scripts),
	}
}
```

## Decision Matrix

| Project Type | TypeScript? | Template               | Pre-commit Checks              | Pre-push Checks       |
| ------------ | ----------- | ---------------------- | ------------------------------ | --------------------- |
| Monorepo     | Yes         | pre-commit-monorepo.sh | format, lint, type-check       | build, test:all       |
| Monorepo     | No          | pre-commit-monorepo.sh | format, lint                   | test:all              |
| AWS CDK      | Yes         | pre-commit-aws-cdk.sh  | format, lint, type-check, diff | test, synth           |
| Frontend     | Yes         | pre-commit-basic.sh    | format, lint, type-check       | test, test:e2e, build |
| Backend      | Yes         | pre-commit-basic.sh    | format, lint, type-check       | test, build           |
| Simple       | Yes         | pre-commit-basic.sh    | format, lint, type-check       | test                  |
| Simple       | No          | pre-commit-basic.sh    | format, lint                   | test                  |

## Quick Detection Script

```bash
#!/bin/bash
# Quick project type detection

echo "Project Analysis:"
echo "================="

# Check monorepo
if grep -q '"workspaces"' package.json 2>/dev/null; then
    echo "✓ Monorepo (npm workspaces)"
elif [ -f "lerna.json" ]; then
    echo "✓ Monorepo (Lerna)"
elif [ -f "pnpm-workspace.yaml" ]; then
    echo "✓ Monorepo (pnpm)"
fi

# Check CDK
if grep -q '"aws-cdk-lib"' package.json 2>/dev/null; then
    echo "✓ AWS CDK project"
fi

# Check TypeScript
if [ -f "tsconfig.json" ]; then
    echo "✓ TypeScript"
fi

# Check available scripts
echo -e "\nAvailable scripts:"
node -p "Object.keys(require('./package.json').scripts || {}).join(', ')"

echo -e "\nRecommended template:"
# Logic to suggest template based on above
```

## Next Steps

After analyzing the project:

1. Choose appropriate template from `../examples/templates/`
2. Customize template based on available scripts
3. Test hook performance (see [testing-hooks.md](testing-hooks.md))
4. Document choices (see [../decision-tree.md](../decision-tree.md))
