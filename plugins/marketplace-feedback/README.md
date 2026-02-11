# marketplace-feedback

Submit bug reports and feature requests for plugins in the claude-skills marketplace.

## Usage

```
Skill(marketplace-feedback)
```

The skill will:

1. Auto-detect which plugin your feedback relates to (or let you choose)
2. Ask whether it's a bug report or feature request
3. Gather details interactively
4. Create a labeled issue on the claude-skills repository

## Issue Types

| Type | When to use |
|------|-------------|
| Bug Report | Something isn't working as expected |
| Feature Request | Suggest an improvement or new capability |

## Labels

Issues are automatically labeled with:

- **Type**: `type:bug` or `type:feature`
- **Plugin**: `plugin:<name>` (e.g., `plugin:commit-expert`)
- **Priority**: `priority:p0` through `priority:p3`
- **Source**: `marketplace-feedback`

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated