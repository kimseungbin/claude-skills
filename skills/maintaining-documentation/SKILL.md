---
name: maintaining-documentation
description: |
  Maintain documentation system (CLAUDE.md, README.md, docs/) synchronized with code changes.
  Use when modifying code structure, adding features, or changing patterns/conventions.
---

# Maintaining Documentation System

This skill ensures your entire documentation system stays synchronized with code changes by guiding you through updates to CLAUDE.md, README.md, and docs/ files.

## Core Principle

**Code and documentation MUST be updated in the same commit.**

Never create separate commits for code and documentation. This prevents documentation drift and maintains Git history integrity.

## Documentation System Overview

Modern codebases maintain multiple documentation files for different audiences:

| File/Directory | Audience | Purpose | Language |
|----------------|----------|---------|----------|
| **CLAUDE.md** | AI (Claude Code) | Codebase guide with actionable instructions | Usually English |
| **README.md** | Human developers | Project overview, quick start | Project-specific |
| **docs/** | Human developers | Detailed guides, references, planning | Project-specific |
| **Architecture diagrams** | Human developers | Visual system design | Visual + text |

## Instructions

### Step 1: Determine Project Type

Check `.claude/config/maintaining-documentation.yaml` to find the implementation guide:

```yaml
implementation: cdk-infrastructure  # or react-frontend, python-backend, etc.
```

**Read the implementation guide** for project-specific categories, mappings, and examples.

### Step 2: Identify What Changed

Based on your implementation guide, categorize your changes:

- What code did you modify?
- Which category does it fall into? (defined in implementation guide)
- What documentation might be affected?

**Consult your implementation guide** for category definitions and examples.

### Step 3: Determine Documentation Impact

Use the decision tree from your implementation guide:

**For each change, ask:**
1. Does this affect AI understanding of codebase? → Update CLAUDE.md
2. Does this affect human onboarding/overview? → Update README.md
3. Does this need comprehensive explanation? → Create/update docs/
4. Does this change visual architecture? → Update diagrams

**Your implementation guide provides specific mappings** for your project type.

### Step 4: Update CLAUDE.md (If Needed)

CLAUDE.md is for AI to understand the codebase.

**Update when:**
- Code structure changes (directories, modules, components)
- New patterns/conventions introduced
- Deployment/build process changes
- New tools/frameworks added

**Guidelines:**
- Keep descriptions concise and actionable
- Use imperative tone ("Do X", "Use Y when Z")
- Include file paths, not configuration details
- Link to docs/ for comprehensive guides

**Configuration Principle:**
- DO NOT document configuration values in CLAUDE.md
- ONLY document file paths where configuration can be read
- Rationale: Configuration changes frequently; paths are stable

### Step 5: Update README.md (If Needed)

README.md is for human developers to understand the project.

**Update when:**
- Adding major new features
- Creating new docs/ guides (add to documentation index)
- Changing project overview or tech stack
- Modifying quick start procedures
- Changing installation/setup process

**Guidelines based on implementation guide:**
- Follow language conventions (English, Korean, etc.)
- Keep scannable (headings, bullets, short paragraphs)
- Link to docs/ for detailed information
- Use examples and visuals where helpful

### Step 6: Create/Update docs/ Files (If Needed)

Create new docs/ files for:
- Comprehensive guides (>100 lines, step-by-step procedures)
- Technical reference documentation (API docs, architecture details)
- Planning documents (backlogs, roadmaps, feature specs)
- How-to guides for complex workflows

**Always link new docs/ files from:**
- README.md documentation section
- CLAUDE.md documentation index

#### docs/ Organization Strategy

Choose organization based on how documentation will be **used**, not just what it **contains**.

**Option A: Topic-Based (Traditional)**

```
docs/
├── guides/           # How-to guides
├── reference/        # Technical references
├── planning/         # Roadmaps, backlogs
└── architecture/     # System design docs
```

**Best for:** General-purpose documentation, human-browsable structures.

**Option B: Task-Oriented (Recommended for AI)**

```
docs/
├── pre-deployment/      # Check BEFORE deploying
├── safe-changes/        # When modifying existing code
├── writing-code/        # When creating new resources
├── reference/           # Background knowledge
└── troubleshooting/     # When things go wrong
```

**Best for:** AI-consumed documentation where Claude Code needs to find the right doc quickly.

**Why task-oriented works better for AI:**
- Directory names answer "when do I need this?"
- Reduces search time - Claude knows which directory to check based on current task
- Self-documenting structure - no need to explain when to use each doc

**Choosing directory names:**

| Task/Scenario | Directory Name |
|---------------|----------------|
| Before running a command | `pre-{command}/` (e.g., `pre-deployment/`) |
| When modifying existing code | `safe-changes/`, `refactoring/` |
| When creating new things | `writing-code/`, `creating/` |
| When something breaks | `troubleshooting/`, `debugging/` |
| Background reading | `reference/`, `fundamentals/` |

**Centralized Navigation with docs/README.md:**

When using task-oriented structure, create `docs/README.md` as a navigation index:

```markdown
# Documentation Index

## Quick Lookup: Which Docs Do I Need?

| Scenario | Directory | Docs |
|----------|-----------|------|
| Before deploying | `pre-deployment/` | testing.md, validation.md |
| Refactoring code | `safe-changes/` | safety-guide.md, checklist.md |
| Writing new code | `writing-code/` | patterns.md, best-practices.md |
```

**Benefits of docs/README.md:**
- Single file to read for navigation (token-efficient)
- Individual docs don't need "Related Documentation" sections
- One place to update when structure changes
- SKILL.md or CLAUDE.md can simply point to `docs/README.md`

**Anti-pattern: "Related Documentation" in every file**

```markdown
# ❌ Don't add this to every doc file
## Related Documentation
- See also: other-doc.md
- Related: another-doc.md
```

**Why it's problematic:**
- Duplicates navigation across all files
- Paths break when files move
- Maintenance burden grows with each new doc

**Solution:** Centralize navigation in `docs/README.md` instead

### Step 7: Update Other Documentation (If Needed)

Depending on project type, you may have:
- Architecture diagrams (C4, UML, etc.)
- API documentation (OpenAPI, GraphQL schemas)
- Database schemas
- Deployment diagrams

**Consult implementation guide** for project-specific documentation types.

### Step 8: Verify Documentation Consistency

Run verification checks:

```bash
# Search for mentions of changed code
grep -rn "keyword" CLAUDE.md README.md docs/

# Check for broken links
# (Implementation guide provides project-specific checks)

# Verify critical sections updated
# (Specific sections depend on project type)
```

### Step 9: Commit Code and Documentation Together

**CRITICAL:** Include both code and documentation changes in the same commit.

Use the `commit-expert` subagent:

```
type(scope): Brief description

- Code change description
- Code change description
- Update CLAUDE.md [specific sections]
- Update README.md [if applicable]
- Add/update docs/[filename] [if created/modified]
```

**Example:**
```bash
git commit -m "feat(auth): Add OAuth2 authentication

- Implement OAuth2 flow with PKCE
- Add OAuth2 provider configuration
- Update CLAUDE.md authentication section
- Update README.md with OAuth2 setup instructions
- Add docs/guides/OAUTH2_SETUP.md detailed guide"
```

## Common Mistakes to Avoid

### ❌ Separate Commits for Documentation

```bash
# WRONG
git commit -m "feat: Add new feature"
git commit -m "docs: Update documentation"
```

**Why wrong:** Git history separates code and docs. Cherry-picking causes drift.

**Solution:** Single commit with both changes.

### ❌ Updating Only One Documentation File

Updating CLAUDE.md but forgetting README.md or docs/.

**Why wrong:** Incomplete documentation update. Different audiences left unsynchronized.

**Solution:** Check all relevant documentation files per implementation guide.

### ❌ Documenting Configuration Details

```markdown
# WRONG
- Feature X: enabled in production, disabled in dev
- API timeout: 30 seconds
- Database: PostgreSQL 14.2
```

**Why wrong:** Configuration values change frequently.

**Solution:** Document file paths only: "Configuration in `config/settings.yaml`"

### ❌ Creating docs/ Without Links

Creating documentation files but not linking from README.md or CLAUDE.md.

**Why wrong:** Documentation becomes orphaned and undiscoverable.

**Solution:** Always add links to documentation indexes.

### ❌ Inconsistent Terminology

Using different terms in CLAUDE.md, README.md, and docs/ for the same concept.

**Why wrong:** Confuses both AI and human readers.

**Solution:** Establish terminology in implementation guide and use consistently.

### ❌ Outdated References

Documentation references line numbers, file paths, or sections that no longer exist.

**Why wrong:** Breaks navigation and understanding.

**Solution:** Periodically verify references using `grep -rn`.

## Documentation Audiences

Remember: Different files serve different audiences.

### CLAUDE.md - For AI
- **Purpose:** Help AI understand codebase structure and conventions
- **Tone:** Imperative, direct ("Do X", "Use Y")
- **Content:** File paths, patterns, constraints, tool usage
- **Length:** Concise, scannable
- **Updates:** When code structure or patterns change

### README.md - For Human Developers
- **Purpose:** Project overview and quick start
- **Tone:** Friendly, explanatory ("This project does X")
- **Content:** What, why, how to get started
- **Length:** Brief (< 200 lines), with links to docs/
- **Updates:** When major features added or setup changes

### docs/ - For Deep Dives
- **Purpose:** Comprehensive guides and references
- **Tone:** Educational, detailed
- **Content:** Step-by-step procedures, architecture explanations
- **Length:** As long as needed (100-1000+ lines)
- **Updates:** When complex features added or processes change

## Project Configuration Location

⚠️ **CRITICAL: Configuration File Management** ⚠️

This skill is a **git submodule** shared across projects.

**Configuration Pattern:**

1. **Skill (READ-ONLY, shared):** `.claude/skills/maintaining-documentation/`
2. **Implementation guides (READ-ONLY, shared):**
   - `.claude/skills/maintaining-documentation/cdk-infrastructure.md`
   - `.claude/skills/maintaining-documentation/react-frontend.md`
   - `.claude/skills/maintaining-documentation/python-backend.md`
3. **Project config (WRITABLE, project-specific):** `.claude/config/maintaining-documentation.yaml`

**Config file specifies:**
- Implementation guide to use
- Project-specific category names
- Documentation section mappings
- File path patterns
- Language preferences

**To customize for your project:**

1. Check available implementation guides in skill directory
2. Copy config template to `.claude/config/maintaining-documentation.yaml`
3. Set `implementation` field to appropriate guide
4. Override categories/mappings as needed
5. Specify project-specific file paths

## Integration with Other Skills

**Works well with:**
- **conventional-commits**: Use for creating properly formatted commit messages
- **pull-request-management**: Reference when creating PRs with documentation updates
- **Project-specific skills**: Chain with domain-specific skills (e.g., `cdk-expert`, `react-patterns`)

**Automatic invocation:**
- Can be triggered when key files are modified
- Can be part of pre-commit hooks (future)

## Implementation Guides Available

Check skill directory for available implementation guides:

- **cdk-infrastructure.md** - AWS CDK / Infrastructure as Code projects
- **react-frontend.md** - React / Frontend applications
- **python-backend.md** - Python / Backend services
- **config-template.yaml** - Blank template to create new implementation type

**To create new implementation guide:**
See `skill-creator` skill for guidance on extending this skill for new project types.

## Notes

- **Synchronize ALL documentation** - Not just CLAUDE.md
- **Different audiences, different needs** - AI vs human documentation differs
- **Configuration lives in files** - Document paths, not values
- **Consistency matters** - Use same terminology across all docs
- **Links prevent orphans** - Always cross-reference documentation files
- **Commit together** - Code + documentation in same commit, always
