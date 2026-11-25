# aws-account-access

Get into an AWS **member account** from the CLI and the console:

- **`account-access`** grants or revokes access through IAM Identity Center (SSO) and configures a matching AWS CLI profile that **reuses your existing SSO session** — no separate `aws sso login` per profile.
- **`console`** opens the AWS console as any working CLI profile, signed in through a **federated sign-in URL** minted from the profile's credentials — including accounts reached through a chain of assumed roles, which the console's one-hop Switch Role cannot reach.

Built for the common ops loop: jump into a member account for a quick look, then clean up.

## What `account-access` does

- Creates an SSO account assignment for a permission set (resolved **by name**, e.g. `ReadOnlyAccess` / `AdministratorAccess`) and writes an `[profile ...]` block referencing a shared `[sso-session ...]`.
- Reuses the existing SSO session token cache — new profiles work immediately after any prior `aws sso login`.
- `--temp` flag for time-bound access, with an auto-created cleanup reminder containing the exact revoke commands.
- Pre-flight prompts for permanence and role choice.
- Companion `scripts/manage-profile.sh` cleanly edits `~/.aws/config` (`add` / `remove` / `set-role` / `list`) with awk-based block edits that preserve comments.

## What `console` does

- Resolves the profile's credentials with `aws configure export-credentials`, so every role hop the profile chains happens in the CLI.
- Trades them at the AWS federation endpoint for a sign-in token and builds a login URL, optionally landing on a given console page.
- Opens the URL in Claude's built-in browser pane when the session has one — isolated from any console session already open in your own browser — or else in your default browser.
- Companion `scripts/console-url.sh <profile> [--destination <url-or-path>]` prints the URL on its own. Tests: `node --test plugins/aws-account-access/scripts/console-url.test.ts`.

The sign-in URL expires about 15 minutes after it is minted if unused; once used, the console session lasts as long as the profile's role session.

## Prerequisites

- AWS CLI v2 configured with an IAM Identity Center **management profile** that can call `sso-admin` and `identitystore` (for `account-access`).
- An existing `[sso-session ...]` block in your AWS config (created by `aws configure sso`).
- `curl` and `jq` (for `console`).

## Configuration

All org-specific values live in a **user config file** (never committed). Copy the sample and fill it in:

```bash
cp plugins/aws-account-access/config/sample.json ~/.aws/claude-aws-account-access.json
# or: ~/.config/claude-code/aws-account-access.json
```

| Field | Meaning |
|-------|---------|
| `sso_instance_arn` | IAM Identity Center instance ARN (`aws sso-admin list-instances`) |
| `identity_store_id` | Identity store ID (same call) |
| `principal_id` | Your user ID in the identity store |
| `principal_type` | `USER` (default) or `GROUP` |
| `management_profile` | CLI profile with sso-admin permissions |
| `sso_session_name` | Name of the `[sso-session ...]` to reuse |
| `region` | Region for admin calls and new profiles |
| `default_role` | Default permission set name (e.g. `ReadOnlyAccess`) |

If the config is missing, the skill runs a **first-run setup** that auto-detects the instance, identity store, and existing sso-sessions, confirms with you, and writes the file.

The `manage-profile.sh` script reads the session name and region from `--sso-session` / `--region` flags or the `AWS_ACCOUNT_ACCESS_SSO_SESSION` / `AWS_ACCOUNT_ACCESS_REGION` environment variables — nothing is hardcoded.

## Usage

```
/account-access <account-id> [profile-name] [--temp]
```

- `/account-access 123456789012` — grant default-role access, profile named after the account ID.
- `/account-access 123456789012 sandbox --temp` — temporary access, profile `sandbox`, with a cleanup reminder.

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
