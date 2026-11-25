# aws-account-access

Get into an AWS **member account** from the CLI and the console:

- **`account-access`** gets you access to an account and configures a matching AWS CLI profile that **reuses your existing SSO session** — no separate `aws sso login` per profile. Grants go through an **access-broker MCP server** when one covers the account, and through IAM Identity Center directly otherwise.
- **`console`** opens the AWS console as any working CLI profile, signed in through a **federated sign-in URL** minted from the profile's credentials — including accounts reached through a chain of assumed roles, which the console's one-hop Switch Role cannot reach.

Built for the common ops loop: jump into a member account, look or fix, then give the access back.

## What `account-access` does

- **Broker path (default).** Asks an MCP server exposing `account_access_request`, `account_access_guide`, `account_access_list` and `account_access_revoke` for your access at a tier (`view`, `read`, `connect`, `admin`). The broker owns the grant: its lease, any approval, and the reason. The skill then writes the profile the broker describes — one SSO profile for an account in the broker's organization, or an SSO hop profile plus a role-assumption profile for an account outside it.
- **CLI path (fallback).** When no broker covers the account, creates the Identity Center account assignment itself for a permission set resolved **by name**, waits for it to provision, and writes the SSO profile. For an account outside the organization, it writes a role-assumption profile from a source profile you name.
- Runs commands on the account's EC2 instances over Instance Connect or Session Manager, with keys kept in the session scratchpad.
- Cleans up: gives the access back, removes the profiles, and deletes cached role credentials and Instance Connect keys.
- Companion `scripts/manage-profile.sh` edits `~/.aws/config` (`add`, `add-chained`, `remove`, `set-role`, `list`) with awk block edits that preserve comments, and resolves permission sets and assignment status for the CLI path. Tests: `node --test plugins/aws-account-access/scripts/manage-profile.test.ts`.

## What `console` does

- Resolves the profile's credentials with `aws configure export-credentials`, so every role hop the profile chains happens in the CLI.
- Trades them at the AWS federation endpoint for a sign-in token and builds a login URL, optionally landing on a given console page.
- Opens the URL in Claude's built-in browser pane when the session has one — isolated from any console session already open in your own browser — or else in your default browser.
- Companion `scripts/console-url.sh <profile> [--destination <url-or-path>]` prints the URL on its own. Tests: `node --test plugins/aws-account-access/scripts/console-url.test.ts`.

The sign-in URL expires about 15 minutes after it is minted if unused; once used, the console session lasts as long as the profile's role session.

## Prerequisites

- AWS CLI v2 with an existing `[sso-session ...]` block in your AWS config (created by `aws configure sso`).
- `jq`, and `curl` for `console`.
- Broker path: an access-broker MCP server connected to Claude Code.
- CLI path: an IAM Identity Center **management profile** that can call `sso-admin` and `identitystore`.

## Configuration

All org-specific values live in a **user config file**, outside any repository. Copy the sample and fill it in:

```bash
cp plugins/aws-account-access/config/sample.json ~/.aws/claude-aws-account-access.json
# or: ~/.config/claude-code/aws-account-access.json
```

| Field | Path | Meaning |
|-------|------|---------|
| `access_mcp` | broker | Tool-name prefix of the access-broker MCP server (`mcp__<server-id>`); without it the skill searches for the tools |
| `sso_session_name` | both | Name of the `[sso-session ...]` new profiles share |
| `region` | both | Region for new profiles and Identity Center calls |
| `role_session_name` | both | Session name stamped on assumed roles, so CloudTrail names you |
| `sso_instance_arn` | CLI | IAM Identity Center instance ARN (`aws sso-admin list-instances`) |
| `identity_store_id` | CLI | Identity store ID (same call) |
| `principal_id` | CLI | Your user ID in the identity store |
| `principal_type` | CLI | `USER` (default) or `GROUP` |
| `management_profile` | CLI | CLI profile with sso-admin permissions |
| `default_role` | CLI | Default permission set name (e.g. `ReadOnlyAccess`) |

The skill fills in missing values on first use: it detects existing sso-sessions, confirms with you, and writes the file. `manage-profile.sh` reads the same file; `AWS_ACCOUNT_ACCESS_CONFIG` points it at another.

## Usage

```
/account-access <account-id> [profile-name]
```

- `/account-access 123456789012` — ask what the access is for, grant the matching tier, profile named by the broker.
- `/account-access 123456789012 sandbox` — the same, with the profile named `sandbox`.

```
/console <profile> [destination]
```

- `/console sandbox` — open the console home in `sandbox`'s region.
- `/console workload codesuite/settings/connections` — land directly on the CodeConnections page.

## Installation

Via the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills
```
