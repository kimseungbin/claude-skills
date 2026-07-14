# aws-cli-access

Grant or revoke access to an AWS **member account** through IAM Identity Center (SSO), and configure a matching AWS CLI profile that **reuses your existing SSO session** — no separate `aws sso login` per profile.

Built for the common ops loop: jump into a member account for a quick look, then clean up.

## What it does

- Creates an SSO account assignment for a permission set (resolved **by name**, e.g. `ReadOnlyAccess` / `AdministratorAccess`) and writes an `[profile ...]` block referencing a shared `[sso-session ...]`.
- Reuses the existing SSO session token cache — new profiles work immediately after any prior `aws sso login`.
- `--temp` flag for time-bound access, with an auto-created cleanup reminder containing the exact revoke commands.
- Pre-flight prompts for permanence and role choice.
- Companion `scripts/manage-profile.sh` cleanly edits `~/.aws/config` (`add` / `remove` / `set-role` / `list`) with awk-based block edits that preserve comments.

## Prerequisites

- AWS CLI v2 configured with an IAM Identity Center **management profile** that can call `sso-admin` and `identitystore`.
- An existing `[sso-session ...]` block in your AWS config (created by `aws configure sso`).

## Configuration

All org-specific values live in a **user config file** (never committed). Copy the sample and fill it in:

```bash
cp plugins/aws-cli-access/config/sample.json ~/.aws/claude-aws-cli-access.json
# or: ~/.config/claude-code/aws-cli-access.json
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

The `manage-profile.sh` script reads the session name and region from `--sso-session` / `--region` flags or the `AWS_CLI_ACCESS_SSO_SESSION` / `AWS_CLI_ACCESS_REGION` environment variables — nothing is hardcoded.

## Usage

```
/account-access <account-id> [profile-name] [--temp]
```

- `/account-access 123456789012` — grant default-role access, profile named after the account ID.
- `/account-access 123456789012 sandbox --temp` — temporary access, profile `sandbox`, with a cleanup reminder.

## Installation

Via the Claude Code marketplace:

```bash
claude install kimseungbin/claude-skills
```
