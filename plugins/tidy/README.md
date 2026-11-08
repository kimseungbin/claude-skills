# Tidy Plugin

Tidy Markdown study notes in five sequential passes. Works with English and Korean notes, including STT transcripts.

```
/tidy:tidy path/to/note.md
```

## Repo conventions

Before editing, the skill reads the repo's `CLAUDE.md` and finds its templates (the path `CLAUDE.md` names, or `templates/`, `_templates/`, `.templates/`). Repo rules override the skill's defaults, so callout styles, writing rules, and frontmatter fields come from the repo, not the plugin.

## Passes

The skill runs one pass at a time and waits for you to review each diff before the next.

1. **Typos and grammar**: spelling, grammar, punctuation, and Korean 띄어쓰기 (spacing). For transcripts, removes filler words and fixes sentence boundaries.
2. **Frontmatter**: for notes whose template defines frontmatter, matches the template's fields. Fills what the file already says and asks for the rest; never guesses dates.
3. **Formatting**: consistent heading levels, lists, and code blocks; GitHub alerts (`> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`) or the repo's own callout conventions.
4. **Restructuring**: follows the repo's note template, or Summary / Details / References if there is none.
5. **Linking**: finds related notes with Glob/Grep, searching each concept in Korean, English, and by abbreviation, and checking other notes' `tags:`. Suggests relative Markdown links and asks before adding them.

## Markers

- `@claude <request>` in a note: a question or TODO for Claude. The skill handles one per turn.
- `<!-- tidy: pass N done above -->` and `<!-- tidy: done above -->`: progress markers the skill writes, so a long note can be tidied across sessions.

## Overriding per project

A project skill named `tidy` (`.claude/skills/tidy/SKILL.md`) takes precedence over this plugin's `tidy:tidy`. Use one to pin repo-specific paths.
