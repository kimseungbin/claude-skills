#!/bin/bash
#
# Shared output formatting functions for git hooks
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/colors.sh"
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/output.sh"
#
# Dependencies:
#   - lib/colors.sh must be sourced first
#

# Print a styled header banner
# Usage: print_header "Title"
print_header() {
    local title="$1"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ${title}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Print a success message with checkmark
# Usage: print_success "Message"
print_success() {
    local message="$1"
    echo -e "${GREEN}${SYM_CHECK} ${message}${NC}"
}

# Print an indented success message
# Usage: print_success_indent "Message"
print_success_indent() {
    local message="$1"
    echo -e "${GREEN}  ${SYM_CHECK} ${message}${NC}"
}

# Print an error message with cross
# Usage: print_error "Message"
print_error() {
    local message="$1"
    echo -e "${RED}${SYM_CROSS} ${message}${NC}"
}

# Print an indented error message
# Usage: print_error_indent "Message"
print_error_indent() {
    local message="$1"
    echo -e "${RED}  ${SYM_CROSS} ${message}${NC}"
}

# Print a warning message
# Usage: print_warning "Message"
print_warning() {
    local message="$1"
    echo -e "${YELLOW}${SYM_WARNING} ${message}${NC}"
}

# Print an indented warning message
# Usage: print_warning_indent "Message"
print_warning_indent() {
    local message="$1"
    echo -e "${YELLOW}  ${SYM_WARNING} ${message}${NC}"
}

# Print an info message
# Usage: print_info "Message"
print_info() {
    local message="$1"
    echo -e "${BLUE}${message}${NC}"
}

# Print a step indicator
# Usage: print_step "1/5" "Description"
print_step() {
    local step="$1"
    local description="$2"
    echo -e "${BLUE}[${step}] ${description}${NC}"
}

# Print a separator line
# Usage: print_separator
print_separator() {
    echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Print a blocked banner (for commit/push blocks)
# Usage: print_blocked "COMMIT BLOCKED"
print_blocked() {
    local title="$1"
    echo ""
    print_separator
    echo -e "${RED}${SYM_CROSS} ${title}${NC}"
    print_separator
    echo ""
}

# Print a success banner
# Usage: print_success_banner "All checks passed"
print_success_banner() {
    local title="$1"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ${SYM_CHECK} ${title}${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
}

# Print a critical error banner
# Usage: print_critical_banner "CRITICAL: Resource replacement detected"
print_critical_banner() {
    local title="$1"
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ${SYM_CROSS} ${title}${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Print a hint/suggestion in dim text
# Usage: print_hint "Consider: do something"
print_hint() {
    local message="$1"
    echo -e "     ${DIM}${message}${NC}"
}

# Print a command suggestion
# Usage: print_command "git commit --amend"
print_command() {
    local command="$1"
    echo -e "            ${GREEN}${command}${NC}"
}

# Print a boxed message (for how-to-fix sections)
# Usage: print_box "HOW TO FIX:" "line1" "line2" ...
print_box() {
    local title="$1"
    shift
    local lines=("$@")

    echo "┌─────────────────────────────────────────────────────┐"
    echo "│  ${title}"
    echo "├─────────────────────────────────────────────────────┤"
    for line in "${lines[@]}"; do
        printf "│  %-51s │\n" "$line"
    done
    echo "└─────────────────────────────────────────────────────┘"
}