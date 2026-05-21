---
name: tidy
description: Organize and polish Obsidian notes — fix typos, restructure, convert prose to diagrams, enrich with doc links and [[wikilinks]], format with templates, clean up STT transcripts. Works with English and Korean notes.
argument-hint: [file-path]
allowed-tools: Read Edit Glob Grep AskUserQuestion WebFetch WebSearch mcp__claude_ai_AWS_Knowledge_MCP_Server__aws___search_documentation mcp__claude_ai_AWS_Knowledge_MCP_Server__aws___read_documentation
---

# /tidy — Obsidian Note Organizer

You are tidying an Obsidian vault note. The target file is `$ARGUMENTS` (relative to the vault root). If no argument is given, use **A1** to ask.

## Pass order

Changes are applied as **seven sequential passes**. Complete one pass at a time, let the user review the diff via the Edit tool, then proceed. Never mix concerns in a single edit.

```
1. Typos & Grammar
2. Frontmatter (Properties)
3. Formatting
4. Restructuring
5. Diagrams
6. Enrichment
7. Linking
```

## AskUserQuestion conventions

Each ask point in this skill has an explicit call shape, labeled `A1`–`A13`. Use the exact parameters specified — header chips are ≤12 chars, labels are 1–5 words, and `(Recommended)` markers go on the first option when there's a sensible default.

`preview` panels render side-by-side and should be used only where a visual comparison helps (file layouts, prose→diagram). Don't attach a preview to Yes/No prompts.

Only **A13** uses `multiSelect: true` — wikilink candidates are non-exclusive.

---

## Step 1: Read and Analyze

1. Read the target file completely. If `$ARGUMENTS` is empty, fire **A1**.
2. Detect the note type by signals (filename, structure, content):
   - **Meeting**: attendees, agenda, discussion, action items
   - **Event/Conference**: sessions, speakers, keynotes
   - **Knowledge/Reference**: concepts, how-tos, technical explanations
   - **STT Transcript**: raw transcription with speaker labels or filler words
3. Detect the language (English, Korean, or mixed).
4. If type detection is ambiguous, fire **A2** to confirm.

### A1 — Target file

**When:** `$ARGUMENTS` is empty.

```yaml
question: "Which note would you like to tidy?"
header: "Target file"
multiSelect: false
options:
  - label: "Active editor file"
    description: "Tidy whichever note is currently open in Obsidian."
  - label: "Most recently modified"
    description: "Tidy the note with the latest mtime in the vault."
  - label: "Pick from list"
    description: "Show the 10 most recently modified notes; user picks one."
```

Free-text "Other" lets the user paste a path.

### A2 — Note type confirmation

**When:** type detection is ambiguous (signals disagree).

```yaml
question: "Which note type fits this file best?"
header: "Note type"
multiSelect: false
options:
  - label: "Meeting"
    description: "Attendees, agenda, discussion, action items."
  - label: "Event/Conference"
    description: "Sessions, speakers, keynotes (AWS Summit, KubeCon, etc.)."
  - label: "Knowledge/Reference"
    description: "Concepts, how-tos, technical explanations."
  - label: "STT Transcript"
    description: "Raw transcription with speaker labels or filler words."
```

---

## Step 2: Apply Changes (Sequential Passes)

### Pass 1: Typos & Grammar

- Fix spelling, grammar, and punctuation only.
- Respect the note's language (EN, KR, or mixed).
- For Korean, fix 띄어쓰기 (spacing).
- Do NOT change structure, headings, or formatting in this pass.
- If STT transcript: remove filler words (`um`, `uh`, `어`, `음`, `그`...) and fix sentence boundaries.

### Pass 2: Frontmatter (Properties)

Ensure YAML frontmatter exists with these fields:

```yaml
---
tags: []
aliases: []
cssclasses: []
status: draft  # or "done", "archived"
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

- Set `updated` to today's date.
- If `created` is missing and file mtime is unreliable (e.g., synced/copied), fire **A3**.
- If `status` is absent or unrecognized, fire **A4**.
- If inline `#tags` appear in the body, fire **A5** to consolidate.

#### A3 — `created:` missing

