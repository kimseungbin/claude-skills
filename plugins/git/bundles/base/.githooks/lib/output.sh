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

#############################################
# Output buffering for result-first display
#############################################
# In Claude Code IDE, only the first ~4-5 lines of bash output are visible
# in the preview. Buffer all output so the final result (pass/fail) can be
# printed on the very first line, with step details following after.

_BUFFER_FILE=""
_BUFFER_ACTIVE=false
_STEP_CURRENT=0
_STEP_TOTAL=0

# Declare the total number of steps for auto-tracking
# Usage: steps_init 3
steps_init() {
    _STEP_TOTAL="$1"
    _STEP_CURRENT=0
}

# Start buffering stdout to a temp file
# Usage: buffer_start
buffer_start() {
    _BUFFER_FILE=$(mktemp)
    _BUFFER_ACTIVE=true
    exec 3>&1
    exec 1>"$_BUFFER_FILE"
    trap '_buffer_cleanup' EXIT
}

# Flush buffer: print result line first, then all buffered output
# Auto-appends step progress (e.g., "(3/3)") if steps_init was called
# Usage: buffer_end "✓ All checks passed"
buffer_end() {
    local result_line="$1"
    if [[ "$_BUFFER_ACTIVE" != true ]]; then return; fi
    _BUFFER_ACTIVE=false
    exec 1>&3
    if [[ -n "$result_line" ]]; then
        if [[ $_STEP_TOTAL -gt 0 ]]; then
            echo -e "${result_line} (${_STEP_CURRENT}/${_STEP_TOTAL})"
        else
            echo -e "$result_line"
        fi
        echo ""
    fi
    cat "$_BUFFER_FILE"
    rm -f "$_BUFFER_FILE"
}

# Safety net: if script exits without calling buffer_end, flush raw output
_buffer_cleanup() {
    if [[ "$_BUFFER_ACTIVE" == true ]]; then
        _BUFFER_ACTIVE=false
        exec 1>&3 2>/dev/null || true
        cat "$_BUFFER_FILE" 2>/dev/null || true
        rm -f "$_BUFFER_FILE" 2>/dev/null || true
    fi
}

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

# Print a step indicator (auto-increments when steps_init was called)
# Usage: print_step "Description"
print_step() {
    local description="$1"
    ((_STEP_CURRENT++)) || true
    if [[ $_STEP_TOTAL -gt 0 ]]; then
        echo -e "${BLUE}[${_STEP_CURRENT}/${_STEP_TOTAL}] ${description}${NC}"
    else
        echo -e "${BLUE}[${_STEP_CURRENT}] ${description}${NC}"
    fi
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