---
name: Doc Generator
description: Generate PDFs from markdown files. Use when user needs to convert MD/MDX to PDF documents or create presentation slides using Marp.
---

# Doc Generator

This skill provides guidance on converting markdown-based files to PDF documents and presentation slides using command-line tools.

## Instructions

When the user requests to generate PDFs or slides from markdown:

1. **Identify the output type**:
    - **Document PDF**: Standard PDF from markdown content (reports, documentation, etc.)
    - **Presentation slides**: Slide deck PDF using Marp (presentations, training materials)

2. **Choose the appropriate tool**:

### For Document PDFs: `md-to-pdf`

```bash
# Convert markdown/MDX to PDF
npx md-to-pdf <input-file>

# Output: Same directory, same filename with .pdf extension
```

**Key points:**
- Handles both `.md` and `.mdx` files directly
- No need to rename or convert file extensions
- Outputs PDF in the same directory as source file
- Supports GitHub-flavored markdown

### For Presentation Slides: `marp-cli`

```bash
# Convert Marp markdown to PDF slides
npx @marp-team/marp-cli <input.md> -o <output.pdf>

# Batch convert multiple files
for f in *.md; do npx @marp-team/marp-cli "$f" -o "${f%.md}.pdf"; done
```

**Marp frontmatter template:**

```yaml
---
marp: true
theme: default
paginate: true
header: 'Company Name | Section'
footer: '© 2025 Company Name'
---
```

**Key points:**
- Requires `marp: true` in frontmatter
- `header` and `footer` control branding on every slide
- Use `---` to separate slides
- Supports markdown tables, code blocks, images

3. **Execute the conversion**:
    - Run the appropriate command
    - Verify output file was created
    - Check file size is reasonable

## Example Workflows

### Scenario 1: Convert documentation to PDF

```
User: "Convert internal-aws-training.mdx to PDF"

1. Identify: MDX file → Document PDF
2. Command: npx md-to-pdf internal-aws-training.mdx
3. Output: internal-aws-training.pdf in same directory
```

### Scenario 2: Generate slides with custom branding

```
User: "Update the training slides to use company branding"

1. Edit Marp markdown frontmatter:
   header: 'Wishket | Session 1'
   footer: '© 2025 Wishket'

2. Regenerate PDF:
   npx @marp-team/marp-cli session-1.md -o session-1-slides.pdf
```

### Scenario 3: Batch convert all slide files

```
User: "Regenerate all 5 session PDFs"

1. Navigate to markdown source directory
2. Run batch command:
   for f in *.md; do
     npx @marp-team/marp-cli "$f" -o "../output/${f%.md}-slides.pdf"
   done
3. Verify all PDFs were created
```

## Tool Reference

### md-to-pdf

| Feature | Support |
|---------|---------|
| Input formats | `.md`, `.mdx` |
| GitHub markdown | Yes |
| Custom CSS | Yes (via config) |
| Table of contents | Yes |
| Code highlighting | Yes |

**Common options:**
```bash
# With custom stylesheet
npx md-to-pdf input.md --stylesheet style.css

# With config file
npx md-to-pdf input.md --config-file .md2pdf.js
```

### Marp CLI

| Feature | Support |
|---------|---------|
| Output formats | PDF, PPTX, HTML, PNG |
| Themes | default, gaia, uncover |
| Custom CSS | Yes |
| Speaker notes | Yes |
| Background images | Yes |

**Common options:**
```bash
# Output as PPTX
npx @marp-team/marp-cli input.md -o output.pptx

# Output as HTML
npx @marp-team/marp-cli input.md -o output.html

# Use custom theme
npx @marp-team/marp-cli input.md --theme custom.css -o output.pdf

# Watch mode for development
npx @marp-team/marp-cli -w input.md
```

## Decision Tree

```
Need to generate PDF from markdown?
│
├─ Is it a presentation/slides?
│  │
│  ├─ YES → Use Marp CLI
│  │        - Add marp: true frontmatter
│  │        - Configure header/footer for branding
│  │        - npx @marp-team/marp-cli input.md -o output.pdf
│  │
│  └─ NO → Use md-to-pdf
│          - Works with .md and .mdx directly
│          - npx md-to-pdf input.mdx
│
└─ Need other format? (PPTX, HTML)
   └─ Use Marp CLI with appropriate -o extension
```

## Common Mistakes

### ❌ Using wrong tool for file type

```bash
# WRONG: mdpdf requires .md extension
npx mdpdf file.mdx  # Error!

# CORRECT: md-to-pdf handles .mdx
npx md-to-pdf file.mdx  # Works!
```

### ❌ Creating duplicate source files

```bash
# WRONG: Copying MDX to MD before converting
cp file.mdx file.md && npx mdpdf file.md

# CORRECT: Use md-to-pdf directly
npx md-to-pdf file.mdx
```

### ❌ Missing Marp frontmatter

```markdown
# WRONG: No marp directive
---
title: My Slides
---

# CORRECT: Include marp: true
---
marp: true
title: My Slides
---
```

### ❌ Forgetting to check existing source files

```bash
# WRONG: Creating new markdown files when they already exist
# Always check first:
ls -la **/session-markdowns/
ls -la **/*.md
```

## Project Configuration Location

⚠️ **CRITICAL: Configuration File Management** ⚠️

This skill is a **git submodule** shared across multiple projects.

**Priority order:**

1. **Project-specific configuration** (PRIMARY): `.claude/config/doc-generator.yaml`
2. **Default configuration** (FALLBACK): Use tools with default settings

**Example configuration:**

```yaml
# .claude/config/doc-generator.yaml

# Default tool preferences
document_pdf_tool: md-to-pdf
slides_tool: marp-cli

# Marp defaults
marp:
  theme: default
  header_template: "{company} | {section}"
  footer_template: "© {year} {company}"
  company: "Wishket"

# Output directories
output:
  documents: "./output/docs"
  slides: "./output/slides"
```

## Integration with Other Skills

- **conventional-commits**: After generating new PDFs, commit changes with appropriate message
- **maintaining-documentation**: Update documentation references when PDF locations change

## Notes

- Always check for existing markdown source files before creating new ones
- `md-to-pdf` is more flexible with file extensions than `mdpdf`
- Marp requires frontmatter with `marp: true` to enable slide mode
- Batch operations are efficient for multiple files
- Keep markdown sources in version control, regenerate PDFs as needed