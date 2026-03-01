# Create config-template.yaml for cdk-expert

**Priority:** Low
**Type:** Configuration Template
**Skill:** cdk-expert
**Estimated Time:** 15 minutes

## Problem

The `cdk-expert` skill has an inline configuration example in SKILL.md but no separate template file for users to copy.

## Current State

- ✅ Configuration section exists in SKILL.md (lines 199-232)
- ✅ Inline example config provided
- ❌ No separate `config-template.yaml` file

## Task

Create `skills/cdk-expert/config-template.yaml`

## Content to Extract

Extract the configuration example from SKILL.md (lines 207-232):

```yaml
# CDK Expert Skill Configuration
# Copy this file to .claude/config/cdk-expert.yaml in your project

project: my-cdk-project

# Project-specific naming conventions
naming:
    pattern: '${service}-${environment}-${resource}'
    environments: [dev, staging, prod]

# Required tags for all resources
tags:
    ManagedBy: CDK
    Project: my-project
    CostCenter: engineering

# Custom validation rules
validation:
    require_encryption: true
    require_versioning: true
    max_fargate_cpu: 4096

# Security requirements
security:
    cdk_nag_enabled: true
    nag_rule_pack: AwsSolutions
    require_vpc: true
```

## Additional Sections to Include

Add helpful comments explaining each section:

```yaml
# CDK Expert Skill Configuration
# Copy this file to .claude/config/cdk-expert.yaml in your project
# This configuration helps CDK Expert provide project-specific guidance

# Project name (used in documentation and guidance)
project: my-cdk-project

# Naming Conventions
# Define how resources should be named in your stacks
naming:
    # Naming pattern for resources
    # Available variables: ${service}, ${environment}, ${resource}, ${region}
    pattern: '${service}-${environment}-${resource}'

    # Valid environments for this project
    environments: [dev, staging, prod]

    # Optional: Resource-specific overrides
    # overrides:
    #   lambda: '${service}-${environment}-fn-${resource}'
    #   bucket: '${service}-${environment}-${resource}-${region}'

# Required Tags
# All resources will be tagged with these
tags:
    ManagedBy: CDK
    Project: my-project
    CostCenter: engineering
    # Add your organization's required tags here

# Custom Validation Rules
# CDK Expert will validate your constructs against these rules
validation:
    require_encryption: true      # All storage must be encrypted
    require_versioning: true      # S3 buckets must have versioning
    max_fargate_cpu: 4096        # Maximum CPU units for Fargate
    max_fargate_memory: 8192     # Maximum memory for Fargate
    # require_backup: true       # Require backup plans for databases

# Security Requirements
# CDK Nag and security best practices
security:
    cdk_nag_enabled: true        # Enable CDK Nag validation
    nag_rule_pack: AwsSolutions  # Rule pack: AwsSolutions, HIPAA, PCI-DSS, NIST-800-53
    require_vpc: true            # Resources must be in VPC when applicable
    # require_private_subnets: true
    # require_waf: true          # Require WAF for public-facing services

# Optional: Stack-specific settings
# stacks:
#   main:
#     env:
#       account: '123456789012'
#       region: us-east-1
#   pipeline:
#     cross_account_keys: true
```

## File Location

Create at: `skills/cdk-expert/config-template.yaml`

## Update Reference in SKILL.md

After creating the template, update SKILL.md to reference it:

```markdown
**Example config:**

See `config-template.yaml` for a complete example with comments.

\`\`\`yaml
project: my-cdk-project
# ... (abbreviated example)
\`\`\`
```

## Acceptance Criteria

- [ ] File created at `skills/cdk-expert/config-template.yaml`
- [ ] Contains all sections from SKILL.md example
- [ ] Includes helpful comments for each section
- [ ] Header comment explains how to use the template
- [ ] Optional sections commented out but documented
- [ ] SKILL.md updated to reference the template file
