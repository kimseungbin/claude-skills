# Refactoring Examples

This file contains before/after examples to guide CLAUDE.md refactoring decisions.

## Example 1: Moving Philosophy to README.md

### Before (CLAUDE.md)

```markdown
## Design Principles

### User Experience First

This project prioritizes exceptional user experience because we believe
that great software starts with empathy for users. We've adopted a
keyboard-first approach because many power users prefer keyboard navigation.
This philosophy extends to accessibility, where we follow ARIA guidelines
to ensure everyone can use our application regardless of their abilities.

When implementing features, always ask yourself:
- Would my grandmother be able to use this?
- Does this delight the user or just solve a problem?
- How does this make the user feel?
```

### After (CLAUDE.md)

```markdown
## User Experience Requirements

All interactive features must be fully keyboard accessible:
- Forms: Enter to submit, Escape to cancel/clear
- Lists: Arrow key navigation where appropriate
- Provide keyboard shortcuts for common actions

Follow ARIA guidelines for accessibility.
Use mobile-first responsive design.

See README.md "Design Philosophy" section for the rationale behind these requirements.
```

### After (README.md - new section)

```markdown
## Design Philosophy

### User Experience First

This project prioritizes exceptional user experience because we believe
great software starts with empathy for users. We've adopted a
keyboard-first approach because many power users prefer keyboard navigation,
and it naturally improves accessibility for everyone.

When implementing features, always consider:
- Would my grandmother be able to use this?
- Does this delight the user or just solve a problem?
- How does this make the user feel?

These questions guide our technical requirements documented in CLAUDE.md.
```

**Rationale**: The "why" and philosophy stays in README.md for humans. The concrete technical requirements stay in CLAUDE.md for AI to follow.

---

## Example 2: Extracting Lengthy How-To into Skill

### Before (CLAUDE.md)

```markdown
## AWS CDK Deployment

### First-Time Setup

AWS CDK requires a one-time bootstrap operation. This creates an S3 bucket
for storing CloudFormation templates, an ECR repository for Docker images,
and IAM roles for deployments.

**Step 1: Install AWS CDK CLI**
```bash
npm install -g aws-cdk
```

**Step 2: Configure AWS Credentials**
Set up your AWS credentials using aws configure or environment variables...

**Step 3: Bootstrap CDK**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

**Step 4: Configure OIDC Provider**
GitHub Actions needs an OIDC provider to authenticate without storing credentials...
[20+ more lines of detailed steps]

### Deployment
Once setup is complete, deploy using...
```

### After (CLAUDE.md)

```markdown
## AWS CDK Deployment

**First-time setup** (one-time per AWS account): Use the `cdk-setup` skill for step-by-step guidance. See `.claude/skills/cdk-setup/setup-guide.yaml`

**Continuous Deployment**: All infrastructure changes deploy automatically via GitHub Actions when pushed to `main` (`.github/workflows/deploy.yml`)

**Manual Deployment** (testing only, requires AWS credentials):
```bash
npm run diff --workspace=infra   # Preview changes
npm run deploy --workspace=infra # Deploy
```
```

### Created Skill (`.claude/skills/cdk-setup/setup-guide.yaml`)

```yaml
---
name: cdk-setup
description: |
  Use this skill when the user needs help with AWS CDK first-time setup,
  bootstrap, OIDC configuration, or GitHub Actions deployment setup.
---

# AWS CDK Setup Guide

[Full detailed step-by-step instructions moved here with examples, troubleshooting, etc.]
```

**Rationale**: The detailed how-to overwhelmed CLAUDE.md. The skill contains the full guide, while CLAUDE.md just references it and provides quick commands.

---

## Example 3: Condensing Verbose Instructions

### Before (CLAUDE.md)

```markdown
## Running Tests

When you're developing features, it's important to run tests regularly.
You can run tests for individual packages or for the entire monorepo.

For the frontend, we use Vitest for unit tests and Playwright for E2E tests.
You'll probably want to run unit tests frequently during development since
they're fast. The E2E tests are slower, so you might want to run those less
often, maybe before pushing to GitHub.

For the backend, we use Jest. You can run tests in watch mode during development
which is really helpful because it re-runs tests automatically when you change files.
```

