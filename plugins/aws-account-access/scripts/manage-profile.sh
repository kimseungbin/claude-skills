#!/usr/bin/env bash
# Manages AWS CLI profiles in the AWS config file, and resolves the IAM Identity
# Center values the account-access skill's CLI path needs.
#
# Org-specific values come from the user config the skill reads (sso_session_name,
# region, default_role, role_session_name, sso_instance_arn, management_profile),
# resolved the same way: AWS_ACCOUNT_ACCESS_CONFIG if set, else
# claude-aws-account-access.json next to the AWS config file, else
# ~/.config/claude-code/aws-account-access.json.
set -euo pipefail

# Honors AWS_CONFIG_FILE, the same override the AWS CLI reads, so this script edits
# whatever config the CLI actually uses.
CONFIG_FILE="${AWS_CONFIG_FILE:-$HOME/.aws/config}"

if [[ -n "${AWS_ACCOUNT_ACCESS_CONFIG:-}" ]]; then
  ACCESS_CONFIG="$AWS_ACCOUNT_ACCESS_CONFIG"
elif [[ -f "${CONFIG_FILE%/*}/claude-aws-account-access.json" ]]; then
  ACCESS_CONFIG="${CONFIG_FILE%/*}/claude-aws-account-access.json"
else
  ACCESS_CONFIG="$HOME/.config/claude-code/aws-account-access.json"
fi

usage() {
  cat <<USAGE
Usage: $0 <command> [args] [--temporary]

Profiles:
  add          <account_id> <profile_name> [sso_role_name]
                 Add an IAM Identity Center profile. The role defaults to the
                 config's default_role.
  add-chained  <account_id> <profile_name> <source_profile> <role_name>
                 Add a profile that assumes <role_name> in <account_id> from
                 <source_profile>, e.g. an access broker's cloudy-staff-admin
                 role from its -hop SSO profile.
  remove       <profile_name>
                 Remove a profile block (either kind).
  set-role     <profile_name> <sso_role_name>
                 Change an SSO profile's role.
  list         List SSO and role-assumption profiles.

Identity Center (CLI path):
  permission-set-arn <name>
                 Print the ARN of the permission set with this name.
  await-assignment <creation|deletion> <request_id>
                 Wait until an account assignment request settles; exit 1 if it failed.

Flags:
  --temporary    add / add-chained: mark the profile for cleanup.

AWS config:    $CONFIG_FILE (override with AWS_CONFIG_FILE)
Access config: $ACCESS_CONFIG (override with AWS_ACCOUNT_ACCESS_CONFIG)
USAGE
  exit 1
}

# A config value, or empty when the key or the file is missing.
cfg() { jq -r --arg k "$1" '.[$k] // empty' "$ACCESS_CONFIG" 2>/dev/null || true; }

# A config value the command cannot run without.
need() {
  local v
  v="$(cfg "$1")"
  [[ -n "$v" ]] || { echo "ERROR: Set \"$1\" in $ACCESS_CONFIG" >&2; exit 1; }
  echo "$v"
}

command -v jq >/dev/null || { echo "ERROR: 'jq' is required" >&2; exit 1; }

[[ $# -lt 1 ]] && usage
COMMAND="$1"
shift

ARGS=()
TEMPORARY=false
for arg in "$@"; do
  case "$arg" in
    --temporary) TEMPORARY=true ;;
    --*) echo "ERROR: Unknown flag '$arg'" >&2; usage ;;
    *) ARGS+=("$arg") ;;
  esac
done
arg() { echo "${ARGS[$1]:-}"; }

profile_header() { echo "[profile $1]"; }
profile_exists() { grep -qxF "$(profile_header "$1")" "$CONFIG_FILE" 2>/dev/null; }

require_new_profile() {
  if profile_exists "$1"; then
    echo "ERROR: Profile '$1' already exists in $CONFIG_FILE" >&2
    exit 1
  fi
}

require_profile() {
  if ! profile_exists "$1"; then
    echo "ERROR: Profile '$1' not found in $CONFIG_FILE" >&2
    exit 1
  fi
}

TEMP_MARK="# TEMPORARY — remove when done"

