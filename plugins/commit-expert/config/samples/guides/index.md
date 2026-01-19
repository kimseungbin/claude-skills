# Quality Guides Index

Quick quality checklist. Read the specific yaml file only when you need detailed guidance.

## Quick Quality Check

Before finalizing commit message, verify:

1. **Specific?** Names actual components, not generic "code" or "files"
2. **Clear verb?** Avoids "update", "change", "modify" - uses specific action
3. **Standalone?** Understandable without reading the diff
4. **Imperative?** "Add feature" not "Added feature"
5. **Right length?** 50-72 characters ideal, max 72

## When to Read Detailed Files

| File | Read When |
|------|-----------|
| `specificity.yaml` | Commit title feels vague, need improvement examples |
| `title-patterns.yaml` | Need verb suggestions or naming pattern guidance |

## Common Quick Fixes

| Problem | Fix |
|---------|-----|
| "Update code" | Name the specific component |
| "Fix bug" | Describe what was broken |
| "Add feature" | Name the feature |
| "Refactor" | Explain what was restructured |

## Files

- `specificity.yaml` - Detailed specificity checklist with examples
- `title-patterns.yaml` - Verb categories and naming patterns