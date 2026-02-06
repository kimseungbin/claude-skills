# Codebase Index Plugin - Hook Improvements

## Problem

The codebase-index plugin monitors exploration but doesn't guide Claude to use existing indexes or provide actionable feedback.

## Planned Improvements

### 1. Prompt Hook (NEW) - Priority: High

**Purpose**: Help Claude use existing indexes before exploring

- **Trigger**: Start of each turn (Prompt hook type)
- **Condition**: Only if `INDEX.md` exists in project root or configured locations
- **Action**: Inject reminder: "INDEX.md exists at {path} - read it before exploring the codebase"

**Implementation**:
- Add `Prompt` hook type to `hooks/hooks.json`
- Create `hooks/check-index.sh` script
- Script checks for INDEX.md, outputs reminder if found

### 2. Stop Hook Suggestions (UPDATE) - Priority: High

**Purpose**: Provide actionable feedback with specific skill recommendations

**Current**: Shows exploration summary with thresholds exceeded

**Add separate suggestions based on metric**:

| Metric | Meaning | Suggestion |
|--------|---------|------------|
| High file reads | Claude didn't know where files are | "Navigation could be improved. Run `Skill(maintain-index)` to update INDEX.md" |
| High line counts | Files are too large, wasting tokens | "Large files detected. Run `Skill(file-headers)` to add JSDoc summaries" |

**Implementation**:
- Modify `analyze-exploration.sh` to generate different suggestions
- Check which threshold was exceeded and recommend appropriate skill

### 3. Analysis Command (FUTURE) - Priority: Low

**Purpose**: Session-wise or project-wise pattern detection for smarter recommendations

- Aggregate data across turns/sessions
- Detect patterns (e.g., repeatedly reading same directory)
- Could be a slash command: `/analyze-exploration`

## Notes

- Prompt hook requires Claude Code to support `Prompt` hook type (verify this exists)
- Per-turn tracking is already implemented (marker file system)
- Skills `maintain-index` and `file-headers` already exist in the plugin

## Decisions Made

- Prompt hook preferred over PreToolUse (guides decision-making early)
- Separate suggestions for file reads vs line counts (different problems, different solutions)
- Suggestions include both action description AND skill name