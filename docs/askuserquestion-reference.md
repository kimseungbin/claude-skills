# AskUserQuestion — Upstream Reference

Research notes on what Anthropic officially specifies for the `AskUserQuestion` tool, and what it
leaves to us. Written to support [#18](https://github.com/kimseungbin/claude-skills/issues/18)
(explicit call shapes for `git/commit`) and the existing conventions in
`plugins/tidy/skills/tidy/SKILL.md`.

**Verified:** 2026-08-12. Upstream docs drift — re-check before relying on a constraint.

## Where the docs actually live

The Claude Code CLI docs only list `AskUserQuestion` in a tool table with a one-line description.
The real schema is in the **Agent SDK** docs:

- [Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input) —
  §"Question format" and §"Response format" carry the schema.

This gap is known and **will not be fixed**:
[anthropics/claude-code#20275](https://github.com/anthropics/claude-code/issues/20275) reported the
missing constraints, the absent cross-reference, and a conflicting claim about subagent
availability. It was closed as *not planned* with a `stale` label and no Anthropic reply.

Unofficial mirrors of the injected tool description (label guidance, `(Recommended)` marker, preview
rules) are collected at
[Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-askuserquestion.md).
Useful, but version-drifty and not authoritative.

## Officially specified

### Input

| Field         | Spec                                                          |
| ------------- | ------------------------------------------------------------- |
| `questions`   | Array, **1–4 entries** per call                               |
| `question`    | Full question text to display                                 |
| `header`      | Short label, **max 12 characters**                            |
| `options`     | **2–4 choices**, each `{ label, description }`                |
| `multiSelect` | `true` = user may select multiple options                     |
| `preview`     | Per-option visual mockup — availability differs by host, below |

### Response

`{ questions, answers, response? }`

- `questions` — pass the original array back through; required for tool processing.
- `answers` — keys are the **question text**, values are the selected option's **`label`**. For
  multi-select, an array of labels or a `", "`-joined string.
- `response` — optional freeform reply for when the user dismisses the card and types something that
  isn't an answer to any question. When set, Claude receives "The user responded: …" *instead of*
  the per-question answers.

### Hard limits

- 1–4 questions per call; 2–4 options per question.
- **Not available in subagents spawned via the Agent tool.**

## Host differences: `preview`

| Host          | Behavior                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code CLI | `preview` is available directly on options. Single-select only.                                                                              |
| Agent SDK (TS)  | Absent unless the app sets `toolConfig.askUserQuestion.previewFormat` to `"markdown"` or `"html"`. Applies session-wide; check for `undefined`. |

Skills in this repo are consumed through the CLI, so they may rely on `preview`. Anything
SDK-embedded must not assume it exists.

## NOT specified upstream

Nothing official covers the parts our skills most need to pin down:

- **Label length.** The injected tool description says 1–5 words; the public docs say nothing.
- **`(Recommended)` marker.** Purely our convention (and this repo's global instruction to place it
  first). No upstream notion of a default option exists.
- **When to prefer `multiSelect`.** Docs describe the mechanic, not the judgment.
- **When an option earns a `preview`.** The SDK page says Claude includes it "where a visual
  comparison helps" — descriptive, not prescriptive.

Any convention section we write for a skill is therefore a **locally-authored layer**, not a
restatement of a spec. There is no upstream document to defer to.

## Consequences for #18

1. **`header` ≤ 12 chars** — the issue's proposal matches the official constraint. Confirmed.
2. **Every ask point must offer 2–4 options.** The issue doesn't state this bound. C6 (approve /
   edit / skip) sits at 3 and is fine; any shape that would degrade to a single option is invalid.
3. **1–4 questions per call** bounds whether adjacent ask points could ever be bundled into one
   call (e.g. type + scope, C3 + C4). Worth an explicit decision rather than leaving it implicit.
4. **`preview` is safe to use** for the split plan and subject-line candidates, since `commit` runs
   in the CLI — but only on single-select asks.
5. **Subagent unavailability is a live risk.** If `commit` is ever invoked from a subagent, every
   ask point fails rather than degrading. The skill has no documented fallback for that path.

The catalogue in the issue body is also stale: it lists six ask points at line numbers that no
longer match. `plugins/git/skills/commit/SKILL.md` now has **eight** `AskUserQuestion` call sites,
including unexpected pre-staged files (~line 145) and a stop-and-surface case (~line 231) that the
C1–C6 table omits. Re-derive the catalogue from the current file.
