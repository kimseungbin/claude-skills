#!/bin/bash
#
# Shared color and symbol definitions for git hooks
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/colors.sh"
#

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Symbols
SYM_CHECK="✓"
SYM_CROSS="✗"
SYM_WARNING="⚠"
SYM_INFO="ℹ"
SYM_FILE="📄"