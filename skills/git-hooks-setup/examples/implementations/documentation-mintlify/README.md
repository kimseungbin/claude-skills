# Implementation Example: Documentation Repository with Mintlify

Real-world git hooks implementation from the AWS SMB Competency case studies project.

## Project Overview

- **Type**: Documentation-only repository with Mintlify rendering
- **Content**:
    - AWS SMB Competency case studies (Korean + English translations)
    - AWS competency requirements documentation
    - Mintlify-based documentation site
- **Tech Stack**: Mintlify (MDX), Node.js, Git hooks, Claude Code skills
- **Team Size**: Individual developer (AWS partner)
- **Purpose**: AWS Partner Network competency validation

## Hook Configuration

### Pre-commit Hook

**Location**: `.githooks/pre-commit` (see `pre-commit` file in this directory)

**Checks**:

1. **MDX HTML Entity Validation** (blocking)
    - Detects unescaped HTML entities (`<$`) that break MDX parsing
    - Example error: `<$100M` interpreted as HTML tag by Mintlify
    - Fix: Use HTML entities (`&lt;$100M`)
    - Time: <1s
    - Result: Blocks commit, requires manual fix

2. **File Size Warning** (non-blocking)
    - Warns about files >100KB
    - Suggests splitting large case studies
    - Time: <1s
    - Result: Warning only, doesn't block

3. **AWS Service Name Consistency** (non-blocking)
    - Checks for common typos: "Cloudfront" vs "CloudFront"
    - Suggests using official AWS service names
    - Time: <1s
    - Result: Warning only, doesn't block

**Total Time**: <3 seconds ✅

### Commit-msg Hook

**Location**: `.githooks/commit-msg` (see `commit-msg` file in this directory)

**Checks**:

1. **Commit Expert Agent Enforcement** (blocking)
    - Requires `Agent: commit-expert` footer tag in commit message
    - Ensures all commits use the commit-expert agent
    - Blocks direct `git commit` usage
    - Encourages consistent commit format across team
    - Time: <1s
    - Result: Blocks commit if footer missing

**Emergency Bypass**: `git commit --no-verify` (logged and discouraged)

## Design Decisions

### Why Block on MDX Parsing Errors?

**Problem**: Mintlify's strict MDX parser interprets `<$100M` as an HTML tag opening, causing build failures.

**Solution**: Pre-commit hook catches these before commit.

**Pattern Used**:

```bash
# Check for <$ which breaks MDX parsing (except already escaped &lt;)
if git show :"$FILE" | grep -v '&lt;' | grep -q '<\$'; then
    echo -e "${RED}❌ Found unescaped '<\$' in $FILE${NC}"
    echo -e "${YELLOW}   Replace '<\$100M' with '&lt;\$100M'${NC}"
    MDX_ERROR=1
fi
```

**Benefits**:
- Prevents broken Mintlify builds
- Catches errors early (before CI)
- Clear error messages with fix instructions

### Why Non-blocking File Size Warnings?

**Decision**: Large files generate warnings but don't block commits.

**Reasons**:

1. **Context matters**: Some case studies legitimately need more detail
2. **User judgment**: Developer can decide if splitting makes sense
3. **Not a build error**: Large files don't break Mintlify

**Pattern Used**:

```bash
SIZE=$(wc -c < "$FILE")
if [ $SIZE -gt 100000 ]; then  # 100KB
    echo -e "${YELLOW}⚠️  Large file detected: $FILE ($(($SIZE / 1024))KB)${NC}"
    echo -e "${YELLOW}   Consider splitting case studies for better readability${NC}"
fi
```

### Why Non-blocking AWS Service Name Checks?

**Decision**: Typo detection warns but doesn't block.

**Reasons**:

1. **False positives**: Some contexts need lowercase (e.g., code examples)
2. **Quality improvement**: Helps maintain consistency without being authoritarian
3. **Not a critical error**: Typos don't break builds

**Pattern Used**:

```bash
if git show :"$FILE" | grep -qE '(Cloudfront|cloudfront|Cloud Front)'; then
    echo -e "${YELLOW}⚠️  Possible typo in $FILE: Use 'CloudFront' (capital F)${NC}"
    TYPO_FOUND=1
fi
```

### Why Enforce Commit Expert Agent?

**Problem**: Need consistent commit message format across team, but direct `git commit` bypasses the agent.

