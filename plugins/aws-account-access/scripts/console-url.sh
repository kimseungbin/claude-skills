#!/usr/bin/env bash
# Prints an AWS console sign-in URL minted from a CLI profile's credentials.
#
# The profile's credentials are resolved by the AWS CLI itself, so every role
# hop the profile chains (source_profile + role_arn, SSO, credential_process)
# happens here. The browser only presents the resulting sign-in token, which
# reaches accounts the console's one-hop Switch Role cannot.
#
# Credentials travel to the federation endpoint on curl's stdin, never on its
# command line, so they stay out of the process list.
set -euo pipefail

FEDERATION_URL="https://signin.aws.amazon.com/federation"

usage() {
  cat <<USAGE
Usage: $0 <profile> [--destination <console-url-or-path>]

Prints a one-time console sign-in URL for <profile> on stdout.

Arguments:
  profile        AWS CLI profile whose credentials open the console.

Flags:
  --destination  Console page to land on: a full https:// console URL, or a
                 path under the profile region's console, e.g.
                 "codesuite/settings/connections". Defaults to the console home.

The URL expires about 15 minutes after it is minted if unused. Once used, the
console session lasts as long as the profile's role session.
USAGE
  exit 1
}

PROFILE=""
DESTINATION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --destination) DESTINATION="${2:-}"; [[ -z "$DESTINATION" ]] && usage; shift 2 ;;
    --*) echo "ERROR: Unknown flag '$1'" >&2; usage ;;
    *)
      [[ -n "$PROFILE" ]] && { echo "ERROR: Unexpected argument '$1'" >&2; usage; }
      PROFILE="$1"; shift ;;
  esac
done
[[ -z "$PROFILE" ]] && usage

for cmd in aws curl jq; do
  command -v "$cmd" >/dev/null || { echo "ERROR: '$cmd' is required" >&2; exit 1; }
done

uri_encode() { jq -rn --arg v "$1" '$v | @uri'; }

if ! CREDS=$(aws configure export-credentials --profile "$PROFILE" --format process); then
  echo "ERROR: Could not resolve credentials for profile '$PROFILE'." >&2
  echo "If the profile uses SSO, run: aws sso login --profile $PROFILE" >&2
  exit 1
fi

SESSION=$(jq -c '{sessionId: .AccessKeyId, sessionKey: .SecretAccessKey, sessionToken: .SessionToken}' <<<"$CREDS")
if jq -e '.sessionToken == null or .sessionToken == ""' <<<"$SESSION" >/dev/null; then
  echo "ERROR: Profile '$PROFILE' resolves to long-term access keys." >&2
  echo "Console federation needs temporary credentials: use a profile that assumes a role or signs in through SSO." >&2
  exit 1
fi

# The request carries no SessionDuration: the endpoint rejects it for role
# credentials with an empty HTTP 400, and without it the console session
# inherits the role session's own expiry.
RESPONSE=$(printf '%s' "$SESSION" | curl -sS -G "$FEDERATION_URL" \
  --data 'Action=getSigninToken' \
  --data-urlencode 'Session@-' \
  -w '\n%{http_code}') || { echo "ERROR: Request to the federation endpoint failed" >&2; exit 1; }
HTTP_CODE="${RESPONSE##*$'\n'}"
BODY="${RESPONSE%$'\n'*}"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Federation endpoint returned HTTP $HTTP_CODE${BODY:+: $BODY}" >&2
  echo "The profile's credentials may have expired; re-resolve them and retry." >&2
  exit 1
fi

TOKEN=$(jq -r '.SigninToken // empty' <<<"$BODY")
[[ -z "$TOKEN" ]] && { echo "ERROR: Federation endpoint returned no SigninToken" >&2; exit 1; }

REGION=$(aws configure get region --profile "$PROFILE" 2>/dev/null || true)
CONSOLE_BASE="https://${REGION:+$REGION.}console.aws.amazon.com/"

if [[ -z "$DESTINATION" ]]; then
  DESTINATION="${CONSOLE_BASE}console/home${REGION:+?region=$REGION}"
elif [[ "$DESTINATION" != https://* ]]; then
  DESTINATION="${CONSOLE_BASE}${DESTINATION#/}"
fi

printf '%s?Action=login&Destination=%s&SigninToken=%s\n' \
  "$FEDERATION_URL" "$(uri_encode "$DESTINATION")" "$(uri_encode "$TOKEN")"
