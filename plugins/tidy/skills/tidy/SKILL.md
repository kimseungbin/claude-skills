---
name: tidy
description: Tidy a Markdown note: fix typos and Korean spacing, clean up transcripts, apply the repo's templates and conventions, and add links between notes. Works with English and Korean notes.
argument-hint: [file-path]
allowed-tools: Read Edit Glob Grep AskUserQuestion
---

# /tidy: Note Tidier

Tidy the note at `$ARGUMENTS` (relative to the repo root). If no argument is given, ask which file to tidy.

## Process

### Step 1: Read and analyze

1. Read the target file completely.
2. Learn the repo's conventions. Where they conflict with this skill's defaults, the repo wins.
   - Read the repo's `CLAUDE.md` for note rules: writing style, callout conventions, language rules.
   - Find templates: the path `CLAUDE.md` names, or else Glob `templates/`, `_templates/`, `.templates/`. Note which template fits which note type and language.
3. Detect the note type:
   - **Metadata note**: a note whose template defines frontmatter (e.g. a book or project README)
   - **Note**: concepts, how-tos, technical explanations
   - **STT transcript**: raw transcription with speaker labels or filler words
4. Detect the language (English, Korean, or mixed).
5. If the type is ambiguous, ask.
6. List the `@claude` markers, where the text after `@claude` is a question or TODO for you (line number and a one-line summary each). Handle one marker per turn, and wait for the user before the next.
7. Find the progress markers. `<!-- tidy: done above -->` means everything above it has had every pass. `<!-- tidy: pass N done above -->` (at most one, below the first) means the part between the two has had passes 1 to N: continue it from pass N+1. With no pass marker, start pass 1 on the next section below `done above`, or on the whole file if there are no markers. If the user names a section, tidy that section instead. `@claude` markers count anywhere in the file.

### Step 2: Confirm before major changes

Ask before:
- applying or switching a template
- splitting a long note into several files
- adding links (present the candidates)

### Step 3: Apply changes one pass at a time

Finish each pass and let the user review the diff before starting the next. Never mix concerns in one edit. After each pass, as a separate edit, put `<!-- tidy: pass N done above -->` just below the part you worked on. After the last pass, replace it with `<!-- tidy: done above -->` and delete the older `done above` marker.

#### Pass 1: Typos and grammar
- Fix spelling, grammar, and punctuation only.
- For Korean, fix 띄어쓰기 (spacing) errors.
- Don't change structure, headings, or formatting in this pass.
- STT transcript: remove filler words (um, uh, 어, 음, 그...) and fix sentence boundaries.

#### Pass 2: Frontmatter (metadata notes only)
- Match the frontmatter fields of the template for this note type and language.
- Fill missing fields from what the file already says, and ask for anything else. Don't guess dates such as a publication year; other checks may depend on them.
- Skip this pass if the repo has no template with frontmatter.

#### Pass 3: Formatting
- Keep the user's heading structure; only make levels consistent within a file.
- Format lists, bold/italic, and code blocks consistently.
- Use GitHub alerts where they help: `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`. Follow the repo's callout conventions if `CLAUDE.md` defines them.
- Transcript speaker labels: `**Speaker Name**: What they said...`

#### Pass 4: Restructuring
- Notes: follow the repo's note template if one exists; otherwise use Summary, Details, References.
- Reorder sections to match, and split or merge paragraphs for clarity.
- Group transcript content by topic where natural breaks occur.

#### Pass 5: Linking
- Find related notes with Glob/Grep.
  - Search each concept in Korean and English, plus its abbreviation (임베딩 / embedding, 근사 최근접 이웃 / ANN).
  - Check `tags:` in other notes' frontmatter for related notes.
- Suggest relative Markdown links (`[Docker engine](../docker/engine.md)`) only where the concept is meaningfully related, not on every keyword match.
- Present the candidates before adding any.
- Grep is enough while the repo is small. If the notes reach hundreds of files, or links are missed because the same concept is worded differently, tell the user it's time to consider semantic search with a vector DB (e.g. `sqlite-vec`).

## Rules

- Keep each turn small: one pass or one marker. Don't preview later passes or other markers.
- Make every change with Edit so the user sees the diff; never overwrite a file.
- Keep the user's voice and meaning. Fix errors; don't rewrite content.
- Don't translate. In mixed-language notes, keep the primary language.
- Remove content only when it's clearly duplicated or wrong.
- When unsure about a change, ask.
