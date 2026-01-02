---
name: Pull Request Management
description: |
    Guide for creating, reviewing, and managing pull requests across projects.
    Helps fill out PR templates with proper validation and confidence checks.
    Use when user requests to create a PR or needs help with PR description.
---

# Pull Request Management

This skill provides guidance for creating and managing pull requests across different projects, with special attention to PR template compliance and confidence-based decision making.

## Core Principles

1. **PR templates are project-specific** - Located in each project's `.github/pull_request_template.md`
2. **Skills are general-purpose** - This skill provides generic guidance applicable to any project
3. **Confidence-based decision making** - When uncertain, suggest PR template updates instead of making low-confidence choices
4. **Template evolution** - PR templates should improve based on real-world usage

## Instructions

When the user requests to create a pull request or fill out a PR template:

### 1. Locate and Read the PR Template

```bash
# Check for PR template in standard locations
find .github -name "*pull_request*.md" -o -name "*PULL_REQUEST*.md"
```

**Standard locations:**

- `.github/pull_request_template.md` (primary)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/` (multiple templates)
- `docs/pull_request_template.md`

If no template exists, ask the user if they want to create one.

### 2. Analyze Current Changes

**CRITICAL: Always use remote branches for comparison, not local branches.**

Gather context about the changes being proposed:

```bash
# Check current branch and status
git branch --show-current
git status

# List all remote branches
git branch -r

# Fetch latest remote state (if needed)
git fetch origin

# ALWAYS compare remote branches for PR analysis
git log origin/<target-branch>..origin/<source-branch> --oneline
git diff origin/<target-branch>..origin/<source-branch> --name-only

# Example: For master → staging PR
git log origin/staging..origin/master --oneline
git diff origin/staging..origin/master --name-only
```

**Why remote branches?**
- Local branches may be out of sync with remote
- User may have unpushed commits that shouldn't be in PR
- Remote branches reflect what will actually be merged
- Prevents including unintended local work-in-progress commits

**Anti-pattern:**
```bash
# ❌ DON'T: Compare local branches
git log staging..master  # May include unpushed local commits
git diff HEAD..master    # Compares local state, not remote
```

### 3. Identify Target Branch

Determine where this PR will merge to:

- Check branch naming conventions (feature/*, fix/*, hotfix/*)
- Review git workflow documentation (e.g., GIT_STRATEGY.md, CONTRIBUTING.md)
- Check for environment-based branches (dev, staging, prod, etc.)
- Ask user if unclear

### 3.5. Interactive PR Content Selection

**CRITICAL: Use `AskUserQuestion` to let the user choose PR title and key content interactively.**

After analyzing commits and changes, present options to the user rather than making unilateral decisions.

#### Step 1: Analyze Changes

```bash
git log <target-branch>..<source-branch> --oneline
git diff <target-branch>..<source-branch> --stat
```

Categorize commits by type:
- feat: New features, major functionality
- fix: Bug fixes
- refactor: Code restructuring without behavior change
- docs: Documentation only
- chore: Maintenance (dependencies, config)
- ci: CI/CD changes

#### Step 2: Generate Title Options

Based on analysis, generate 2-4 title options prioritized by business impact:

1. **Runtime/Service Changes** (HIGHEST PRIORITY)
2. **Infrastructure/Architecture Changes** (HIGH PRIORITY)
3. **Developer Tooling** (MEDIUM PRIORITY)
4. **Documentation** (LOWEST PRIORITY)

#### Step 3: Ask User to Choose Title

Use `AskUserQuestion` to present title options:

```
AskUserQuestion(
  questions: [{
    question: "Which PR title best describes these changes?",
    header: "PR Title",
    options: [
      { label: "feat(auth): Add OAuth2 authentication", description: "Focuses on the new auth feature (Recommended)" },
      { label: "feat: Add authentication and logging improvements", description: "Broader scope including logging changes" },
      { label: "refactor(api): Restructure auth module with new OAuth2", description: "Emphasizes the refactoring aspect" }
    ],
    multiSelect: false
  }]
)
```

**Guidelines for generating options:**
- First option should be recommended (add "(Recommended)" to description)
- Options should reflect different valid perspectives on the changes
- Include scope when changes are focused on a specific area
- User can always select "Other" to provide custom title

#### Step 4: Ask About Change Type (if ambiguous)

When commit types are mixed, ask the user:

```
AskUserQuestion(
  questions: [{
    question: "What type of change is this PR?",
    header: "Change Type",
    options: [
      { label: "feat", description: "New feature or capability" },
      { label: "fix", description: "Bug fix" },
      { label: "refactor", description: "Code restructuring, no behavior change" },
      { label: "docs", description: "Documentation only" }
    ],
    multiSelect: false
  }]
)
```

#### Step 5: Ask About Deployment Impact (for IaC projects)

For infrastructure projects, ask about deployment impact:

```
AskUserQuestion(
  questions: [{
    question: "What is the deployment impact of this PR?",
    header: "Impact",
    options: [
      { label: "High", description: "Service redeployment required (Task Definition, env vars)" },
      { label: "Medium", description: "Resource updates without downtime (scaling, ALB rules)" },
      { label: "Low", description: "Metadata only (docs, comments, tags)" }
    ],
    multiSelect: false
  }]
)
```

#### When to Skip Interactive Selection

Skip `AskUserQuestion` and use direct selection when:
- Single commit with clear type and scope
- User explicitly provided a title
- Changes are trivially obvious (e.g., typo fix, single doc update)

#### Title Guidelines

**CRITICAL: PR titles must be specific and actionable, not generic.**

❌ **Generic titles (avoid):**
```
docs(project): Improve documentation
chore: Maintenance tasks
feat: Changes
```

✅ **Specific titles (use):**
```
docs(project): Mark Slack integration complete and add 9 features to backlog
feat(auth): Add OAuth2 and two-factor authentication
fix: Resolve critical production bugs in payment flow
```

**Guidelines:**
1. **Include concrete details**: Mention specific milestones, numbers, or components
2. **Avoid redundant terms**: Don't say "infrastructure" in an infrastructure repository
3. **Be actionable**: Reader should understand the change from the title alone
4. **Use verbs**: "Mark", "Add", "Extract", "Translate" (not "Improvement", "Update")

### 3.6. Format PR Summary

**Use nested bullet points to group related changes.**

When there are multiple documentation changes or multiple features, group them under category headers:

❌ **Flat list (hard to scan):**
```markdown
## Summary

