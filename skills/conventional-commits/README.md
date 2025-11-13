# Conventional Commits Skill

This skill generates commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) specification with intelligent multi-commit splitting and project-specific rules.

## For Humans: Quick Start

**Usage**: Simply ask Claude to commit your changes:
```
"Commit the changes"
"Create a commit for these changes"
```

**Customization**: Create `.claude/config/conventional-commits.yaml` for project-specific rules (see SKILL.md for details).

**Features**:
- Smart commit splitting across multiple scopes
- Interactive selection via terminal checkboxes
- Auto scope detection from file paths
- Conventional Commits spec compliance

For complete instructions, see [SKILL.md](SKILL.md).

---

## For LLMs: Understanding This Skill's Architecture

This README explains how this skill is structured for **minimal context loading**. This design pattern should be used when creating new skills to optimize LLM token usage.

### Design Philosophy: Minimal Context Loading

**Problem**: Skills with all documentation inline in SKILL.md waste tokens when LLM only needs specific information.

**Solution**: Extract specialized content to dedicated files, reference them from SKILL.md, LLM reads them **only when needed**.

**Key Principle**: SKILL.md contains what the LLM needs 90% of the time. Specialized files handle edge cases.

### File Structure

```
conventional-commits/
├── README.md                    # This file - explains architecture (for skill creators)
├── SKILL.md                     # Main entry point (for LLM skill execution)
├── commit-rules.yaml            # Default commit rules (fallback)
├── commit-rules.template.yaml   # Template for new projects
├── infrastructure.md            # Implementation guide for IaC projects
└── hooks/                       # Git hooks integration (loaded on-demand)
    ├── commit-msg.md           # Commit format validation details
    └── pre-push.md             # Deployment safety footers
```

