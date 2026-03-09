# Pre-push Hooks

Pre-push hooks run before pushing to remote, ideal for longer-running checks.

## Available Hooks

### `cdk-safety.sh`

**For:** AWS CDK infrastructure projects

**Checks:**
1. Build and lint validation
2. CDK synthesis validation
3. CDK diff analysis (resource changes)
4. Fixed-name resource safety detection
5. File size warnings (non-blocking)

**Required npm scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "lint:check": "eslint .",
    "cdk": "cdk"
  }
}
```

**Required dependencies:**
- AWS CDK CLI (`aws-cdk`)
- TypeScript

## Installation

```bash
# 1. Ensure base bundle is copied first
cp -r bundles/base/.githooks/ .githooks/

# 2. Copy CDK pre-push hook
cp bundles/hooks/pre-push/cdk-safety.sh .githooks/pre-push

# 3. Make executable
chmod +x .githooks/pre-push

# 4. Configure git
git config core.hooksPath .githooks
```

## Customization

### Fixed-Name Resources

Edit the `FIXED_NAME_PATTERNS` array to match your infrastructure:

```bash
FIXED_NAME_PATTERNS=(
    "AWS::CodeBuild::Project"
    "AWS::ECS::Service"
    "AWS::ECS::Cluster"
    "AWS::RDS::DBInstance"
    "AWS::ElasticLoadBalancingV2::LoadBalancer"
    # Add your patterns here
)
```

### Deployment Branches

By default, checks run on: `main`, `master`, `staging`, `prod`, `production`.

To customize, create `.githooks/config/deployment-branches.txt`:

```
main
develop
release/*
```

### Bypassing

#### For planned resource replacements

Add to your commit message:
```
Safe-To-Deploy: manual-deletion-planned
Analyzed-By: your-name
```

#### Emergency bypass

```bash
git push --no-verify
```

## Understanding Output

### CDK Diff Markers

| Marker | Meaning |
|--------|---------|
| `[+]` | Resource will be **created** |
| `[-]` | Resource will be **deleted** |
| `[~]` | Resource will be **updated** in-place (safe) |
| `[-/+]` | Resource will be **replaced** (potentially dangerous) |

### Fixed-Name Resources

Resources with explicit names in CloudFormation cannot be replaced atomically:
- CodeBuild projects
- ECS services/clusters
- RDS instances
- Load balancers

When these are replaced, CloudFormation must:
1. Delete the old resource
2. Create the new resource

This can cause downtime and requires manual intervention.

## Troubleshooting

### CDK synth fails

```bash
# Run manually to see full error
npm run cdk synth
```

### CDK diff shows unexpected changes

```bash
# Run diff manually with context
npm run cdk diff -- --no-color
```

### False positive on resource replacement

If a replacement is intentional and safe, add the commit footer:
```bash
git commit --amend -m "$(git log -1 --pretty=%B)

Safe-To-Deploy: manual-deletion-planned
Analyzed-By: your-name"
```