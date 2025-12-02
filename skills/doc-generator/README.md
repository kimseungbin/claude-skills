# Doc Generator Skill

Generate PDFs from markdown files using command-line tools.

## Overview

This skill provides guidance on converting markdown-based files to various output formats:

- **Document PDFs**: Convert MD/MDX files to PDF documents using `md-to-pdf`
- **Presentation Slides**: Create slide deck PDFs using Marp CLI
- **Other Formats**: Generate PPTX, HTML from Marp markdown

## When to Use This Skill

Use this skill when:

- Converting documentation (MD/MDX) to PDF format
- Creating or updating presentation slides
- Batch converting multiple markdown files to PDFs
- Updating branding (headers/footers) on slide decks
- Choosing between different markdown-to-PDF tools

## Quick Reference

| Task | Tool | Command |
|------|------|---------|
| Document PDF | md-to-pdf | `npx md-to-pdf file.mdx` |
| Slide PDF | Marp CLI | `npx @marp-team/marp-cli file.md -o slides.pdf` |
| Slide PPTX | Marp CLI | `npx @marp-team/marp-cli file.md -o slides.pptx` |
| Batch slides | Marp CLI | `for f in *.md; do npx @marp-team/marp-cli "$f" -o "${f%.md}.pdf"; done` |

## Usage Examples

### Convert MDX Documentation to PDF

```bash
npx md-to-pdf documentation.mdx
# Output: documentation.pdf
```

### Create Branded Slides

1. Add Marp frontmatter to your markdown:

```yaml
---
marp: true
theme: default
paginate: true
header: 'Company Name | Section'
footer: '© 2025 Company Name'
---
```

2. Generate PDF:

```bash
npx @marp-team/marp-cli slides.md -o slides.pdf
```

### Batch Convert All Slides

```bash
cd session-markdowns/
for f in *.md; do
  npx @marp-team/marp-cli "$f" -o "../output/${f%.md}-slides.pdf"
done
```

## Key Features

### md-to-pdf
- Handles both `.md` and `.mdx` files directly
- No file extension conversion needed
- GitHub-flavored markdown support
- Custom CSS styling support

### Marp CLI
- Multiple output formats (PDF, PPTX, HTML, PNG)
- Built-in themes (default, gaia, uncover)
- Header/footer branding via frontmatter
- Speaker notes support
- Watch mode for development

## Installation

### As Git Submodule (Recommended)

```bash
# Add submodule (if not already added)
git submodule add https://github.com/kimseungbin/claude-skills.git claude-skills

# Create symlink
ln -s ../../claude-skills/skills/doc-generator .claude/skills/doc-generator
```

### Tools (installed on-demand via npx)

Both tools are run via `npx` and don't require global installation:

- `md-to-pdf`: `npx md-to-pdf <file>`
- `@marp-team/marp-cli`: `npx @marp-team/marp-cli <file>`

## Project Configuration

Optional configuration file: `.claude/config/doc-generator.yaml`

```yaml
# Marp defaults
marp:
  theme: default
  header_template: "{company} | {section}"
  footer_template: "© {year} {company}"
  company: "Your Company"

# Output directories
output:
  documents: "./output/docs"
  slides: "./output/slides"
```

## Common Pitfalls

1. **Wrong tool for MDX**: Use `md-to-pdf` (not `mdpdf`) for `.mdx` files
2. **Missing Marp frontmatter**: Always include `marp: true` for slides
3. **Creating duplicates**: Check for existing source files before creating new ones
4. **File extension mismatch**: `mdpdf` only accepts `.md`, but `md-to-pdf` accepts both

## Contributing

Improvements welcome! Key areas:
- Additional tool integrations
- More output format examples
- Custom theme templates

## License

Part of the claude-skills collection.