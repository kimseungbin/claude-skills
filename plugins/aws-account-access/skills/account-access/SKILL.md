---
name: account-access
description: Get your own access to an AWS member account and a CLI profile for it. Grants go through an access-broker MCP server (account_access_request — it records a tier, lease, approval and reason) and fall back to IAM Identity Center directly from the CLI when no broker covers the account. Also runs commands on the account's EC2 instances over Instance Connect or Session Manager, and gives the access back when done. Use whenever a task needs access to, or a CLI profile for, an account reached by SSO or role chaining; the console skill then opens its console.
argument-hint: "<account-id> [profile-name]"
allowed-tools: Bash Read Write AskUserQuestion ToolSearch
---

# AWS Account Access

Get your own access to an AWS member account, then write a CLI profile that reuses your existing SSO session — no separate `aws sso login` per profile.

**Arguments**: `$ARGUMENTS`
- First token (required): AWS account ID, `<ACCOUNT_ID>`.
- Second token (optional): CLI profile name, `<PROFILE_NAME>`. Defaults to the name the access broker returns, else the account ID.

| Task | Where |
|------|-------|
| Get access through an access broker | this file |
| Get access when no broker covers the account | [references/cli-path.md](references/cli-path.md) |
| Run commands on an EC2 instance | [references/instance-connect.md](references/instance-connect.md) |
| Give the access back | [references/cleanup.md](references/cleanup.md) |
| Open the account's console | the `console` skill, with the profile written here |

`SCRIPT` below is `${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh`; it makes every `~/.aws/config` change, and its usage text (no arguments) documents each command.

## Step 0: Load Configuration

Org-specific values live in a **user config file**, never in this plugin. Read the first that exists:

```bash
CFG="${AWS_CONFIG_FILE:-$HOME/.aws/config}"; CFG="${CFG%/*}/claude-aws-account-access.json"
[ -f "$CFG" ] || CFG="$HOME/.config/claude-code/aws-account-access.json"
cat "$CFG" 2>/dev/null || echo "NO_CONFIG"
```

| Key | Used by | Meaning |
|---|---|---|
| `access_mcp` | broker path | Tool-name prefix of the access-broker MCP server, e.g. `mcp__<server-id>` |
| `sso_session_name` | both | The `[sso-session ...]` new profiles share |
| `region` | both | Region for new profiles and Identity Center calls |
| `role_session_name` | both | Session name stamped on assumed roles, so the target account's CloudTrail names you |
| `sso_instance_arn`, `identity_store_id`, `principal_id`, `principal_type`, `management_profile`, `default_role` | CLI path | See [references/cli-path.md](references/cli-path.md) |

When the file is missing or lacks a key a step needs, fill it in: detect `[sso-session ...]` blocks with `grep -E '^\[sso-session ' "${AWS_CONFIG_FILE:-$HOME/.aws/config}"` (ask which via AskUserQuestion when there are several; when there are none, tell the user to run `aws configure sso` first and stop), take `region` from that session's `sso_region`, and offer `whoami` for `role_session_name`. Confirm the values with the user and write the file at the first path above (shape: `config/sample.json`).

## Step 1: Choose the Path

The broker path is the default. Its tools are deferred, so load them by exact name:

- With `access_mcp` set: `ToolSearch` with `select:<access_mcp>__account_access_request,<access_mcp>__account_access_guide,<access_mcp>__account_access_list,<access_mcp>__account_access_revoke`.
- Without it: `ToolSearch` for `account_access_request`, and take the server whose tool names end in `__account_access_request`, `__account_access_guide`, `__account_access_list` and `__account_access_revoke`. Offer to save its prefix as `access_mcp`.

| Tool | Use |
|---|---|
| `account_access_list` | Who reaches the account now, by tier, with `expiresAt` |
| `account_access_request` | Your own access at a tier: `granted`, `requested` (an approval is pending elsewhere) or `needs_input` (give a reason and call again) |
| `account_access_guide` (`via: cli`) | The profile name, `config` and `expectedArn` for a tier you hold |
| `account_access_revoke` | Give a tier back |

