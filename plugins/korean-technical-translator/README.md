# Korean Technical Translator

Translate English technical content to Korean with project-specific terminology dictionaries.

## Usage

Claude automatically applies this skill when translating technical content to Korean. You can also invoke it explicitly:

```
Skill(korean-technical-translator)
```

## Project Configuration

Create `.claude/config/korean-technical-translator.yaml` to define custom translations:

```yaml
style: formal  # formal (합니다체) or casual (해요체)

dictionary:
  "repository": "저장소"
  "branch": "브랜치"
  "pull request": "풀 리퀘스트"

keep_english:
  - "API"
  - "SDK"
  - "Docker"
```

See `samples/default.yaml` for a complete example.

## Authors

- kimseungbin