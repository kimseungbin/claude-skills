# Plugin Best Practices

Best practices for creating Claude Code plugins, based on official Anthropic plugin patterns.

## Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json      # Required manifest
├── skills/
│   └── my-skill/
│       └── SKILL.md     # Instructions for Claude
├── commands/            # Slash commands (optional)
├── agents/              # Subagents (optional)
├── hooks/               # Event handlers (optional)
├── samples/             # Sample configs for users to copy
└── README.md            # Human documentation
```

## File Responsibilities

| File | Audience | Purpose |
|------|----------|---------|
| SKILL.md | Claude | Instructions and workflow for the AI |
| README.md | Humans | Installation, usage, and overview |
| samples/ | Humans | Full config examples to copy |

### SKILL.md Guidelines

Keep it focused on **instructions for Claude**, not human documentation.

**Do:**
- Describe the workflow (numbered steps)
- Specify allowed tools in frontmatter
- Include minimal format examples
- List rules and constraints

**Don't:**
- Include lengthy YAML/config examples (put in samples/)
- Duplicate README content
- Add installation instructions
- Write user guides

**Example (concise):**
```markdown
---
name: my-skill
description: Brief description
allowed-tools: Read, Glob
---

# My Skill

One-line purpose.

## Workflow

1. Check for config file using Glob
2. Read and apply settings
3. Perform the task

## Rules

- Rule one
- Rule two
```

### README.md Guidelines

Keep it **concise**. Point to samples for full examples.

**Include:**
- One-line description
- Usage example
- Minimal config snippet
- Link to samples for complete config
- Authors section

**Target length:** 30-50 lines

## Project-Level Configuration

Plugins can access project-specific config files at runtime.

### How It Works

Plugins are copied to cache on install, so they can't bundle project files. However, skills can use `Read` and `Glob` tools at runtime to access any project file.

**Pattern:**
```markdown
## Workflow

1. Check if `.claude/config/my-plugin.yaml` exists using Glob
2. If exists, read and apply settings
```

**Config location:** `.claude/config/<plugin-name>.yaml`

### Sample Config Organization

```
my-plugin/
├── samples/
│   ├── default.yaml     # Standard config
│   ├── minimal.yaml     # Bare minimum
│   └── advanced.yaml    # All options
```

Users copy from samples to their project:
```bash
cp samples/default.yaml .claude/config/my-plugin.yaml
```

## Multiple Plugins in One Repository

Use a plugin marketplace to index multiple plugins:

```
my-plugins-repo/
├── .claude-plugin/
│   └── marketplace.json    # Required location
└── plugins/
    ├── plugin-one/
    │   └── .claude-plugin/
    └── plugin-two/
        └── .claude-plugin/
```

**.claude-plugin/marketplace.json:**
```json
{
  "name": "my-plugins-repo",
  "owner": "your-github-username",
  "plugins": [
    {
      "name": "plugin-one",
      "source": "./plugins/plugin-one",
      "description": "Plugin description",
      "version": "1.0.0"
    }
  ]
}
```

## Installation Scopes

| Scope | Use Case |
|-------|----------|
| `user` | Personal plugin across all projects |
| `local` | Project-specific, gitignored |
| `project` | Shared with team via version control |

```bash
claude plugin install ./my-plugin --scope user
```

## Common Mistakes

### Verbose SKILL.md

**Bad:** 80+ lines with full config examples and user documentation

**Good:** 30-40 lines focused on Claude instructions

### Duplicated Content

**Bad:** Same YAML example in SKILL.md, README.md, and samples/

**Good:**
- SKILL.md: Minimal format reference
- README.md: Brief example with "see samples/"
- samples/: Complete examples

### Missing Tool Restrictions

**Bad:** No `allowed-tools` in frontmatter

**Good:**
```yaml
---
allowed-tools: Read, Glob
---
```

## Checklist

Before publishing a plugin:

- [ ] SKILL.md under 50 lines
- [ ] README.md under 50 lines
- [ ] Full examples in samples/ only
- [ ] `allowed-tools` specified in SKILL.md frontmatter
- [ ] No content duplication across files
- [ ] Config path documented: `.claude/config/<plugin-name>.yaml`