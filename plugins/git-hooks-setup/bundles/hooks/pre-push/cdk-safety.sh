#!/bin/bash
#
# Pre-push hook for AWS CDK projects
#
# Prevents unsafe deployments by detecting resource replacements.
#
# Checks:
# 1. Build and lint
# 2. CDK synthesis validation
# 3. CDK diff analysis (resource changes)
# 4. Fixed-name resource safety
# 5. File size warnings (non-blocking)
#
# Installation:
#   1. Copy bundles/base/.githooks/ to your project
#   2. Copy this file to .githooks/pre-push
#   3. chmod +x .githooks/pre-push
#   4. git config core.hooksPath .githooks
#
# Bypass (emergency only):
#   git push --no-verify

set -e

# Script directory and shared lib
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source shared libraries
source "$LIB_DIR/colors.sh"
source "$LIB_DIR/output.sh"
source "$LIB_DIR/utils.sh"

print_header "CDK Deployment Safety Check"

# Get the branch being pushed
while read local_ref local_sha remote_ref remote_sha
do
    # Extract branch name
    if [[ $local_ref =~ refs/heads/(.+) ]]; then
        BRANCH="${BASH_REMATCH[1]}"
    fi
done

# Fallback: if BRANCH is not set from stdin, use current branch
if [ -z "$BRANCH" ]; then
    BRANCH=$(get_current_branch)
    if [ -z "$BRANCH" ]; then
        print_warning "Cannot determine branch, skipping checks"
        exit 0
    fi
fi

print_info "Branch: $BRANCH"
echo ""

# Only run checks for branches that trigger deployments
if is_deployment_branch "$BRANCH"; then
    print_info "${SYM_CHECK} Deployment branch detected - running safety checks"
else
    print_success "Non-deployment branch - skipping checks"
    exit 0
fi

echo ""

#############################################
# Check 1: Build and Lint
#############################################
print_step "1/5" "Building and linting..."

# Build TypeScript
BUILD_OUTPUT=$(mktemp)
if ! npm run build > "$BUILD_OUTPUT" 2>&1; then
    print_error_indent "TypeScript compilation failed"
    echo ""
    # Extract and display only the error lines (TS errors contain ": error TS")
    grep -E "(: error TS|error TS[0-9]+:)" "$BUILD_OUTPUT" | head -20 | while IFS= read -r line; do
        echo -e "  ${RED}$line${NC}"
    done
    echo ""
    rm -f "$BUILD_OUTPUT"
    exit 1
fi
rm -f "$BUILD_OUTPUT"
print_success_indent "TypeScript compilation passed"

# Run linter
if ! npm run lint:check > /dev/null 2>&1; then
    print_warning_indent "Linting issues detected (non-blocking)"
    echo -e "${YELLOW}  Run 'npm run lint:check' to see issues${NC}"
else
    print_success_indent "Linting passed"
fi

echo ""

#############################################
# Check 2: CDK Synth Validation
#############################################
print_step "2/5" "Validating CDK synthesis..."

# Attempt to synthesize CDK stacks
if ! npm run cdk synth > /tmp/cdk-synth-output.yaml 2>&1; then
    print_error_indent "CDK synthesis failed"
    echo -e "${YELLOW}Run 'npm run cdk synth' to see errors${NC}"
    cat /tmp/cdk-synth-output.yaml
    exit 1
fi
print_success_indent "CDK synthesis successful"

echo ""

# Create temp directory for cdk diff output
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

#############################################
# Check 3: CDK Diff Analysis
#############################################
print_step "3/5" "Analyzing CloudFormation changes..."

# Run cdk diff and capture output
# Note: cdk diff exits with 1 if there are differences, which is expected
npm run cdk diff > "$TEMP_DIR/cdk-diff-output.txt" 2>&1 || true

# Check for resource replacements ([-/+] pattern)
REPLACEMENTS=$(grep -E "^\[-/\+\]" "$TEMP_DIR/cdk-diff-output.txt" || true)

if [ -z "$REPLACEMENTS" ]; then
    print_success_indent "No resource replacements detected"
else
    print_warning_indent "Resource replacements detected:"
    echo ""
    echo "$REPLACEMENTS" | while IFS= read -r line; do
        echo -e "${YELLOW}    $line${NC}"
    done
    echo ""
fi

# Check for updates (should be safe)
UPDATES=$(grep -E "^\[~\]" "$TEMP_DIR/cdk-diff-output.txt" | wc -l | tr -d ' ')
if [ "$UPDATES" -gt 0 ]; then
    print_success_indent "${UPDATES} in-place updates detected (safe)"
fi

# Check for additions
ADDITIONS=$(grep -E "^\[\+\]" "$TEMP_DIR/cdk-diff-output.txt" | wc -l | tr -d ' ')
if [ "$ADDITIONS" -gt 0 ]; then
    print_success_indent "${ADDITIONS} new resources will be created"
fi

# Check for deletions
DELETIONS=$(grep -E "^\[-\]" "$TEMP_DIR/cdk-diff-output.txt" | wc -l | tr -d ' ')
if [ "$DELETIONS" -gt 0 ]; then
    print_warning_indent "${DELETIONS} resources will be deleted"
