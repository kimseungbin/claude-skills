# Tidy Plugin

Organize and polish Obsidian notes via seven sequential passes. Works with English and Korean notes (including STT transcripts).

## Passes

The skill applies changes one pass at a time, showing each diff for review before the next pass runs.

### 1. Typos & Grammar

Fixes spelling, grammar, punctuation. For Korean, fixes 띄어쓰기 (spacing). For STT transcripts, removes filler words (`um`, `uh`, `어`, `음`, `그`...) and corrects sentence boundaries. Structure is preserved — this pass only edits text content.

### 2. Frontmatter (Properties)

Ensures YAML frontmatter exists with `tags`, `aliases`, `cssclasses`, `status`, `created`, `updated`. Sets `updated` to today. Prompts for `created:` when file mtime is unreliable, and for `status:` when it's absent or unrecognized. Consolidates inline `#tags` into frontmatter.

### 3. Formatting

Normalizes lists, bold/italic, code blocks. Applies Obsidian callouts (`> [!note]`, `> [!warning]`, `> [!tip]`, `> [!question]`) where appropriate. Never adds an H1 that duplicates the filename — uses H1 only for major section dividers (e.g., per session in an event note).

### 4. Restructuring

Applies a note-type template (Meeting, Event/Conference, Knowledge/Reference) and reorders sections to match. Groups transcript content by topic at natural breaks. For Event notes with more than three sessions, offers to split into separate files plus an index note.

### 5. Diagrams

Detects prose flow patterns (e.g., `User -> API Gateway -> Lambda -> DynamoDB`, `Browser <-> CloudFront`) and explicit `(다이어그램)` / `(diagram)` markers. For each candidate, proposes a Mermaid conversion (preferred) or ASCII fallback, with per-candidate confirmation. Detection is contextual — standalone lines containing arrows are stronger signals than arrows inside flowing prose.

### 6. Enrichment

Adds inline doc links and `[[wikilinks]]` for canonical concepts mentioned in the note. Uses a two-tiered confirmation model:

- **In-topic** terms (those that relate to the note's primary topic, inferred from title → tags → headings) are confirmed in a single batch.
- **Out-of-topic** mentions are confirmed per-term (≤3 mentions) or in a single batch (>3 mentions).

**Internal-first resolution.** Before fetching an external URL, the skill checks the local vault for a matching note (by filename or `aliases:`). Matching vault notes are linked as `[[wikilink]]`. Only when no vault match exists does the skill fall through to an external source.

To avoid re-scanning the vault per term, the skill builds an in-memory alias map once at the start of Pass 6 and reuses it for all term lookups through Pass 7.

### 7. Linking

Final wikilink sweep. Surfaces softer concept-to-note matches Pass 6 didn't capture — judgment-call links rather than canonical doc references. Reuses the alias map from Pass 6 (or builds one if Pass 6 was skipped). Candidates are presented as a multi-select checkbox prompt so the user can cherry-pick.

## AWS Knowledge MCP

Pass 6 (Enrichment) uses the [AWS Knowledge MCP server](https://github.com/aws-samples/aws-mcp-servers) when looking up AWS service documentation. The MCP returns canonical `docs.aws.amazon.com` URLs, avoiding stale or low-quality links that generic web search sometimes produces.

**Required tools** (must be available in the Claude Code session):

- `mcp__claude_ai_AWS_Knowledge_MCP_Server__aws___search_documentation`
- `mcp__claude_ai_AWS_Knowledge_MCP_Server__aws___read_documentation`

**Graceful degradation.** If the AWS MCP is unavailable, Pass 6 falls back to `WebSearch` + `WebFetch` for all terms (including AWS ones). The fallback works but may return less canonical URLs.

**Non-AWS terms** always go through `WebSearch` + `WebFetch` regardless of MCP availability.