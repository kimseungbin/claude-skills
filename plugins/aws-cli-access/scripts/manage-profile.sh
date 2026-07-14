#!/usr/bin/env bash
# Manages AWS CLI SSO profiles in the AWS config file.
#
# The SSO session name and region are NOT hardcoded — pass them via flags
# (--sso-session, --region) or environment variables
# (AWS_CLI_ACCESS_SSO_SESSION, AWS_CLI_ACCESS_REGION). The account-access
# skill reads them from the user config and forwards them here.
set -euo pipefail

# Resolve the AWS config file the same way the AWS CLI does: honor
# AWS_CONFIG_FILE, otherwise default to ~/.aws/config.
CONFIG_FILE="${AWS_CONFIG_FILE:-$HOME/.aws/config}"

SSO_SESSION_NAME="${AWS_CLI_ACCESS_SSO_SESSION:-}"
DEFAULT_REGION="${AWS_CLI_ACCESS_REGION:-}"

usage() {
  cat <<USAGE
Usage: $0 <command> [args] [--sso-session NAME] [--region REGION]

Commands:
  add       <account_id> <profile_name> [role_name] [--temporary]
              Add a new profile (fails if it already exists).
  remove    <account_id> <profile_name>
              Remove an existing profile block.
  set-role  <account_id> <profile_name> <new_role>
              Update sso_role_name for an existing profile.
  list        List all profiles that reference an sso_session.

Arguments:
  account_id    AWS account ID
  profile_name  CLI profile name
  role_name     SSO role name (default: ReadOnlyAccess)

Flags:
  --temporary        Mark profile as temporary (adds a cleanup-tracking comment).
  --sso-session STR  SSO session name (or set AWS_CLI_ACCESS_SSO_SESSION).
  --region STR       Region for new profiles (or set AWS_CLI_ACCESS_REGION).

Config file: $CONFIG_FILE (override with AWS_CONFIG_FILE)
USAGE
  exit 1
}

[[ $# -lt 1 ]] && usage

COMMAND="$1"
shift

# Collect positional args and parse flags that may appear anywhere.
POSITIONAL=()
TEMPORARY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --temporary) TEMPORARY=true; shift ;;
    --sso-session) SSO_SESSION_NAME="${2:-}"; shift 2 ;;
    --region) DEFAULT_REGION="${2:-}"; shift 2 ;;
    --*) echo "ERROR: Unknown flag '$1'" >&2; usage ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done

ACCOUNT_ID="${POSITIONAL[0]:-}"
PROFILE_NAME="${POSITIONAL[1]:-}"
ROLE_NAME="${POSITIONAL[2]:-ReadOnlyAccess}"

require_session_and_region() {
  if [[ -z "$SSO_SESSION_NAME" ]]; then
    echo "ERROR: SSO session name is required (--sso-session or AWS_CLI_ACCESS_SSO_SESSION)" >&2
    exit 1
  fi
  if [[ -z "$DEFAULT_REGION" ]]; then
    echo "ERROR: region is required (--region or AWS_CLI_ACCESS_REGION)" >&2
    exit 1
  fi
}

profile_header_for() { echo "[profile ${1}]"; }

profile_exists() {
  grep -qF "$(profile_header_for "$PROFILE_NAME")" "$CONFIG_FILE" 2>/dev/null
}

case "$COMMAND" in
  add)
    [[ -z "$ACCOUNT_ID" || -z "$PROFILE_NAME" ]] && usage
    require_session_and_region
    if profile_exists; then
      echo "ERROR: Profile '$PROFILE_NAME' already exists in $CONFIG_FILE" >&2
      exit 1
    fi
    {
      echo ""
      profile_header_for "$PROFILE_NAME"
      echo "sso_session = ${SSO_SESSION_NAME}"
      echo "sso_account_id = ${ACCOUNT_ID}"
      if [[ "$TEMPORARY" == "true" ]]; then
        echo "# TEMPORARY — revert to ReadOnlyAccess / remove when done"
      fi
      echo "sso_role_name = ${ROLE_NAME}"
      echo "region = ${DEFAULT_REGION}"
    } >> "$CONFIG_FILE"
    msg="Added profile '$PROFILE_NAME' (account: $ACCOUNT_ID, role: $ROLE_NAME)"
    [[ "$TEMPORARY" == "true" ]] && msg="$msg [TEMPORARY]"
    echo "$msg"
    ;;

  remove)
    [[ -z "$ACCOUNT_ID" || -z "$PROFILE_NAME" ]] && usage
    if ! profile_exists; then
      echo "ERROR: Profile '$PROFILE_NAME' not found in $CONFIG_FILE" >&2
      exit 1
    fi
    # Remove the profile block: header + following lines until the next
    # section or EOF. Also drop comment lines immediately above the header.
    awk -v header="$(profile_header_for "$PROFILE_NAME")" '
      /^#/ && !in_block { buf = buf $0 "\n"; next }
      $0 == header { in_block = 1; buf = ""; next }
      in_block && /^\[/ { in_block = 0 }
      !in_block { if (buf != "") { printf "%s", buf; buf = "" }; print }
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    echo "Removed profile '$PROFILE_NAME'"
    ;;

  set-role)
    [[ -z "$ACCOUNT_ID" || -z "$PROFILE_NAME" ]] && usage
    NEW_ROLE="${POSITIONAL[2]:-}"
    [[ -z "$NEW_ROLE" ]] && { echo "ERROR: set-role requires a new role name" >&2; usage; }
    if ! profile_exists; then
      echo "ERROR: Profile '$PROFILE_NAME' not found in $CONFIG_FILE" >&2
      exit 1
    fi
    # Replace sso_role_name within the target block, dropping any TEMPORARY comment.
    awk -v header="$(profile_header_for "$PROFILE_NAME")" -v role="$NEW_ROLE" '
      $0 == header { in_block = 1 }
      in_block && /^\[/ && $0 != header { in_block = 0 }
      in_block && /^# TEMPORARY/ { next }
      in_block && /^sso_role_name/ { print "sso_role_name = " role; next }
      { print }
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    echo "Updated profile '$PROFILE_NAME' role to '$NEW_ROLE'"
    ;;

  list)
    if [[ ! -f "$CONFIG_FILE" ]]; then
      echo "No AWS config file at $CONFIG_FILE"
      exit 0
    fi
    # Print each profile that references an sso_session, with its account and role.
    awk '
      function val(line,   v) { v = line; sub(/^[^=]*=[[:space:]]*/, "", v); return v }
      function flush() {
        if (name != "" && sess != "")
          printf "  %-24s account=%-14s role=%s%s\n", name, acct, role, temp
        name = ""; acct = ""; role = ""; sess = ""; temp = ""
      }
      /^\[/ { flush() }
      /^\[profile / { name = $0; sub(/^\[profile /, "", name); sub(/\]$/, "", name) }
      /^sso_session[[:space:]]*=/    { sess = val($0) }
      /^sso_account_id[[:space:]]*=/ { acct = val($0) }
      /^sso_role_name[[:space:]]*=/  { role = val($0) }
      /^# TEMPORARY/                 { temp = " [TEMPORARY]" }
      END { flush() }
    ' "$CONFIG_FILE"
    ;;

  *)
    echo "ERROR: Unknown command '$COMMAND'" >&2
    usage
    ;;
esac