```yaml
question: "`created:` is missing. Which date should it use?"
header: "Created date"
multiSelect: false
options:
  - label: "Today"
    description: "Use today's date as `created`."
  - label: "File mtime"
    description: "Use the file's modified timestamp (best-effort)."
  - label: "Leave empty"
    description: "Skip setting `created:`."
```

Free-text "Other" for explicit YYYY-MM-DD entry.

#### A4 — `status:` ambiguous

```yaml
question: "What's the status of this note?"
header: "Status"
multiSelect: false
options:
  - label: "Draft (Recommended)"
    description: "Work in progress, will revisit."
  - label: "Done"
    description: "Final / no further edits expected."
  - label: "Archived"
    description: "Kept for reference; not active."
```

#### A5 — Inline tags consolidation

```yaml
question: "Move inline #tags into frontmatter `tags:`?"
header: "Tag style"
multiSelect: false
options:
  - label: "Move all (Recommended)"
    description: "Consolidate every inline #tag into frontmatter; remove inline form."
  - label: "Move, keep inline too"
    description: "Add to frontmatter but leave inline #tags in body."
  - label: "Leave as-is"
    description: "Don't touch tags this pass."
```

### Pass 3: Formatting

- Obsidian uses the filename as the note title. Use H1 (`#`) as major section dividers (e.g., each session in an event). Use H2/H3 for subsections. **Do NOT** add an H1 that duplicates the filename.
- Format lists, bold/italic, and code blocks consistently.
- Use Obsidian callouts where appropriate:
  - `> [!note]` informational blocks
  - `> [!warning]` caveats
  - `> [!tip]` actionable advice
  - `> [!question]` open questions
- Format speaker labels (transcripts): `**Speaker Name**: What they said...`

### Pass 4: Restructuring

- Apply the appropriate note template (see Templates section).
- Reorder sections to match the template.
- Split/merge paragraphs for clarity.
- Group transcript content by topic at natural breaks.
- For Event/Conference notes with `>3` sessions, fire **A6**.

#### A6 — Multi-session event split

````yaml
question: "This event has {N} sessions. Split into separate files?"
header: "Split notes"
multiSelect: false
options:
  - label: "Split each session (Recommended)"
    description: "One file per session, plus an index note linking them."
  - label: "Keep in one file"
    description: "Single file with sessions as H1 sections."
  - label: "Split selected sessions"
    description: "Show the list; user picks which to split out."
preview: |
  Index note + one file per session:
    AWS Summit Seoul 2026.md
    AWS Summit Seoul 2026 — MAM301.md
    AWS Summit Seoul 2026 — MAM302.md
    AWS Summit Seoul 2026 — DEV401.md
````

### Pass 5: Diagrams

Convert prose flows to diagrams. **Candidate detection is LLM judgment, not a regex** — read the note in context and flag anything that plausibly represents a flow, then let the user confirm per-candidate via **A8**.

Two broad categories to look for:

1. **Explicit markers** the author left: `(다이어그램)`, `(diagram)`, or similar tags.
2. **Prose flow patterns**: arrow-style relationships between named entities, whether linear, branching, fan-in, fan-out, or multi-line tree shapes.

**Detection priors** (soft hints, not strict gates):

- The most common arrows in dash-typed notes are `->`, `<->`, `-->`, `<-->`. Unicode arrows (`→`, `↔`) and `=>` are rare and only relevant if the note style clearly uses them.
- Standalone lines containing arrows are much stronger candidates than arrows inside flowing prose. Inline phrases like *"the client -> server roundtrip"* are usually not diagrams; a line that is **just** `Browser <-> CloudFront` usually is.
- Chain length: 3+ nodes is almost always a diagram. 2-node pairs are diagrams only when standalone (visual signal that the author meant it as such).
- Branching / trees: if adjacent lines share a source or target, consider them a single tree candidate (e.g., `Lambda -> SNS` + `Lambda -> DynamoDB` on consecutive lines → `Lambda -> {SNS, DynamoDB}`).
- When in doubt, **err toward flagging** — A8 lets the user skip per candidate, so a false positive costs one Skip click; a missed real diagram is invisible.