**Key insight**: LLM reads SKILL.md → sees reference to hooks/*.md → **only reads if user's situation requires it**.

### LLM Reading Scenarios

#### Scenario 1: User Invokes `/commit` (Common Case - 90%)

**Context**: User made changes, wants to create commit

**LLM reads**:
1. `SKILL.md` (entry point)
   - Commit format rules
   - Type/scope decision trees
   - Multi-commit splitting logic
   - Standard footer format

**LLM does NOT read**:
- `hooks/commit-msg.md` (only needed if validation fails)
- `hooks/pre-push.md` (only needed if deployment blocked)

**Result**: LLM generates commit message with ~270 lines of context instead of ~600+ if all hook docs were inline.

**Token savings**: ~60% reduction in context for common case.

---

#### Scenario 2: Commit-msg Hook Rejected Commit (Rare - 5%)

**Context**: User ran `git commit`, hook validation failed

**User message**: "My commit was rejected by the hook. Here's the error: [error message]"

**LLM reads**:
1. `SKILL.md` - sees section "Commit Message Validation"
   - Brief explanation: Hook validates footer tags
   - Reference: "For complete details: See hooks/commit-msg.md"
   - When to read: "Commit-msg hook rejected your commit"
2. `hooks/commit-msg.md` - loads detailed validation rules
   - Hook implementation code
   - Footer format requirements
   - Troubleshooting validation failures
   - Bypass instructions

**LLM diagnoses**: "Your commit is missing the `Skill: conventional-commits` footer"

**Why this works**: SKILL.md tells LLM **when** to load detailed docs, not forcing all details upfront.

---

#### Scenario 3: Pre-push Hook Blocked Deployment (Rare - 5%)

**Context**: User pushed to master, pre-push hook detected resource replacement

**User message**: "My push was blocked. Hook says I need a deployment approval footer. Can you help?"

**LLM reads**:
1. `SKILL.md` - sees section "Deployment Safety (pre-push hook)"
   - Brief explanation: Infrastructure safety validation
   - Footer format sample
   - Quick workflow: Use analyze script
   - Reference: "For complete details: See hooks/pre-push.md"
   - When to read: "Pre-push hook blocked your deployment"
2. `hooks/pre-push.md` - loads deployment footer documentation
   - Complete footer field definitions
   - All optional fields
   - Integration with analyze-and-approve-deployment.sh script
   - Troubleshooting footer validation
   - Manual vs automated workflow

**LLM suggests**: "Run `./scripts/analyze-and-approve-deployment.sh` to generate the footer automatically"

**Why this works**: Deployment footers are infrastructure-specific and rarely needed. No point loading 300 lines of deployment docs for every commit.

---

#### Scenario 4: LLM Proactively Creating Infrastructure Commit

**Context**: LLM refactored CDK code, needs to create commit automatically

**LLM reads**:
1. `SKILL.md` - has enough context to create commit
   - Infrastructure type/scope from `infrastructure.md`
   - Basic footer format
   - Reference to hooks/ files

**LLM decides**:
- "I'll create normal commit with `Skill: conventional-commits` footer"
- "If pre-push hook blocks, user will see error and I'll help then"
- "No need to preemptively load deployment footer docs"

**Why this works**: Reactive approach better than loading all possible edge cases upfront.

---

### Context Usage Comparison

#### Before Extraction (All Inline in SKILL.md)

```
SKILL.md: ~600 lines
├── Basic commit workflow: 200 lines
├── Commit-msg hook details: 150 lines  ← Always loaded, rarely needed
└── Deployment footer details: 250 lines ← Always loaded, rarely needed
```

**Every `/commit` invocation**: LLM loads 600 lines, uses 200.

---

#### After Extraction (Dedicated Files)

```
SKILL.md: ~270 lines (90% case)
├── Basic commit workflow: 200 lines
├── Hook integration: 50 lines (brief, with references)
└── References to hooks/*.md (loaded on-demand)

hooks/commit-msg.md: ~230 lines (5% case)
└── Only loaded when validation fails

hooks/pre-push.md: ~400 lines (5% case)
└── Only loaded when deployment blocked
```

**Common case**: LLM loads 270 lines
**Validation failure**: LLM loads 270 + 230 = 500 lines
**Deployment blocked**: LLM loads 270 + 400 = 670 lines

**Average across all use cases**: ~320 lines (47% reduction from 600)

---

### Best Practices for Skill Creation

Based on this skill's architecture, follow these patterns when creating new skills:

#### 1. SKILL.md Should Contain

- **Core instructions** for 80-90% of use cases
- **Brief summaries** of advanced features
- **Clear references** to detailed files ("For X, see Y.md")
- **When to read** guidance ("Read this file when...")

**Example from this skill**:
```markdown
**For complete details:** See [hooks/pre-push.md](hooks/pre-push.md)
**When to read:** Pre-push hook blocked your deployment due to resource replacement.
```

#### 2. Extract to Dedicated Files

**What to extract**:
- Edge case handling (errors, failures, troubleshooting)
- Implementation details (hook code, validation logic)
- Deep domain knowledge (infrastructure-specific conventions)
- Reference material (all footer fields, all validation rules)

**What to keep inline**:
- Basic workflow that LLM needs every time
- Decision trees for type/scope selection
- Common examples
- Quick-reference format patterns

#### 3. File Naming Convention

Use descriptive names that indicate **when** the file is needed:

- `hooks/commit-msg.md` - Clear it's about commit-msg hook
- `hooks/pre-push.md` - Clear it's about pre-push hook
- `infrastructure.md` - Clear it's for infrastructure projects

**Avoid**:
- Generic names: `details.md`, `advanced.md`, `reference.md`
- LLM can't determine when to load these

#### 4. Cross-Reference Patterns

**Good** (explicit when-to-read guidance):
```markdown
**For complete details:** See [hooks/pre-push.md](hooks/pre-push.md)
**When to read:** Pre-push hook blocked your deployment
```

**Bad** (no context for when to load):
```markdown
See hooks/pre-push.md for more information.
```

#### 5. Nested Directories for Related Content

```
hooks/
├── commit-msg.md       # Related to commit-time validation
└── pre-push.md         # Related to push-time validation
```

**Benefits**:
- Groups related documentation
- LLM can scan directory structure
- Easy to find related files

---

### How LLM Decides What to Read

#### Decision Flow

1. **User invokes skill** → LLM reads `SKILL.md`
2. **SKILL.md provides context** → LLM executes basic workflow
3. **If special situation** (hook failure, blocked deployment):
   - SKILL.md mentions the situation
   - SKILL.md references detailed file
   - LLM reads detailed file for specific context
4. **LLM uses detailed context** → Diagnoses and helps user

#### SKILL.md as Router

Think of SKILL.md as a **router** that directs LLM to specialized documentation:

```
SKILL.md:
"Pre-push hook blocked? → See hooks/pre-push.md"
"Commit validation failed? → See hooks/commit-msg.md"
"Infrastructure project? → See infrastructure.md"
```

**Not** a comprehensive reference containing everything (old approach).

---

### Testing Context Optimization

#### Before Making Changes

Count lines LLM would need to read for common scenario:

```bash
# Count SKILL.md lines
wc -l SKILL.md

# Count inline hook documentation
grep -A 100 "## Git Hooks" SKILL.md | wc -l
```

#### After Extraction

Count lines for each scenario:

```bash
# Scenario 1: Normal commit (common case)
wc -l SKILL.md
# Target: <300 lines

# Scenario 2: Validation failure (rare)
wc -l SKILL.md hooks/commit-msg.md
# Target: <500 lines

# Scenario 3: Deployment blocked (rare)
wc -l SKILL.md hooks/pre-push.md
# Target: <700 lines
```

#### Calculate Weighted Average

```
Weighted Avg = (P1 × Lines1) + (P2 × Lines2) + (P3 × Lines3)

Where:
  P1 = Probability of scenario 1 (90% = 0.9)
  P2 = Probability of scenario 2 (5% = 0.05)
  P3 = Probability of scenario 3 (5% = 0.05)
```

**This skill**:
```
Weighted Avg = (0.9 × 270) + (0.05 × 500) + (0.05 × 670)
             = 243 + 25 + 33.5
             = 301.5 lines

Compared to inline approach:
Weighted Avg = 1.0 × 600 = 600 lines

Reduction: 50%
```

---

### Anti-Patterns to Avoid

#### ❌ Anti-Pattern 1: Dumping Everything in SKILL.md

```markdown
# SKILL.md (1000+ lines)

## Instructions
... 200 lines ...

## Commit-msg Hook Implementation
... 300 lines of hook code, validation rules, troubleshooting ...

## Pre-push Hook Implementation
... 400 lines of deployment footers, all fields, all scenarios ...
```

**Problem**: LLM loads 1000 lines for every commit, even though 80% is irrelevant.

---

#### ❌ Anti-Pattern 2: Extracting Without Clear References

```markdown
# SKILL.md

## Instructions
... basic workflow ...

See advanced-topics.md for more.
```

**Problem**: LLM doesn't know **when** to read `advanced-topics.md`. Too vague.

**Fix**: "If pre-push hook blocks deployment, see hooks/pre-push.md"

---

#### ❌ Anti-Pattern 3: Over-Extraction

```markdown
# SKILL.md (50 lines)

See commit-workflow.md for workflow.
See type-selection.md for types.
See scope-selection.md for scopes.
See footer-format.md for footers.
```

**Problem**: LLM must read 4+ files for basic task. Context overhead too high.

**Fix**: Keep essential workflow inline, extract only edge cases.

---

#### ❌ Anti-Pattern 4: Generic File Names

```
skill/
├── SKILL.md
├── details.md          # What details?
├── reference.md        # Reference for what?
└── advanced.md         # Advanced what?
```

**Problem**: LLM can't determine which file has needed information.

**Fix**: Descriptive names linked to situations (hooks/commit-msg.md, hooks/pre-push.md).

---

### Measuring Success

Good minimal-context skill design achieves:

1. **High hit rate for SKILL.md alone**: 80-90% of invocations don't need additional files
2. **Clear routing**: Remaining 10-20% know exactly which file to read
3. **Minimal redundancy**: Information appears in exactly one place
4. **Contextual loading**: LLM loads only what's needed for current situation

**Metrics**:
- **Common case context**: <300 lines (SKILL.md alone)
- **Average weighted context**: <400 lines (across all scenarios)
- **Maximum context**: <800 lines (worst case - all files loaded)

---

## Summary for Skill Creators

When creating a new skill:

1. **Start with SKILL.md**: Write complete workflow inline
2. **Identify extraction candidates**:
   - Error handling and troubleshooting (rarely needed)
   - Implementation details (only needed when debugging)
   - Domain-specific guides (only needed for specific project types)
   - Comprehensive field references (only needed when blocked)
3. **Extract to dedicated files**: Use descriptive names tied to situations
4. **Update SKILL.md**: Replace extracted content with:
   - Brief summary (2-3 sentences)
   - Clear reference to detailed file
   - **When to read** guidance
5. **Test context usage**: Measure lines loaded for common vs rare scenarios
6. **Optimize balance**: Aim for 80-90% hit rate on SKILL.md alone

**Goal**: LLM gets what it needs, when it needs it, without excess context.

---

## Related Documentation

- **For LLM skill execution**: See [SKILL.md](SKILL.md)
- **For commit validation**: See [hooks/commit-msg.md](hooks/commit-msg.md)
- **For deployment safety**: See [hooks/pre-push.md](hooks/pre-push.md)
- **For infrastructure projects**: See [infrastructure.md](infrastructure.md)

---

## Version History

- **v1.0** (2025-01-13): Initial extraction-based architecture
  - Extracted commit-msg hook validation to hooks/commit-msg.md
  - Extracted deployment safety footers to hooks/pre-push.md
  - SKILL.md reduced from ~600 to ~270 lines
  - 50% context reduction for common case
