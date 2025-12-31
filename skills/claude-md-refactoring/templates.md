# Output Templates

Templates for consistent refactoring reports.

## Refactoring Opportunity Template

Use this format when proposing a refactoring opportunity (Step 2):

```markdown
## 🔍 Refactoring Opportunity Found

**Section**: [Section name or line range]

**Issue Type**:

- [ ] Human-oriented content (move to README.md or docs/)
- [ ] Overly verbose (extract to skill or move to docs/)
- [ ] Redundant (remove/condense)
- [ ] Unclear AI instructions (rewrite)

**Current Content** (preview):
```
[Show 5-10 lines of problematic content]
```

**Recommended Action**:
[Specific recommendation: where to move (README.md vs docs/), what to extract, how to condense]

**Rationale**:
[Brief explanation of why this needs refactoring and which destination is appropriate]
```

## Completion Report Template

Use this format after completing a refactoring (Step 6):

```markdown
## ✅ Refactoring Complete

**Changes Made**:

- [Describe what was changed]

**Files Modified**:

- `CLAUDE.md`: [what changed - moved/removed/condensed]
- `README.md`: [what was added, if applicable]
- `docs/[name].md`: [if comprehensive guide created]
- `.claude/skills/[name]/`: [if skill created]

**Before/After Comparison**:
[Show key before/after snippets if helpful]

**Next Steps**:

- Run `/refactor-claude-md` again to find next opportunity
- Review changes and commit when satisfied
- Continue until CLAUDE.md is fully optimized
```