fi

echo ""

#############################################
# Check 4: Fixed-Name Resource Safety Check
#############################################
print_step "4/5" "Checking fixed-name resource safety..."

# Define resources with fixed names that require special handling
# Customize this list for your infrastructure
FIXED_NAME_PATTERNS=(
    "AWS::CodeBuild::Project"
    "AWS::ECS::Service"
    "AWS::ECS::Cluster"
    "AWS::RDS::DBInstance"
    "AWS::ElasticLoadBalancingV2::LoadBalancer"
)

CRITICAL_REPLACEMENTS=""

for PATTERN in "${FIXED_NAME_PATTERNS[@]}"; do
    # Check if any replacements match this pattern
    MATCHES=$(echo "$REPLACEMENTS" | grep "$PATTERN" || true)

    if [ -n "$MATCHES" ]; then
        CRITICAL_REPLACEMENTS="${CRITICAL_REPLACEMENTS}${MATCHES}\n"
    fi
done

if [ -z "$CRITICAL_REPLACEMENTS" ]; then
    print_success_indent "No fixed-name resource replacements"
else
    print_critical_banner "CRITICAL: Fixed-name resource replacement detected"
    echo -e "${YELLOW}The following resources have fixed names and cannot be${NC}"
    echo -e "${YELLOW}automatically replaced by CloudFormation:${NC}"
    echo ""
    echo -e "$CRITICAL_REPLACEMENTS"
    echo ""
    echo -e "${YELLOW}Required Action:${NC}"
    echo -e "  1. Review your CDK documentation for refactoring strategies"
    echo -e "  2. Manually delete resources using AWS CLI if needed"
    echo -e "  3. Use incremental rollout (one service at a time)"
    echo -e "  4. Test in DEV before STAGING/PROD"
    echo ""
    echo -e "${RED}Push BLOCKED. Choose one of the following:${NC}"
    echo ""
    echo -e "  ${YELLOW}Option A:${NC} Fix your code to avoid resource replacement"
    echo -e "            (Use overrideLogicalId() or conditional logic)"
    echo ""
    echo -e "  ${YELLOW}Option B:${NC} Acknowledge manual deletion"
    echo -e "            Add footer to your commit message:"
    print_command "git commit --amend"
    echo -e "            Then add to commit body:"
    print_command "Safe-To-Deploy: manual-deletion-planned"
    print_command "Analyzed-By: <your-name>"
    echo ""
    echo -e "  ${YELLOW}Option C:${NC} Emergency bypass (NOT RECOMMENDED)"
    print_command "git push --no-verify"
    echo ""

    # Check if user explicitly allowed resource replacement via commit footer
    LAST_COMMIT_MSG=$(git log -1 --pretty=%B)

    if echo "$LAST_COMMIT_MSG" | grep -q "^Safe-To-Deploy: manual-deletion-planned"; then
        print_warning "'Safe-To-Deploy' footer detected in commit"
        print_warning "Proceeding with resource replacement..."
        print_warning "Remember to manually delete resources!"
        echo ""

        # Show the safety acknowledgment from commit
        SAFETY_NOTE=$(echo "$LAST_COMMIT_MSG" | grep "^Safe-To-Deploy:")
        print_info "Commit acknowledges: ${SAFETY_NOTE}"
        echo ""
    elif [ "${ALLOW_RESOURCE_REPLACEMENT}" = "1" ]; then
        print_warning "ALLOW_RESOURCE_REPLACEMENT=1 detected (deprecated)"
        print_warning "Please use commit footer instead"
        print_warning "Proceeding with resource replacement..."
        echo ""
    else
        exit 1
    fi
fi

echo ""

#############################################
# Summary
#############################################
print_success_banner "All safety checks passed"
echo ""

if [ -n "$REPLACEMENTS" ]; then
    echo -e "${YELLOW}Note: Replacements detected but not blocking${NC}"
    echo -e "${YELLOW}Review changes carefully before merging${NC}"
    echo ""
fi

# Show summary of changes
if [ "$ADDITIONS" -gt 0 ] || [ "$UPDATES" -gt 0 ] || [ "$DELETIONS" -gt 0 ]; then
    print_info "Change Summary:"
    [ "$ADDITIONS" -gt 0 ] && echo -e "  ${GREEN}+ ${ADDITIONS} resources will be created${NC}"
    [ "$UPDATES" -gt 0 ] && echo -e "  ${BLUE}~ ${UPDATES} resources will be updated${NC}"
    [ "$DELETIONS" -gt 0 ] && echo -e "  ${RED}- ${DELETIONS} resources will be deleted${NC}"
    echo ""
fi

print_success "Safe to push to $BRANCH"
echo ""

#############################################
# Check 5: File Size Warnings (non-blocking)
#############################################
print_step "5/5" "Checking file sizes..."

if [[ -x "$SCRIPT_DIR/scripts/check-file-sizes.sh" ]]; then
    # Run file size check (non-blocking)
    "$SCRIPT_DIR/scripts/check-file-sizes.sh" || true
    print_success_indent "File size check complete"
else
    print_warning_indent "File size check script not found"
fi

echo ""

exit 0