# Run an sso-admin call against the Identity Center instance from the config. The
# values are read once, as assignments, so a missing key stops the script.
load_sso_admin() {
  INSTANCE_ARN="$(need sso_instance_arn)"
  REGION="$(need region)"
  MANAGEMENT_PROFILE="$(need management_profile)"
}
sso_admin() {
  aws sso-admin "$@" --instance-arn "$INSTANCE_ARN" --region "$REGION" --profile "$MANAGEMENT_PROFILE"
}

case "$COMMAND" in
  add)
    ACCOUNT_ID="$(arg 0)"; PROFILE_NAME="$(arg 1)"; ROLE_NAME="$(arg 2)"
    [[ -z "$ACCOUNT_ID" || -z "$PROFILE_NAME" ]] && usage
    [[ -z "$ROLE_NAME" ]] && ROLE_NAME="$(need default_role)"
    SSO_SESSION="$(need sso_session_name)"; REGION="$(need region)"
    require_new_profile "$PROFILE_NAME"
    {
      echo ""
      profile_header "$PROFILE_NAME"
      [[ "$TEMPORARY" == true ]] && echo "$TEMP_MARK"
      echo "sso_session = ${SSO_SESSION}"
      echo "sso_account_id = ${ACCOUNT_ID}"
      echo "sso_role_name = ${ROLE_NAME}"
      echo "region = ${REGION}"
    } >> "$CONFIG_FILE"
    echo "Added profile '$PROFILE_NAME' (account: $ACCOUNT_ID, role: $ROLE_NAME)$([[ "$TEMPORARY" == true ]] && echo " [TEMPORARY]")"
    ;;

  add-chained)
    ACCOUNT_ID="$(arg 0)"; PROFILE_NAME="$(arg 1)"; SOURCE_PROFILE="$(arg 2)"; ROLE_NAME="$(arg 3)"
    [[ -z "$ACCOUNT_ID" || -z "$PROFILE_NAME" || -z "$SOURCE_PROFILE" || -z "$ROLE_NAME" ]] && usage
    REGION="$(need region)"
    # Stamped on the assumed-role session so the target account's CloudTrail names the
    # operator; an SSO profile needs no equivalent, its session already carries it.
    SESSION_NAME="$(cfg role_session_name)"
    require_new_profile "$PROFILE_NAME"
    profile_exists "$SOURCE_PROFILE" || { echo "ERROR: Source profile '$SOURCE_PROFILE' not found in $CONFIG_FILE" >&2; exit 1; }
    {
      echo ""
      profile_header "$PROFILE_NAME"
      [[ "$TEMPORARY" == true ]] && echo "$TEMP_MARK"
      echo "role_arn = arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
      echo "source_profile = ${SOURCE_PROFILE}"
      [[ -n "$SESSION_NAME" ]] && echo "role_session_name = ${SESSION_NAME}"
      echo "region = ${REGION}"
    } >> "$CONFIG_FILE"
    echo "Added chained profile '$PROFILE_NAME' (account: $ACCOUNT_ID, role: $ROLE_NAME, via: $SOURCE_PROFILE)$([[ "$TEMPORARY" == true ]] && echo " [TEMPORARY]")"
    ;;

  remove)
    PROFILE_NAME="$(arg 0)"
    [[ -z "$PROFILE_NAME" ]] && usage
    require_profile "$PROFILE_NAME"
    # Drop the header and every line up to the next section. Comment lines above a
    # header are buffered so they stay with the block that follows them.
    awk -v header="$(profile_header "$PROFILE_NAME")" '
      /^#/ && !in_block { buf = buf $0 "\n"; next }
      $0 == header { in_block = 1; buf = ""; next }
      in_block && /^\[/ { in_block = 0 }
      !in_block { if (buf != "") { printf "%s", buf; buf = "" }; print }
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    echo "Removed profile '$PROFILE_NAME'"
    ;;

  set-role)
    PROFILE_NAME="$(arg 0)"; NEW_ROLE="$(arg 1)"
    [[ -z "$PROFILE_NAME" || -z "$NEW_ROLE" ]] && usage
    require_profile "$PROFILE_NAME"
    # A role-assumption profile carries its role inside role_arn, so it is re-created
    # with add-chained rather than edited here.
    if ! awk -v header="$(profile_header "$PROFILE_NAME")" '
      $0 == header { in_block = 1; next }
      in_block && /^\[/ { in_block = 0 }
      in_block && /^sso_role_name/ { found = 1 }
      END { exit found ? 0 : 1 }
    ' "$CONFIG_FILE"; then
      echo "ERROR: Profile '$PROFILE_NAME' is not an SSO profile; re-create it with add-chained to change its role" >&2
      exit 1
    fi
    awk -v header="$(profile_header "$PROFILE_NAME")" -v role="$NEW_ROLE" '
      $0 == header { in_block = 1; print; next }
      in_block && /^\[/ { in_block = 0 }
      in_block && /^# TEMPORARY/ { next }
      in_block && /^sso_role_name/ { print "sso_role_name = " role; next }
      { print }
    ' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp"
    mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    echo "Updated profile '$PROFILE_NAME' role to '$NEW_ROLE'"
    ;;

  list)
    [[ -f "$CONFIG_FILE" ]] || { echo "No AWS config file at $CONFIG_FILE"; exit 0; }
    awk '
      function val(line,   v) { v = line; sub(/^[^=]*=[[:space:]]*/, "", v); return v }
      function flush() {
        if (name != "" && sess != "")
          printf "  %-28s account=%-14s role=%s%s\n", name, acct, role, temp
        else if (name != "" && arn != "")
          printf "  %-28s %s via %s%s\n", name, arn, src, temp
        name = ""; acct = ""; role = ""; sess = ""; arn = ""; src = ""; temp = ""
      }
      /^\[/ { flush() }
      /^\[profile / { name = $0; sub(/^\[profile /, "", name); sub(/\]$/, "", name) }
      /^sso_session[[:space:]]*=/    { sess = val($0) }
      /^sso_account_id[[:space:]]*=/ { acct = val($0) }
      /^sso_role_name[[:space:]]*=/  { role = val($0) }
      /^role_arn[[:space:]]*=/       { arn = val($0) }
      /^source_profile[[:space:]]*=/ { src = val($0) }
      /^# TEMPORARY/                 { temp = " [TEMPORARY]" }
      END { flush() }
    ' "$CONFIG_FILE"
    ;;

  permission-set-arn)
    NAME="$(arg 0)"
    [[ -z "$NAME" ]] && usage
    load_sso_admin
    # Permission sets are matched by name: their ARNs carry a generated ps-* id.
    ARNS="$(sso_admin list-permission-sets --query 'PermissionSets' --output text)" || {
      echo "ERROR: Could not list permission sets with --profile $MANAGEMENT_PROFILE (run: aws sso login --profile $MANAGEMENT_PROFILE)" >&2
      exit 1
    }
    for PS_ARN in $ARNS; do
      PS_NAME="$(sso_admin describe-permission-set --permission-set-arn "$PS_ARN" --query 'PermissionSet.Name' --output text)"
      [[ "$PS_NAME" == "$NAME" ]] && { echo "$PS_ARN"; exit 0; }
    done
    echo "ERROR: No permission set named '$NAME'" >&2
    exit 1
    ;;

  await-assignment)
    KIND="$(arg 0)"; REQUEST_ID="$(arg 1)"
    [[ "$KIND" =~ ^(creation|deletion)$ && -n "$REQUEST_ID" ]] || usage
    load_sso_admin
    # Identity Center provisions the role asynchronously; a profile used before the
    # request succeeds fails with ForbiddenException "No access".
    [[ "$KIND" == creation ]] && FIELD="AccountAssignmentCreationStatus" || FIELD="AccountAssignmentDeletionStatus"
    while :; do
      STATUS="$(sso_admin "describe-account-assignment-${KIND}-status" \
        "--account-assignment-${KIND}-request-id" "$REQUEST_ID" \
        --query "${FIELD}.[Status,FailureReason]" --output text)"
      case "$STATUS" in
        SUCCEEDED*) echo "Assignment ${KIND} succeeded"; exit 0 ;;
        FAILED*) echo "ERROR: Assignment ${KIND} failed: ${STATUS#FAILED}" >&2; exit 1 ;;
        *) sleep "${AWS_ACCOUNT_ACCESS_POLL_SECONDS:-3}" ;;
      esac
    done
    ;;

  *)
    echo "ERROR: Unknown command '$COMMAND'" >&2
    usage
    ;;
esac