### After (CLAUDE.md)

```markdown
## Testing Commands

**Run all tests**: `npm test` (root level)

**Package-specific**:
- Frontend unit: `npm run test --workspace=frontend`
- Frontend E2E: `npm run test:e2e:docker --workspace=frontend` (Docker, recommended)
- Backend: `npm run test --workspace=backend`

**Watch mode**: `npm run test:watch --workspace=backend`

**Before committing**: Run all tests to catch regressions.
```

**Rationale**: Removed narrative explanations ("it's important", "you'll probably want"). Kept only actionable commands and when to use them.

---

## Example 4: Removing Redundant Content

### Before (CLAUDE.md)

```markdown
## Project Overview

Trip Settle is a full-stack TypeScript monorepo for managing trip expense
settlements. The goal is to make it easy for groups of friends to track
shared expenses and calculate who owes whom at the end of a trip.

The project uses npm workspaces to manage three main packages:
- frontend: Svelte application
- backend: NestJS API
- infra: AWS CDK

We chose this tech stack because TypeScript provides type safety across
the entire stack, and the monorepo structure keeps everything in sync.
```

### After (CLAUDE.md)

```markdown
## Project Structure

TypeScript monorepo with npm workspaces:
- `packages/frontend/`: Svelte + Vite + TypeScript
- `packages/backend/`: NestJS + TypeORM + PostgreSQL
- `packages/infra/`: AWS CDK

See README.md for project overview and tech stack rationale.
```

### After (README.md - already existed)

```markdown
# Trip Settle

Trip Settle makes it easy for groups to track shared expenses and calculate
settlements at the end of a trip.

## Tech Stack

Built as a TypeScript monorepo using:
- **Frontend**: Svelte for reactive UI
- **Backend**: NestJS for scalable API
- **Infrastructure**: AWS CDK for infrastructure as code

We chose this stack for type safety across the entire application and
monorepo structure to keep packages in sync.
```

**Rationale**: The narrative project description and tech stack rationale already existed in README.md. CLAUDE.md now just lists the structure for AI to navigate the codebase.

---

## Example 5: Skill Reference Formatting

### Before (CLAUDE.md)

```markdown
## Testing

We follow test-driven development. Write tests first, then implement features.
```

### After (CLAUDE.md)

```markdown
## Feature Development Workflow

**All features must follow the TDD workflow defined in `.claude/skills/tdd-workflow/workflow.yaml`**

Key phases: Plan → Red → Green → Verify → Refactor → Commit

Use the `tdd-workflow` skill for step-by-step guidance.
```

**Rationale**:
- Clearly references the skill location
- Provides brief overview (phases)
- Tells AI how to activate it
- Makes it obvious this is mandatory

---

## Pattern Summary

| Content Type | Keep in CLAUDE.md | Move to README.md | Extract to Skill |
|--------------|-------------------|-------------------|------------------|
| Philosophy/Why | ❌ | ✅ | ❌ |
| Commands | ✅ | ❌ | ❌ |
| File paths | ✅ | ❌ | ❌ |
| Step-by-step guides (>30 lines) | ❌ | ❌ | ✅ |
| Technical constraints | ✅ | ❌ | ❌ |
| Narrative explanations | ❌ | ✅ | ❌ |
| Project motivation | ❌ | ✅ | ❌ |
| Quick reference | ✅ | ✅ (detailed) | ❌ |
| Examples/templates | ❌ | ❌ | ✅ |

## Tone Comparison

### Human-Oriented (README.md)
- "We chose this because..."
- "This helps us achieve..."
- "You'll probably want to..."
- Conversational, explanatory

### AI-Oriented (CLAUDE.md)
- "Use X for Y"
- "Run command Z"
- "See skill ABC"
- Imperative, directive

### Instructional (Skills)
- "Step 1: Do X"
- "If Y, then Z"
- "Example: ..."
- Procedural, educational