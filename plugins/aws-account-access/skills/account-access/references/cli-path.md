# CLI path: grant through IAM Identity Center directly

Followed when no access broker can grant the account (see "Choose the Path" in SKILL.md). Grants made here carry no lease, approval or record outside Identity Center itself, so the skill tracks a temporary grant with a task-list reminder instead.

`SCRIPT` below is `${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh`. It reads every org value from the user config.

## Config

This path needs `sso_instance_arn`, `identity_store_id`, `principal_id`, `principal_type` (default `USER`) and `management_profile`, plus `default_role` for the pre-flight default. Fill any that are missing, confirm them with the user, and write them to the user config:

1. **SSO instance and identity store** (one call):
   ```bash
   aws sso-admin list-instances --region <REGION> --profile <MGMT_PROFILE>
   ```
   Returns `InstanceArn` and `IdentityStoreId`.
2. **Principal ID** — the user's `UserId`, matched on their UserName:
   ```bash
   aws identitystore list-users --identity-store-id <ID> --region <REGION> --profile <MGMT_PROFILE>
   ```

## Account in the Identity Center organization

1. **Pre-flight**, in one AskUserQuestion call:
   - whether the access is temporary or permanent;
   - which permission set to assign — `default_role` from config, or another set such as `AdministratorAccess`.

2. **Resolve the permission set by name:**
   ```bash
   PS_ARN=$("$SCRIPT" permission-set-arn <ROLE>)
   ```
   On "No permission set named", list the available names to the user and stop.

3. **Create the assignment** and wait for Identity Center to provision the role:
   ```bash
   REQ=$(aws sso-admin create-account-assignment \
     --instance-arn "<SSO_INSTANCE_ARN>" --permission-set-arn "$PS_ARN" \
     --principal-id "<PRINCIPAL_ID>" --principal-type "<PRINCIPAL_TYPE>" \
     --target-id "<ACCOUNT_ID>" --target-type AWS_ACCOUNT \
     --query AccountAssignmentCreationStatus.RequestId --output text \
     --region "<REGION>" --profile "<MGMT_PROFILE>")
   "$SCRIPT" await-assignment creation "$REQ"
   ```

4. **Add the profile:**
   ```bash
   "$SCRIPT" add <ACCOUNT_ID> <PROFILE_NAME> <ROLE> [--temporary]
   ```

5. **Verify** with `aws sts get-caller-identity --profile <PROFILE_NAME>`.

6. **If temporary**, add a task-list step naming `<ACCOUNT_ID>`, `<PROFILE_NAME>`, `<PS_ARN>` and [cleanup.md](cleanup.md).

## Account outside the organization

Identity Center cannot assign a permission set there, so access is a role assumed from a profile that already works — the account's own trust policy decides which. Ask the user for the source profile and the role to assume, then:

```bash
"$SCRIPT" add-chained <ACCOUNT_ID> <PROFILE_NAME> <SOURCE_PROFILE> <ROLE_NAME> [--temporary]
aws sts get-caller-identity --profile <PROFILE_NAME>
```

When this fails, check the source profile first (`aws sts get-caller-identity --profile <SOURCE_PROFILE>`). Role-chained sessions last at most 1 hour; the CLI re-assumes transparently, a long-running script may not.
