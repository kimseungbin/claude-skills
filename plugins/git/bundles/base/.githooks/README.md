# Git Hooks Base

This directory contains the base library and scripts for git hooks.

## Directory Structure

```
.githooks/
├── lib/                          # Shared library functions
│   ├── colors.sh                 # Color and symbol definitions
│   ├── output.sh                 # Message formatting functions
│   └── utils.sh                  # Utility functions
├── scripts/                      # Helper scripts (not hooks)
│   ├── check-file-sizes.sh       # File size warning script
│   └── file-size-limits.yaml     # Configuration for file size limits
└── README.md
```

## Setup

```bash
git config core.hooksPath .githooks
```

## Shared Library (`lib/`)

The `lib/` directory contains shared bash functions used by hooks and scripts:

| File | Purpose |
|------|---------|
| `colors.sh` | Color codes (`RED`, `GREEN`, etc.) and symbols (`SYM_CHECK`, `SYM_CROSS`) |
| `output.sh` | Message formatting (`print_header`, `print_success`, `print_error`, etc.) |
| `utils.sh` | Utilities (`format_size`, `get_current_branch`, `is_deployment_branch`) |

### Usage in Scripts

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/colors.sh"
source "$SCRIPT_DIR/lib/output.sh"
source "$SCRIPT_DIR/lib/utils.sh"

print_header "My Script"
print_success "Task completed"
```

## File Size Check

### Purpose

Large files consume excessive tokens when AI assistants read them, reducing efficiency. The file size check warns about files that may be candidates for refactoring.

This is a **non-blocking warning** - it informs but does not prevent the push.

### Configuration

Edit `.githooks/scripts/file-size-limits.yaml`:

```yaml
# Size limits by file extension
limits:
  ts: 8192      # 8KB - TypeScript files
  md: 15360     # 15KB - Markdown files

# Directories to exclude from checking
exclude:
  - node_modules
  - dist
```

### Running Manually

```bash
# Check files changed since remote
.githooks/scripts/check-file-sizes.sh

# Check all tracked files
.githooks/scripts/check-file-sizes.sh --all

# Check staged files only
.githooks/scripts/check-file-sizes.sh --staged
```

### Bypassing

Add an escape comment at the **top of the file**:

**TypeScript files (`.ts`):**
```typescript
// large-file-ok: This file contains all type definitions
```

**Markdown files (`.md`):**
```markdown
<!-- large-file-ok: Comprehensive guide that should remain as single document -->
```

## Customization

### Deployment Branches

By default, deployment branches are: `main`, `master`, `staging`, `prod`, `production`.

To customize, create `.githooks/config/deployment-branches.txt`:

```
main
develop
release
```

## Adding Hooks

After copying this base, add hooks from the `bundles/hooks/` directory:

- `pre-commit/basic.sh` → `.githooks/pre-commit`
- `pre-push/cdk-safety.sh` → `.githooks/pre-push`
- `commit-msg/conventional.sh` → `.githooks/commit-msg`

Make sure to `chmod +x` any hooks you add.

## Troubleshooting

### Hooks not running

```bash
# Verify hooks path is configured
git config core.hooksPath
# Should output: .githooks

# Re-configure if needed
git config core.hooksPath .githooks
```

### Bypass hooks (emergency only)

```bash
git push --no-verify
git commit --no-verify
```