At the start of the pass, fire **A7**. On Yes, walk each candidate and fire **A8** per candidate with the proposed Mermaid/ASCII conversion in the preview.

#### A7 — Pass 5 opt-in

```yaml
question: "Convert flow-style prose to diagrams?"
header: "Diagrams"
multiSelect: false
options:
  - label: "Yes (Recommended)"
    description: "Walk through each candidate one at a time."
  - label: "No"
    description: "Skip Pass 5 entirely."
  - label: "Show candidates first"
    description: "List all detected candidates inline before deciding."
```

#### A8 — Per-candidate diagram format

Default to **Mermaid** (renders natively in Obsidian, GitHub, most viewers). ASCII is the portability fallback. The `preview` shows the proposed conversion.

````yaml
question: "Convert this to a diagram?"
header: "Diagram fmt"
multiSelect: false
options:
  - label: "Mermaid (Recommended)"
    description: "Renders natively in Obsidian, GitHub, most viewers."
  - label: "ASCII"
    description: "Plain-text — portable to raw .md views."
  - label: "Skip"
    description: "Leave the prose as-is."
preview: |
  Source prose:
    A <-> B <-> C

  Proposed (Mermaid):
    ```mermaid
    flowchart LR
      A <--> B <--> C
    ```
````

### Pass 6: Enrichment

Add doc links / wikilinks for canonical concepts mentioned in the note. Uses a two-tiered confirmation model and **internal-first** resolution.

#### Step 0 — Build the vault alias map (once per pass)

Before doing any term resolution, scan the vault once and build an in-memory map:

```
1. Glob the vault for *.md files.
2. For each file, read its frontmatter and capture:
   - the filename (without `.md`)
   - the `aliases:` list (if any)
3. Build a normalized map: { lowercased_term → file_path }
4. Reuse this map for every term lookup in Steps 4 and Pass 7.
```

This avoids re-scanning the vault per term. On a 1000-note vault, a single Pass 6 might resolve 20+ terms — the map turns N scans into 1.

#### Step 1 — Infer the note's primary topic

Order of evidence: **title → tags → headings**.

- Title tokens get top weight (reflects how the note was filed).
- Frontmatter `tags:` confirms or refines.
- Dominant headings provide a tiebreaker.

If signals contest each other or no clear winner emerges, fire **A9**.

#### Step 2 — In-topic enrichment

Identify terms that relate to the inferred topic. Always show the full list inline (in the `question` field), then fire **A10** with a single Yes/No.

#### Step 3 — Out-of-topic mentions

Threshold-based:

- **≤3 mentions**: fire **A11** once per term.
- **>3 mentions**: fire **A12** once with the full list inline (same shape as A10).

#### Step 4 — Internal-first resolution (critical)

Before fetching an external URL for any term — in-topic or out-of-topic — resolve against the local vault first. Only two signals count:

1. **Filename match** (case-insensitive; normalize spaces↔dashes). E.g., `A2A.md` matches "A2A".
2. **Aliases match**: term appears in a note's frontmatter `aliases:` list. E.g., `Agent2Agent Protocol.md` with `aliases: [A2A, agent-to-agent]`.

H1 headings and tags do **not** count for resolution. (Tags inform topic inference in Step 1 only; H1 collisions are too noisy.)

If a vault note exists for the term → link as `[[note-name]]`. Otherwise fall through to Step 5.

#### Step 5 — External fallback

When no vault note exists:

- If the term is an AWS service → use the **AWS Knowledge MCP** (`aws___search_documentation` + `aws___read_documentation`). Returns canonical `docs.aws.amazon.com` URLs.
- Otherwise → use `WebSearch` + `WebFetch`.

#### Style

- **First mention only**: link only the first occurrence of a term in the note. Subsequent mentions stay plain.
- **Internal targets**: `[[wikilink]]`.

#### A9 — Topic confirmation

**When:** topic inference yields no clear winner OR two strong candidates.

```yaml
question: "Which is the primary topic of this note?"
header: "Topic"
multiSelect: false
options:
  - label: "{topic A}"
    description: "Strongest signal: {signal source}."
  - label: "{topic B}"
    description: "Secondary candidate: {signal source}."
  - label: "No primary topic"
    description: "Skip Pass 6 — treat all mentions as out-of-topic."
```

