---
name: account-access
description: Grant/revoke access to an AWS member account via IAM Identity Center and configure a matching CLI profile that shares an existing SSO session token cache. Use when you need to jump into a member account for CLI work and clean up afterward.
argument-hint: "[account-id] [profile-name] [--temp]"
allowed-tools: Bash Read Write AskUserQuestion TaskCreate
---

# AWS CLI Account Access

Grant (or revoke) access to an AWS member account through IAM Identity Center (SSO), then write a CLI profile that reuses your existing SSO session — no separate `aws sso login` per profile.

**Arguments**: `$ARGUMENTS`
- First non-flag token (required): AWS account ID.
- Second non-flag token (optional): CLI profile name. Defaults to the account ID.
- `--temp` flag (optional, may appear anywhere): mark access as temporary (adds a cleanup reminder).

Parse by splitting `$ARGUMENTS` on whitespace. Extract `--temp` if present. First non-flag token is `<ACCOUNT_ID>`, second (if any) is `<PROFILE_NAME>` (else `<PROFILE_NAME>` = `<ACCOUNT_ID>`).

## Step 0: Load Configuration

All org-specific values live in a **user config file** (never in this plugin). Resolve it in this order and read the first that exists:

1. Next to the AWS config file: `${AWS_CONFIG_FILE%/*}/claude-aws-cli-access.json` if `AWS_CONFIG_FILE` is set, else `~/.aws/claude-aws-cli-access.json`.
2. Fallback: `~/.config/claude-code/aws-cli-access.json`.

```bash
CFG="${AWS_CONFIG_FILE:-$HOME/.aws/config}"; CFG="${CFG%/*}/claude-aws-cli-access.json"
[ -f "$CFG" ] || CFG="$HOME/.config/claude-code/aws-cli-access.json"
cat "$CFG" 2>/dev/null || echo "NO_CONFIG"
```

The file provides: `sso_instance_arn`, `identity_store_id`, `principal_id`, `principal_type` (default `USER`), `management_profile`, `sso_session_name`, `region`, `default_role`.

If `NO_CONFIG`, run **First-Run Setup** below before continuing.

### First-Run Setup

Auto-detect what you can, confirm with the user, then write the config file (see `config/sample.json` for the shape).

1. **SSO instance + identity store** (one call):
   ```bash
   aws sso-admin list-instances --region <REGION> --profile <MGMT_PROFILE>
   ```
   Returns `InstanceArn` and `IdentityStoreId`.
2. **Principal ID** — find the user in the identity store:
   ```bash
   aws identitystore list-users --identity-store-id <ID> --region <REGION> --profile <MGMT_PROFILE>
   ```
   Match on the user's UserName; take `UserId`.
3. **SSO session name** — detect existing `[sso-session ...]` blocks:
   ```bash
   grep -E '^\[sso-session ' "${AWS_CONFIG_FILE:-$HOME/.aws/config}"
   ```
   If several exist, ask the user which to reuse via AskUserQuestion. If none, tell the user to run `aws configure sso` first and stop.
4. Confirm the assembled values with the user, then write the JSON config to the primary path from Step 0. Never echo it into the repo or a committed file.

## Pre-flight Questions

Before creating any resources, gather missing info in a **single** AskUserQuestion call:

1. **If `--temp` is NOT provided**: ask whether this access is temporary or permanent.
2. **Always**: which role/permission set to assign — default `default_role` from config (usually `ReadOnlyAccess`); the user may need `AdministratorAccess` or another set.

If `--temp` IS provided, skip question 1 (treat as temporary) and only ask question 2.

## Resolve the Permission Set (by name, not ARN)

Permission sets are referenced **by name** — resolve the ARN at runtime so no ARN is hardcoded:

```bash
# List permission set ARNs, then describe each to find the one whose Name matches <ROLE>.
aws sso-admin list-permission-sets --instance-arn <SSO_INSTANCE_ARN> \
  --region <REGION> --profile <MGMT_PROFILE>
# For each ARN:
aws sso-admin describe-permission-set --instance-arn <SSO_INSTANCE_ARN> \
  --permission-set-arn <PS_ARN> --region <REGION> --profile <MGMT_PROFILE>
```

Select the ARN whose `PermissionSet.Name == <ROLE>`. If no match, surface the available names to the user and stop.

## Setup Steps

1. **Ask pre-flight questions** and resolve `<ROLE>` → `<PS_ARN>` and `<IS_TEMPORARY>`.

2. **Create the SSO assignment** using the management profile:
   ```bash
   aws sso-admin create-account-assignment \
     --instance-arn "<SSO_INSTANCE_ARN>" \
     --permission-set-arn "<PS_ARN>" \
     --principal-id "<PRINCIPAL_ID>" \
     --principal-type "<PRINCIPAL_TYPE>" \
     --target-id "<ACCOUNT_ID>" \
     --target-type AWS_ACCOUNT \
     --region "<REGION>" \
     --profile "<MGMT_PROFILE>"
   ```

3. **Add the CLI profile** with the script (session name + region come from config, not hardcoded):
   ```bash
   SCRIPT="${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh"
   # Temporary:
   "$SCRIPT" add <ACCOUNT_ID> <PROFILE_NAME> <ROLE> --temporary \
     --sso-session "<SSO_SESSION_NAME>" --region "<REGION>"
   # Permanent:
   "$SCRIPT" add <ACCOUNT_ID> <PROFILE_NAME> <ROLE> \
     --sso-session "<SSO_SESSION_NAME>" --region "<REGION>"
   ```
   No separate `aws sso login` needed — the profile is written with `sso_session = <SSO_SESSION_NAME>`, sharing that session's existing token cache. If the session token has expired, run `aws sso login --sso-session <SSO_SESSION_NAME>` once.

4. **Verify** access:
   ```bash
   aws sts get-caller-identity --profile <PROFILE_NAME>
   ```

5. Tell the user the account is ready and they can pass `--profile <PROFILE_NAME>` to CLI commands.

6. **If temporary**: create a cleanup reminder with TaskCreate containing `<ACCOUNT_ID>`, `<PROFILE_NAME>`, `<PS_ARN>`, and the exact Cleanup Steps commands below.

## Cleanup Steps (when the user says they're done)

1. **Delete the SSO assignment** (same identifiers as creation):
   ```bash
   aws sso-admin delete-account-assignment \
     --instance-arn "<SSO_INSTANCE_ARN>" \
     --permission-set-arn "<PS_ARN>" \
     --principal-id "<PRINCIPAL_ID>" \
     --principal-type "<PRINCIPAL_TYPE>" \
     --target-id "<ACCOUNT_ID>" \
     --target-type AWS_ACCOUNT \
     --region "<REGION>" \
     --profile "<MGMT_PROFILE>"
   ```

2. **Remove the CLI profile**:
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh" remove <ACCOUNT_ID> <PROFILE_NAME>
   ```

## Notes

- `manage-profile.sh` also supports `set-role <account> <profile> <role>` and `list` (all sso-session profiles).
- All AWS CLI commands pass `--profile <MGMT_PROFILE>` **last**, after the service/action and other args.
- This skill mutates IAM Identity Center assignments and `~/.aws/config`. Confirm destructive actions (assignment deletion) with the user before running.