**Solution**: commit-msg hook validates presence of `Agent: commit-expert` footer.

**Pattern Used**:

```bash
if ! echo "$COMMIT_MSG" | grep -q "Agent: commit-expert"; then
    echo "❌ COMMIT BLOCKED"
    echo "Required footer tag missing: 'Agent: commit-expert'"
    echo ""
    echo "✅ Use: /commit command"
    echo "✅ Use: Task(subagent_type=\"commit-expert\")"
    echo "❌ DO NOT use: git commit directly"
    exit 1
fi
```

**Benefits**:
- Ensures all commits follow project-specific commit rules
- Enables intelligent multi-commit splitting
- Maintains consistent commit history
- Can't be accidentally bypassed

## Package.json Scripts

**Root**:

```json
{
  "scripts": {
    "dev": "cd docs && mintlify dev",
    "build": "cd docs && mintlify build",
    "preview": "cd docs && mintlify preview"
  },
  "dependencies": {
    "mintlify": "^4.2.202"
  }
}
```

**Note**: Mintlify runs from `docs/` directory to prevent scanning the `claude-skills/` git submodule.

## Setup Instructions

**For new team members**:

1. Clone repository with submodules:

    ```bash
    git clone --recurse-submodules <repo-url>
    cd smb
    ```

2. Install Mintlify dependencies:

    ```bash
    npm install
    ```

3. Configure git hooks:

    ```bash
    git config core.hooksPath .githooks
    chmod +x .githooks/*
    ```

4. Verify setup:

    ```bash
    git config core.hooksPath  # Should output: .githooks
    ```

5. Test hooks:

    ```bash
    # Test pre-commit hook
    echo "Test <$100" > test.md
    git add test.md
    git commit -m "test"  # Should block with MDX error
    rm test.md

    # Test commit-msg hook
    git commit --allow-empty -m "test: Without skill footer"  # Should block
    git reset HEAD~1
    ```

## Hook Output Example

### Pre-commit Hook (Passing)

```
🔍 Running pre-commit checks...
📝 Checking for unescaped HTML entities in MDX/MD files...
📦 Checking file sizes...
🔤 Checking AWS service names...
✅ Pre-commit checks passed!
```

### Pre-commit Hook (MDX Error - Blocking)

```
🔍 Running pre-commit checks...
📝 Checking for unescaped HTML entities in MDX/MD files...
❌ Found unescaped '<$' in docs/aws-smb-competency/01-prerequisites.md
   Replace '<$100M' with '&lt;$100M'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MDX Parsing Error - Unescaped HTML entities found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Mintlify's MDX parser treats '<$' as an HTML tag.
Use HTML entity: &lt;$100M instead of <$100M
```

### Commit-msg Hook (Blocking)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ COMMIT BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This commit was not created using the commit-expert agent.

Required footer tag missing: 'Agent: commit-expert'

┌─────────────────────────────────────────────────────┐
│  HOW TO FIX:                                        │
├─────────────────────────────────────────────────────┤
│  ✅ Use: /commit command                            │
│  ✅ Use: Task(subagent_type="commit-expert")        │
│  ❌ DO NOT use: git commit directly                 │
└─────────────────────────────────────────────────────┘

The agent ensures:
  • Proper conventional commit format (type(scope): subject)
  • Intelligent multi-commit splitting
  • Follows project-specific commit rules
  • Consistent capitalization and formatting

Emergency bypass (use sparingly):
  git commit --no-verify -m "your message"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Project Structure

```
smb/
├── .githooks/
│   ├── pre-commit              # Documentation quality checks
│   └── commit-msg              # Conventional commits enforcement
├── .claude/
│   ├── config/
│   │   └── commit-expert/             # Project-specific commit rules
│   ├── skills/                 # Symlinks to claude-skills submodule
│   └── commands/               # Copied from claude-skills/commands/
├── claude-skills/              # Git submodule with shared skills
├── docs/                       # Mintlify documentation root
│   ├── mint.json               # Mintlify configuration
│   ├── README.md               # Main documentation
│   ├── favicon.svg             # Site favicon
│   ├── case-studies/
│   │   ├── korean/             # Korean case studies (4 complete)
│   │   └── english/            # English translations (in progress)
│   └── aws-smb-competency/     # AWS competency requirements docs
├── references/                 # AWS program documentation (not in Mintlify)
├── CLAUDE.md                   # Claude Code project instructions
├── package.json                # Mintlify dependencies
└── .gitignore                  # Includes Mintlify build artifacts
```