- Pipeline notification architecture comments
- Lambda workspace architecture moved to README
- Notification implementation guide removed
- Slack integration marked complete
- 9 new features added to backlog
- ECS cost optimization docs improved
- claude-skills submodule updated
```

✅ **Nested structure (easy to scan):**
```markdown
## Summary

- **Documentation structure improvements**
  - Pipeline notification architecture comments added
  - Lambda workspace architecture moved from CLAUDE.md to README
  - Completed notification implementation guide removed

- **Backlog updates**
  - Slack integration marked complete (TODO-01)
  - 9 new features added to backlog (testing, security, cost optimization)
  - ECS cost optimization documentation improved (FEATURE-07)

- **Maintenance**
  - claude-skills submodule updated
```

**Benefits of nesting:**
- Logical grouping visible at a glance
- Easier to understand the scope of changes
- Shows relationship between related changes
- Reduces cognitive load for reviewers

**Grouping guidelines:**
1. Group by change category (docs, features, fixes, refactoring)
2. Use bold headers for categories
3. Limit to 2-4 top-level groups
4. Keep nested items concise (one line each)
5. Order by importance (most impactful first)

### 3.7. Remove Redundant Headings

**DO NOT include redundant "# Pull Request" heading in PR description.**

Everyone knows it's a PR from the GitHub context. Start directly with the first section.

❌ **With redundant heading:**
```markdown
# Pull Request

## Summary
...
```

✅ **Without redundant heading:**
```markdown
## Summary
...
```

This applies to PR descriptions only. Markdown files in the repository may still use H1 headings as appropriate.

### 3.8. Interactive Concept Explanations

**When introducing technical terms or concepts that reviewers might not be familiar with, ask the user if they want explanatory callouts.**

#### When to Identify Explainable Concepts

Look for terms/concepts that may need explanation:

1. **New Features/APIs**: GitHub Commit Status, Lambda@Edge, CodePipeline notifications
2. **Infrastructure Concepts**: Drift detection, Blue/Green deployment, Task Definitions
3. **Project-Specific Patterns**: Feature flags, cross-account notifications, workspace migrations
4. **Acronyms/Jargon**: WAF, ALB, SSM, ECR (unless already well-known in context)

#### How to Ask

Before creating the PR, use `AskUserQuestion` to offer callout options:

```
I noticed some concepts that reviewers might benefit from having explained:

1. **GitHub Commit Status** - How CI/CD reports build status to GitHub
2. **Grouped Slack Notifications** - Sending multiple messages with same threadId

Would you like me to add explanatory callouts for any of these?
```

**Question format:**
- Header: "Callouts"
- Options: List each identified concept
- Multi-select: true (user can choose multiple)
- Always include "None needed" option implicitly (user can select none)

#### Callout Format

Use GitHub-flavored markdown callouts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`):