Take the **CLI path** ([references/cli-path.md](references/cli-path.md)) when no server offers these tools, the server cannot be reached, or it reports that it does not manage the account (a not-found error). Tell the user which of these sent you there.

## Step 2: Existing Access

Accounts are often already reachable under a profile named after the client rather than the id:

```bash
grep -n -B3 -A3 -E 'sso_account_id = <ACCOUNT_ID>|role_arn = arn:aws:iam::<ACCOUNT_ID>:' "${AWS_CONFIG_FILE:-$HOME/.aws/config}"
```

On the broker path, also call `account_access_list` for the account. A tier you already hold plus a profile carrying its role is the access: verify it with `aws sts get-caller-identity --profile <its name>` and use it.

## Step 3: Pre-flight Question

Ask what the access is for in one AskUserQuestion call. Ask the purpose, never the tier name, and recommend the least privileged tier that covers what the conversation already says the task is. When the user named a duration, carry it as `days`.

| Purpose (option label) | Tier |
|---|---|
| Look at what runs and what it costs | `view` — metadata and metrics, no log contents or object data |
| Diagnose a problem | `read` — adds log events, parameters, object contents |
| Get onto an instance | `connect` — read plus Instance Connect and Session Manager shells |
| Change resources | `admin` |

A shell has root on the instance, so `connect` is an elevated tier like `admin`. On someone else's account, say so in the option's description.

## Step 4: Request the Access

`account_access_request` with `accountId`, `tier`, the user's reason when they gave one, and `days` only when they named a duration.

- `granted` → continue, and tell the user when it ends (`expiresAt`, in the user's time zone; none means it does not expire).
- `requested` → tell the user an approval is waiting, and stop until it is approved.
- `needs_input` → ask the user why they need it, then call again with `reason`.

## Step 5: Write the CLI Profile

`account_access_guide` with `via: cli` and the tier returns the profile name, the `config` and the `expectedArn`. Write the profiles in `config` with the script, naming them `<PROFILE_NAME>` when the user gave one and after the guide otherwise. The `config` takes one of two shapes:

- **One SSO profile** (`sso_account_id = <ACCOUNT_ID>`) — an account in the broker's Identity Center organization:
  ```bash
  "$SCRIPT" add <ACCOUNT_ID> <PROFILE_NAME> <sso_role_name>
  ```
- **An SSO hop profile plus a `role_arn` profile** — an account outside that organization. The hop signs in to the broker's hop account as a permission set made for this account, and the second profile assumes the account's role from it:
  ```bash
  "$SCRIPT" add <hop's sso_account_id> <PROFILE_NAME>-hop <hop's sso_role_name>
  "$SCRIPT" add-chained <ACCOUNT_ID> <PROFILE_NAME> <PROFILE_NAME>-hop <role name from role_arn>
  ```
  Role-chained sessions last at most 1 hour. The CLI re-assumes transparently; a long-running script may not.

When a profile of that name already exists with another route, confirm with the user, then `"$SCRIPT" remove <PROFILE_NAME>` before writing. Every SSO profile shares `sso_session_name`, so one `aws sso login --sso-session <SSO_SESSION_NAME>` covers them all.

## Step 6: Verify and Report

Compare against the guide's `expectedArn`. Identity Center provisions the role a few seconds after the grant, so a first `ForbiddenException: No access` clears on a retry:

```bash
aws sts get-caller-identity --profile <PROFILE_NAME>
```

Tell the user the account is ready under `--profile <PROFILE_NAME>`, at which tier, and until when. When the lease matters later in the session, add a task-list step naming the account, the profile and [references/cleanup.md](references/cleanup.md). When the task needs the console, open it as this profile with the `console` skill.

## Notes

- All AWS CLI commands pass `--profile` **last**, after the service, action and other arguments.
- This skill changes access grants and `~/.aws/config`. Confirm revocations and profile replacements with the user before running them.
