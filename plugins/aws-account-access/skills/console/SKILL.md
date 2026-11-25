---
name: console
description: Open the AWS console for an account already reachable from a CLI profile, signed in through a federated sign-in URL minted from that profile's credentials. Use when a task needs the console (browser-only flows such as a CodeConnections handshake, SES production access, support cases) for an account reached by SSO or a chain of assumed roles, so no manual Switch Role is needed.
argument-hint: "<profile> [destination]"
allowed-tools: Bash Read AskUserQuestion
---

# AWS Console Sign-In

Opens the AWS console as a CLI profile's role. The AWS CLI resolves the profile's credentials — every role hop it chains, SSO included — and the federation endpoint trades them for a one-time sign-in URL. The browser presents that URL, so it reaches accounts that the console's one-hop Switch Role cannot.

This skill only reads credentials. It works with any profile whose credentials are temporary: SSO profiles (including ones written by the `account-access` skill), `role_arn` + `source_profile` chains, and `credential_process` profiles.

**Arguments**: `$ARGUMENTS`
- First token (optional): CLI profile name.
- Second token (optional): console page to land on — a full `https://` console URL, or a path under the profile region's console such as `codesuite/settings/connections`. Defaults to the console home.

## Step 1: Resolve the Profile

If no profile was given, list the configured profiles and ask which one to use via AskUserQuestion:

```bash
aws configure list-profiles
```

Confirm the profile reaches the intended account and role:

```bash
aws sts get-caller-identity --profile <PROFILE>
```

If this fails with an expired SSO token, run `aws sso login --profile <PROFILE>` and retry.

## Step 2: Mint and Open the Sign-In URL

`scripts/console-url.sh` prints the sign-in URL on stdout. The URL is a bearer credential for the console until it is used or expires, so pass it straight to a browser in the same command or tool call that mints it, and keep it out of replies to the user.

**When the session has a built-in browser pane** (an isolated browser inside the Claude app), open the URL there. It holds no other AWS console session, so the sign-in cannot collide with one:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/console-url.sh" <PROFILE> [--destination <DESTINATION>]
```

Then navigate the browser pane to the printed URL.

**Otherwise**, open it in the user's default browser without printing it:

```bash
URL=$("${CLAUDE_PLUGIN_ROOT}/scripts/console-url.sh" <PROFILE> [--destination <DESTINATION>]) && open "$URL"
```

Use `xdg-open` in place of `open` on Linux.

## Step 3: Report

Tell the user:

- Which account and role the console is signed in as (from Step 1).
- When the console session ends — it inherits the role session's expiry:
  ```bash
  aws configure export-credentials --profile <PROFILE> | jq -r .Expiration
  ```
- When the URL went to the default browser: a browser already signed in to an AWS console session replaces or rejects the new one. Signing out first, or opening a private window, avoids the collision. On request, print the URL for them to paste into a private window — it stays valid for about 15 minutes until used.

## Notes

- The script calls the federation endpoint without `SessionDuration`. Role credentials reject that parameter with an empty HTTP 400, and without it the console session lasts as long as the role session.
- Credentials reach the endpoint on curl's stdin, so they stay out of the process list.
- The endpoint is `signin.aws.amazon.com`, which serves the commercial `aws` partition.
- A profile backed by long-term IAM user access keys cannot federate; the script stops with an error before calling the endpoint.