```markdown
> [!NOTE]
> **GitHub Commit Status란?**
>
> GitHub Commit Status는 CI/CD 파이프라인이 특정 커밋에 대한 빌드/배포 상태를 GitHub에 보고하는 기능입니다.
>
> **표시 위치:**
> - PR 페이지의 커밋 목록에서 각 커밋 옆에 ✅ / ❌ / 🟡 아이콘으로 표시
> - 커밋 상세 페이지에서 "Status checks" 섹션에 표시
>
> **이 기능의 효과:**
> - CodePipeline 콘솔에 가지 않고도 GitHub에서 배포 상태 즉시 확인
```

**Callout types:**
- `[!NOTE]` - General explanations, background information
- `[!TIP]` - Best practices, recommendations
- `[!IMPORTANT]` - Critical information reviewers must understand
- `[!WARNING]` - Potential risks or gotchas

#### Placement

Place callouts in the **Summary section**, immediately after the bullet-point summary. This ensures reviewers see the context before diving into details.

#### When NOT to Ask

Skip the interactive question if:
- All concepts are already well-documented in the project
- The PR is a simple bug fix with no new concepts
- Previous PRs have already established the terminology
- The target audience (reviewers) are domain experts

### 3.9. Avoid Checkbox Overuse

**Checkboxes are for task lists, not for selecting single options.**

