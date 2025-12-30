---
name: korean-technical-translator
description: Translate English technical content to Korean using project-specific dictionaries
allowed-tools: Read, Glob
---

# Korean Technical Translator

Translate English technical content to Korean with project-specific terminology.

## Workflow

1. Check for `.claude/config/korean-technical-translator.yaml` using Glob
2. If exists, read and apply dictionary translations exactly as specified
3. Translate content using natural Korean while preserving technical accuracy

## Dictionary Format

```yaml
dictionary:
  "repository": "저장소"
  "branch": "브랜치"
style: formal  # formal (합니다체) or casual (해요체)
keep_english:
  - "API"
  - "Docker"
```

## Translation Rules

- Apply dictionary terms exactly as specified
- Keep terms in `keep_english` list untranslated
- Preserve code blocks, file paths, and commands as-is
- Use formal style (합니다체) by default
- For unlisted terms, use standard Korean technical conventions