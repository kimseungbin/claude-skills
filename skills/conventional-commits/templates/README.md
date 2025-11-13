# Conventional Commits Configuration Templates

This directory contains **decision-tree based configuration templates** for minimal-context loading.

## Purpose

Instead of loading one large configuration file (500+ lines), the skill uses a **split configuration pattern** where:
- **Main config** (80 lines) loaded every time
- **Detailed files** (50-100 lines each) loaded only when needed

**Result**: 79% context reduction (515 → 110 lines average)

## Directory Structure

```
templates/
├── README.md                    # This file
├── main.yaml                    # Main config template (slim, pointers to detailed files)
├── types/                       # Type decision trees
│   ├── feat.yaml               # When to use feat
│   ├── fix.yaml                # When to use fix
│   ├── refactor.yaml           # When to use refactor
│   ├── docs.yaml               # When to use docs
│   └── chore.yaml              # When to use chore (vs feat for infrastructure)
├── scopes/                      # Scope patterns
│   ├── infrastructure.yaml     # Infrastructure construct scopes
│   ├── configuration.yaml      # Config and type scopes
│   ├── documentation.yaml      # Documentation scopes
│   └── tooling.yaml            # Developer tooling scopes
├── examples/                    # Example commits
│   ├── infrastructure.yaml     # Infrastructure examples
│   ├── documentation.yaml      # Documentation examples
│   └── deployment-approval.yaml # Commits with Safe-To-Deploy footers
└── guides/                      # Quality guides
    ├── specificity.yaml        # Title quality checklist
    └── title-patterns.yaml     # Good/bad title patterns
```

## How LLM Uses This (Corrected Decision Tree Pattern)

### Key Design Principle

**CRITICAL**: The complete type decision tree lives in `main.yaml`, NOT in individual type files.

**Why?** If type decision logic is in type files (feat.yaml, chore.yaml, etc.), the LLM would need to read ALL type files to make a decision. This defeats the purpose of minimal-context loading.

**Correct Approach**:
- `main.yaml`: Contains COMPLETE type decision tree (90% of decisions made here)
- `types/*.yaml`: Contains only edge cases, examples, and antipatterns (loaded 5-10% of time)

### Scenario 1: Common commit (90% of cases)

**LLM reads**: `main.yaml` only (168 lines)

```yaml
# main.yaml contains COMPLETE type decision tree
type_decision_tree:
  - question: "What are you doing?"
    answers:
      adding_new_capability: "feat - New feature or infrastructure for applications"
      fixing_bug: "fix - Bug fix that corrects incorrect behavior"
      changing_code_structure: "refactor - Code change (neither bug fix nor feature)"
      updating_docs_only: "docs - Documentation changes with no code changes"
      updating_dependencies: "chore - Dependency updates (chore(deps) or chore(monorepo))"

  - question: "Infrastructure project - what does it serve?"
    for_applications: "feat"
    for_deployment: "chore(deployment)"
    for_development: "chore(tools)"
```

**LLM decides**: refactor(service) - done, no additional files needed

**Total context**: 168 lines (main.yaml only)

---

### Scenario 2: Edge case unclear (5-10% of cases)

**LLM reads**: `main.yaml` (168 lines) → Decision tree says "See types/chore.yaml for edge cases"

**LLM loads**: `types/chore.yaml` (74 lines)

```yaml
# types/chore.yaml - edge cases ONLY (no primary decision tree)
edge_cases:
  - scenario: "Adding monitoring dashboard for applications"
    decision: "feat(monitoring) - applications use this to monitor themselves"

  - scenario: "Adding monitoring for deployment pipeline"
    decision: "chore(deployment) - this monitors deployment, not applications"
```

**LLM confirms**: chore(deployment) based on edge case guidance

**Total context**: 168 + 74 = 242 lines

---

### Scenario 3: Need examples (3% of cases)

**LLM reads**: `main.yaml` → "See examples/infrastructure.yaml"

**LLM loads**: `examples/infrastructure.yaml` (100 lines)

**LLM finds**: Similar pattern, total context: 180 lines

---

### Scenario 4: Quality check (2% of cases)

**LLM reads**: `main.yaml` → "See guides/specificity.yaml"

**LLM loads**: `guides/specificity.yaml` (60 lines)

**LLM validates**: Title specificity, total context: 140 lines

---

## For Project Setup

Copy this template structure to your project:

```bash
# Create project config directory
mkdir -p .claude/config/conventional-commits

# Copy main config
cp .claude/skills/conventional-commits/templates/main.yaml \
   .claude/config/conventional-commits.yaml

# Copy detailed files (customize for your project)
cp -r .claude/skills/conventional-commits/templates/types \
      .claude/config/conventional-commits/

cp -r .claude/skills/conventional-commits/templates/scopes \
      .claude/config/conventional-commits/

cp -r .claude/skills/conventional-commits/templates/examples \
      .claude/config/conventional-commits/

cp -r .claude/skills/conventional-commits/templates/guides \
      .claude/config/conventional-commits/
```

Then customize for your project:
- Update `scopes/*.yaml` with your file patterns
- Add project-specific examples
- Adjust type decision trees if needed

## File Format: YAML

All files use YAML format for:
- **Structured data** - LLM can parse easily
- **Minimal syntax** - Less noise than JSON
- **Comments supported** - Can add guidance inline
- **Standard format** - Consistent across all files

## When to Read Each Directory

**LLM decision flow:**

1. **Always read**: `main.yaml` (quick reference + pointers)
2. **Read types/ when**: Unclear which type to use (feat vs chore, docs vs refactor)
3. **Read scopes/ when**: Multiple files changed, unclear scope, multi-scope commit
4. **Read examples/ when**: Need similar commit pattern, new contributor, complex change
5. **Read guides/ when**: Quality check needed, title validation, best practices

## Context Optimization Results

**Monolithic config** (old approach):
```
conventional-commits.yaml: 515 lines
Loaded: Every commit
Average context: 515 lines
```

**Split config** (this approach):
```
main.yaml: 80 lines (always)
types/*.yaml: 50 lines (5% of time)
scopes/*.yaml: 60 lines (5% of time)
examples/*.yaml: 100 lines (3% of time)
guides/*.yaml: 60 lines (2% of time)

Average context: (0.90 × 80) + (0.05 × 130) + (0.03 × 180) + (0.02 × 140)
               = 72 + 6.5 + 5.4 + 2.8
               = 87 lines (83% reduction)
```

## Benefits

**For LLM**:
- Load only what's needed
- Faster context parsing
- Clear navigation structure
- Reduced token usage

**For Developers**:
- Easier to update specific sections
- Clear organization
- Better maintainability
- Self-documenting structure

**For Projects**:
- Customize only relevant parts
- Keep templates up to date (pull from submodule)
- Project-specific additions in separate files
- Version control friendly (small diffs)

## Related Documentation

- **Main skill README**: `../README.md` - LLM reading scenarios for hooks
- **SKILL.md**: `../SKILL.md` - How skill loads and uses these templates
- **Hooks**: `../hooks/` - Git hooks integration documentation