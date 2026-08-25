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
│   ├── file-size-limits.yaml     # Configuration for file size limits
│   ├── check-contrast.ts         # WCAG contrast check for design tokens
│   └── contrast-limits.yaml      # Thresholds and token paths for contrast
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

## Design-Token Contrast Check

### Purpose

WCAG contrast ratios for `<role>-bg` / `<role>-text` token pairs drift silently: a color gets tuned, the ratio slips below AA, and the first report comes from a user who cannot read the text. `check-contrast.ts` computes the ratios and fails on the commit that caused the regression.

Unlike the file-size check, this is **blocking** when wired into a pre-commit hook — a contrast regression is a defect, not a hint. It is used by `pre-commit/with-stylelint.sh`, which runs it only when a configured token file is staged.

**Requires** Node >=22.18 or >=23.6. The script is TypeScript run through Node's native type-stripping — no runtime dependency, no transpile step, nothing added to `package.json`.

### Configuration

Edit `.githooks/scripts/contrast-limits.yaml`:

```yaml
default_threshold: 7.0      # WCAG 2.1 AAA; 4.5 for AA normal text
sources:
  - src/tokens.css          # globs allowed: src/**/*.css
format: css                 # css | scss | json | custom
roles:
  button-identity: 4.5      # per-role override
  decorative: off           # exempt entirely
```

The check is inert until `sources:` points at a real token file. An empty `sources:` is a configuration error rather than a silent pass.

### Running Manually

```bash
# Check every configured source
node .githooks/scripts/check-contrast.ts

# Check only sources that are staged
node .githooks/scripts/check-contrast.ts --staged

# Check specific files, ignoring `sources:`
node .githooks/scripts/check-contrast.ts src/tokens.css
```

Exit codes: `0` every pair clears its threshold, `1` at least one is below, `2` configuration error.

### Skipped Rather Than Passed

Three cases are reported as skipped, because calling them a pass would be a lie:

- **Half-defined pair** — a role with `-bg` but no `-text`. A renamed half would otherwise drop the role from coverage with no signal.
- **Translucent background** — the backdrop behind it is unknown, so any ratio would be invented. Translucent *text* is composited over its background, which is well defined, and checked normally.
- **Unresolvable reference** — a `var()` or `$var` alias that dangles or cycles, reported with the trail it followed.

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