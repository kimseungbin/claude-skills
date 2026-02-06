# Codebase Index Plugin - Hook Improvements

## Problem

The codebase-index plugin monitors exploration but doesn't guide Claude to use existing indexes or provide actionable feedback.

## Planned Improvements

### 1. UserPromptSubmit Hook - ✅ DONE

**Purpose**: Help Claude use existing indexes before exploring

- **Trigger**: `UserPromptSubmit` - fires when user submits a prompt, before Claude processes it
- **Condition**: Only if `INDEX.md` exists in project root, src/, or docs/
- **Action**: Outputs reminder that gets added to Claude's context

**Implemented**:
- `hooks/check-index.sh` - checks for INDEX.md in common locations
- Added `UserPromptSubmit` hook to `hooks/hooks.json`
- Outputs: "INDEX.md exists at ./{path} - read it before exploring the codebase"

### 2. Stop Hook Suggestions (UPDATE) - ✅ DONE

**Purpose**: Provide actionable feedback with specific skill recommendations

**Implemented**:
- Modified `analyze-exploration.sh` to generate metric-specific suggestions
- Navigation-related thresholds (high reads, explore agent, glob/grep) → suggest `Skill(maintain-index)`
- File size threshold (high line counts) → suggest `Skill(file-headers)`
- Replaced generic "Consider adding paths to CLAUDE.md" with targeted suggestions

| Metric | Meaning | Suggestion |
|--------|---------|------------|
| High file reads / explore / glob+grep | Claude didn't know where files are | "Navigation could be improved. Run `Skill(maintain-index)` to update INDEX.md" |
| High line counts | Files are too large, wasting tokens | "Large files detected. Run `Skill(file-headers)` to add JSDoc summaries" |

### 3. Analysis Command (FUTURE) - Priority: Low

**Purpose**: Session-wise or project-wise pattern detection for smarter recommendations

- Aggregate data across turns/sessions
- Detect patterns (e.g., repeatedly reading same directory)
- Could be a slash command: `/analyze-exploration`

## Notes

- ✅ `UserPromptSubmit` hook type confirmed - fires before Claude processes each message
- Per-turn tracking is already implemented (marker file system)
- Skills `maintain-index` and `file-headers` already exist in the plugin

## Decisions Made

- Prompt hook preferred over PreToolUse (guides decision-making early)
- Separate suggestions for file reads vs line counts (different problems, different solutions)
- Suggestions include both action description AND skill name