Option labels are filled dynamically from inference candidates.

#### A10 — In-topic batch confirmation

```yaml
question: |
  Topic: {topic}. In-topic terms found:
    1. {term 1}
    2. {term 2}
    ...
    N. {term N}

  Add doc links / wikilinks for all of the above?
header: "In-topic"
multiSelect: false
options:
  - label: "Yes (Recommended)"
    description: "Link all listed terms; first mention only."
  - label: "No"
    description: "Skip in-topic enrichment."
```

#### A11 — Out-of-topic, ≤3 mentions (per-term)

```yaml
question: "Out-of-topic mention: {term} ({context}). Add a doc link?"
header: "Off-topic"
multiSelect: false
options:
  - label: "Yes"
    description: "Link this term."
  - label: "No"
    description: "Leave this term unlinked, move to next."
  - label: "Skip all remaining"
    description: "Stop asking; skip every remaining out-of-topic mention."
```

#### A12 — Out-of-topic, >3 mentions (batch)

```yaml
question: |
  Out-of-topic mentions found:
    1. {term 1} — {context}
    2. {term 2} — {context}
    ...
    N. {term N} — {context}

  Add doc links for all of the above?
header: "Off-topic"
multiSelect: false
options:
  - label: "Yes (Recommended)"
    description: "Link all out-of-topic mentions."
  - label: "No"
    description: "Skip every out-of-topic mention."
```

### Pass 7: Linking

Final wikilink sweep — catches softer matches Pass 6 didn't surface. Pass 6 has already handled canonical doc references; this pass handles judgment-call concept-to-note links.

- **Reuse the alias map built in Pass 6 Step 0.** If Pass 6 was skipped entirely (no enrichment performed), build the map now using the same procedure.
- Where text mentions a concept matching an existing note's filename or alias, surface as a wikilink candidate.
- Use context-aware linking: only link when the concept is meaningfully related, not every keyword match.
- Fire **A13** with up to 4 candidates per call (paginate by significance if more exist).

#### A13 — Wikilink candidates (multiSelect)

```yaml
question: |
  Wikilink candidates found:
    1. "{phrase}" → [[{note}]]
    2. "{phrase}" → [[{note}]]
    ...

  Which to add? (first mention only)
header: "Wikilinks"
multiSelect: true
options:
  - label: "{candidate 1}"
    description: "{phrase} in {section} → [[{note}]]"
  - label: "{candidate 2}"
    description: "{phrase} in {section} → [[{note}]]"
  - label: "{candidate 3}"
    description: "{phrase} in {section} → [[{note}]]"
  - label: "{candidate 4}"
    description: "{phrase} in {section} → [[{note}]]"
```

A13 is the **only** multiSelect call in this skill — wikilink candidates are non-mutually-exclusive.

---

## Templates

Apply during Pass 4 (Restructuring), based on detected/confirmed type.

### Meeting Notes

```markdown
# [Meeting Title]

## Info
- **Date**: YYYY-MM-DD
- **Attendees**:

## Agenda
-

## Notes


## Action Items
- [ ]
```

### Event/Conference Notes

For multi-session events, fire **A6**. If volume is large (>3 sessions), recommend splitting.

Single-file format:

```markdown
# [Event Name]

## Info
- **Date**: YYYY-MM-DD
- **Location**:
- **Event**:

## Sessions

### [Session Title]
**Speaker**:

- **Key Points**:
  -
- **Takeaways**:
  -
```

### Knowledge/Reference Notes

```markdown
# [Topic]

## Summary


## Details


## References
-
```

---

## Rules

- Always show diffs via the Edit tool — never overwrite silently.
- Preserve the author's voice and meaning. Fix errors, don't rewrite content.
- For Korean text, maintain natural Korean grammar and 띄어쓰기.
- For mixed-language notes, keep the primary language consistent and don't translate.
- When uncertain about any change, ask rather than guess — use the AskUserQuestion call shapes above.
- Do not remove content unless it's clearly duplicated or erroneous.
