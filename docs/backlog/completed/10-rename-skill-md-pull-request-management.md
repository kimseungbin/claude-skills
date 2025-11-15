# Rename skill.md to SKILL.md in pull-request-management

**Priority:** High (Quick Win)
**Type:** File Naming Consistency
**Skill:** pull-request-management
**Estimated Time:** 5 minutes

## Problem

The `pull-request-management` skill uses `skill.md` (lowercase) instead of `SKILL.md` (uppercase), which is inconsistent with all other skills.

## Current State

```
skills/pull-request-management/
├── skill.md          ❌ Inconsistent naming
├── config.template.yaml
├── examples.md
└── examples/
```

All other skills use `SKILL.md` (uppercase).

## Impact

- **Inconsistency:** Breaks pattern followed by all other skills
- **Discoverability:** May confuse users or tools looking for SKILL.md
- **Documentation:** README template references SKILL.md

## Task

Rename `skills/pull-request-management/skill.md` to `SKILL.md`

## Steps

### 1. Use Git Move (Preserves History)

```bash
cd skills/pull-request-management
git mv skill.md SKILL.md
```

### 2. Verify Change

```bash
git status
# Should show: renamed: skill.md -> SKILL.md
```

### 3. Check for References

Search for any files that might reference the old filename:

```bash
cd ../..
grep -r "skill\.md" skills/pull-request-management/
```

Update any references found.

### 4. Commit

```bash
git add skills/pull-request-management/
git commit -m "refactor(pull-request-management): Rename skill.md to SKILL.md for consistency

All other skills use SKILL.md (uppercase). This change brings
pull-request-management in line with the established convention."
```

## Verification

After renaming:

```bash
ls -la skills/pull-request-management/
# Should show SKILL.md (not skill.md)

# Verify all skills now use SKILL.md
ls -la skills/*/SKILL.md
# Should list all 9 skills
```

## Dependencies

**Should be completed before:**
- Task #04: Add README.md for pull-request-management
  - The README will reference SKILL.md (uppercase)

## Acceptance Criteria

- [ ] File renamed using `git mv` (preserves history)
- [ ] No references to old filename remain
- [ ] Committed with conventional commit message
- [ ] Verified all skills now use consistent naming
- [ ] No broken links or references