## Lessons Learned

### What Worked Well

1. **MDX validation prevents broken builds** ✅
    - Catches parsing errors before CI
    - Clear error messages with fix instructions
    - Saves debugging time on Mintlify build failures

2. **Agent enforcement improves commit quality** ✅
    - Consistent commit message format
    - Intelligent multi-commit splitting
    - Project-specific commit rules enforced automatically

3. **Non-blocking warnings for style** ✅
    - File size and typo warnings don't block workflow
    - Developers can use judgment
    - Gradual quality improvement without friction

4. **Fast execution** ✅
    - All checks complete in <3 seconds
    - Regex-based checks are very efficient
    - No external tool dependencies

### What Could Be Better

1. **Automated fixes for HTML entities**
    - Could auto-fix `<$` → `&lt;$` like Prettier
    - Currently requires manual fix
    - Would reduce developer friction

2. **Integration with Mintlify CLI**
    - Could run `mintlify build` in CI-only pre-push hook
    - Would catch additional MDX errors
    - Too slow for pre-commit (~10-15s)

3. **Configurable thresholds**
    - File size threshold (100KB) is hardcoded
    - Could move to `.claude/config/git-hooks.yaml`
    - More flexible for different projects

## Mintlify-Specific Considerations

### Directory Structure Requirement

**Problem**: Mintlify scans entire directory tree by default, including git submodules.

**Solution**: Run Mintlify from `docs/` subdirectory.

```json
{
  "scripts": {
    "dev": "cd docs && mintlify dev"  // Not: mintlify dev docs/
  }
}
```

**Why**: The `ignores` field in `mint.json` is unreliable. Running from subdirectory prevents scanning `claude-skills/` submodule with incompatible YAML files.

### Node Version Requirements

**Mintlify requires**: Node.js LTS (v20.x or v22.x)

**Does NOT work with**: Node v25+

**Setup**:

```bash
nvm use --lts
# or
nvm use 22
```

### Common MDX Parsing Issues

1. **HTML-like syntax**: `<$100M` → Use `&lt;$100M`
2. **Unescaped brackets**: `<Component>` → Use backticks or escape
3. **JSX syntax**: Must use proper MDX component syntax

## Testing

**Manual testing performed**:

- ✅ Commits with unescaped HTML entities (blocked by pre-commit)
- ✅ Commits with large files (warning only)
- ✅ Commits with AWS service typos (warning only)
- ✅ Direct `git commit` without agent footer (blocked by commit-msg)
- ✅ Commits using commit-expert agent (allowed)
- ✅ Hook bypass with `--no-verify` (works for emergencies)
- ✅ Performance measurement (<3s total)

**Real-world validation**:

- Pre-commit hook caught HTML entity errors in CLAUDE.md during documentation update
- Commit-msg hook successfully enforces agent usage across all commits
- No false positives in blocking checks
- Warnings provide useful guidance without blocking workflow

## References

- **Project**: AWS SMB Competency case studies documentation
- **Mintlify docs**: https://mintlify.com/docs
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Hook source**: Created November 2024 during Mintlify setup

## Applying to Your Project

**If your project is similar** (documentation-only, Mintlify):

1. Copy both hooks to your `.githooks/`:
    ```bash
    cp pre-commit .githooks/
    cp commit-msg .githooks/
    chmod +x .githooks/*
    git config core.hooksPath .githooks
    ```

2. Adjust MDX validation patterns for your content:
    - Update regex patterns for your specific HTML entity issues
    - Modify file size threshold if needed

3. Test hooks work correctly:
    ```bash
    # Test MDX validation
    echo "Test <$" > test.md
    git add test.md
    git commit -m "test"  # Should block

    # Test skill enforcement
    git commit --allow-empty -m "test"  # Should block
    ```

**If your project differs**:

- Use this as reference for documentation quality checks
- See `../monorepo-nestjs-cdk/` for code-focused hooks
- Read `../../decision-tree.md` for selection logic

## Next Steps

- Consider adding automated HTML entity fixes (like Prettier)
- Add pre-push hook with `mintlify build` validation
- Configure thresholds via `.claude/config/git-hooks.yaml`
- Add hook testing automation
- Document pattern for other documentation platforms (Docusaurus, VitePress)