- Use checkboxes only for actual TODO items (pre-flight checks, verification steps)
- For single selections (impact level, yes/no), use emoji or direct text
- See [README.md](README.md#checkbox-alternatives) for alternatives and emoji guide

### 4. Fill Out PR Template Sections

For each section in the PR template, follow this decision-making process:

#### 4.1. High Confidence Sections

Fill out directly if you have high confidence (>80%):

**Can determine with high confidence:**

- **Title/Summary**: Based on commit messages and diffs
- **Change Type**: Based on commit prefixes (feat/fix/refactor/chore/docs/ci)
- **Related Issues**: Extract from commit messages (Fixes #123, Closes #456)
- **Files Changed**: From git diff output
- **Testing Instructions**: For straightforward changes

**Example:**

```markdown
## Summary

Add OAuth2 authentication to user login flow

## Change Type

🎉 feat: New feature addition
```

#### 4.2. Medium Confidence Sections

For sections requiring domain knowledge or judgment (40-80% confidence):

**Requires careful analysis:**

- **Deployment Impact**: Requires understanding of infrastructure/service architecture
- **Breaking Changes**: Requires API/contract knowledge
- **Resource Impact**: Requires knowledge of infrastructure costs
- **Security Implications**: Requires security expertise
- **Affected Services**: Requires understanding of service dependencies

**Decision process:**

1. Analyze available information (code, docs, config)
2. **Check actual diff content, not just file names**
3. If confidence > 60%, make a selection and **ALWAYS explain reasoning with specific evidence**
4. If confidence < 60%, suggest template update (see section 5)

#### 4.3. Low Confidence Sections

For sections requiring project-specific knowledge (<40% confidence):

**NEVER guess. Instead:**

1. Leave the section unfilled or mark as "To be determined"
2. Suggest PR template improvement
3. Ask the user for clarification
4. Recommend adding documentation/decision trees to the template

**Example (Low Confidence):**

````markdown
## Resource Impact

- [ ] To be determined

**⚠️ Cannot determine without more context**

**Recommendation:** Add a resource impact decision tree to this PR template:

```yaml
# .github/pr-guidelines/resource-impact-guide.md
## Resource Impact Decision Tree

### High Impact (Cost increase >$100/month OR new AWS resources)
- Adding new RDS instances, ECS services, or Lambda functions
- Increasing instance sizes (e.g., t3.medium → t3.large)
- Adding CloudFront distributions

### Medium Impact (Cost increase $10-100/month OR configuration changes)
- Scaling ECS task counts
- Modifying auto-scaling policies
- Changing S3 storage classes

### Low Impact (Cost increase <$10/month OR metadata only)
- Log group changes
- Tags and labels
- Documentation
```
````

Please manually fill this section or approve the template improvement.

````

### 5. When to Suggest PR Template Updates

**Trigger conditions for suggesting template improvements:**

1. **Ambiguous Categories**
   - Multiple categories could apply
   - No clear decision criteria
   - Confidence < 60%

2. **Missing Context**
   - Template asks for information not readily available
   - Requires tribal knowledge or undocumented practices
   - No examples provided

3. **Repetitive Questions**
   - Same clarification needed across multiple PRs
   - Common confusion points
   - Frequently left blank by developers

4. **Conflicting Guidance**
   - Template contradicts documentation
   - Unclear precedence between guidelines
   - Inconsistent with actual workflow

### 6. Create the Pull Request

After filling out the template:

#### 6.1. Verify Pre-Flight Checks (Feature Branch PRs Only)

**SKIP pre-flight checks for environment promotion PRs** (e.g., `master` → `staging`, `staging` → `prod`):
- These PRs compare remote branches that already passed CI when pushed
- Running local checks is redundant and may include unrelated local changes
- The commits were already validated by pre-push hooks and GitHub Actions

**Run pre-flight checks ONLY for feature branch PRs** (local changes being pushed):

```bash
# Build verification (required)
npm run build

# For CDK projects
npm run cdk synth
```

**Note:** Lint checks are NOT included here because they are already enforced by:
- Pre-push git hook (`.githooks/pre-push`)
- GitHub Actions CI (`lint.yaml`)

Running lint during PR creation would be redundant.

#### 6.2. Push and Create PR

```bash
# Ensure branch is pushed
git push origin <branch-name>

# Create PR using GitHub CLI with self-assignment
gh pr create --title "<title>" --body "<body>" --assignee @me

# Or create using web URL
gh pr create --web
```

#### 6.3. Link Related Resources

- Link to related issues/tickets
- Reference related PRs
- Link to design docs or RFCs
- Add labels (assignee is auto-set with --assignee @me)

### 7. Post-PR Creation

After PR is created:

1. **Monitor CI/CD**: Check for automated builds, tests, deployments
2. **Update PR**: Add CI results, screenshots, or additional context
3. **Respond to Reviews**: Address feedback and update PR template if questions reveal gaps
4. **Track Template Pain Points**: Note any template sections that caused confusion

## Localization and Writing Style

For projects with specific writing conventions (e.g., Korean PR templates), check for `.claude/config/pull-request-writing-style.md`.

**Example configuration includes:**
- Language patterns (Korean body, English technical terms in parentheses)
- Technical term formatting (backticks for code identifiers)
- Environment analysis table structure
- Feature flag analysis methodology
- Technical explanation patterns ("Why → Before → After → Result")

See [.claude/config/pull-request-writing-style.md](../../config/pull-request-writing-style.md) for complete guidelines (if present in project).

## Project-Specific Customization

### Using PR Template Guidelines

Some projects may include supplementary guideline files:

```
.github/
├── pull_request_template.md          # Main template
├── pr-guidelines/
│   ├── deployment-impact-guide.md    # Impact assessment guide
│   ├── security-checklist.md         # Security review checklist
│   └── testing-guide.md              # Testing instructions
```

**When filling out PR templates:**

1. Check for linked guideline files
2. Read referenced documentation
3. Follow project-specific decision trees
4. Use project-specific examples

### Config File Pattern (Optional)

For AI-specific PR assistance rules, projects can create `.claude/config/pull-request-management.yaml`.

See [README.md](README.md#config-file-pattern-optional) for the full config schema and examples.

## Template Update Workflow

When suggesting PR template updates:

### Step 1: Identify the Gap

Document:

- Which section is problematic
- Why it's difficult to determine
- What information is missing
- How often this occurs

### Step 2: Research Best Practices

Check:

- Industry standard PR templates
- Similar projects' approaches
- Team documentation
- Previous PR comments/questions

### Step 3: Draft Improvement

Create:

- Clear decision criteria
- Examples for each option
- Links to documentation
- Expandable help sections

### Step 4: Propose to User

Present:

- Current template section (problematic)
- Proposed improvement
- Benefits of the change
- Request approval

### Step 5: Implement if Approved

```bash
# Update template
Edit: .github/pull_request_template.md

# Create supporting docs if needed
Write: .github/pr-guidelines/<guide-name>.md

# Commit changes
git add .github/
git commit -m "docs(github): Improve PR template with deployment impact guide"

# Update current PR to use new template
# (manually refresh the PR description)
```

## Notes

- PR templates live in each project (`.github/pull_request_template.md`)
- This skill provides general guidance applicable across projects
- Use confidence-based decision making: high confidence → fill out, low confidence → suggest improvement
- Templates should evolve based on real usage patterns
- When in doubt, ask the user or suggest template updates
- Document project-specific rules in `.claude/config/pull-request-management.yaml`
- Transparency about uncertainty is better than incorrect guesses

## See Also

- **Quick Reference:** [README.md](README.md) - Checkbox alternatives, emojis, common mistakes, anti-patterns
- **Sample Templates:** [samples/](../../samples/) - Example PR templates for IaC projects
- **GitHub Docs:** [PR Template Best Practices](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)