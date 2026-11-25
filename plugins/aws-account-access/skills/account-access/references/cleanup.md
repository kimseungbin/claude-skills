# Cleanup (when the user says they're done)

Use the account id, profile name and tier or permission set from the grant — or the existing profile found under "Existing Access" in SKILL.md. Confirm the removal with the user before step 1.

1. **Give the access back.**
   - **Access-broker path:** the broker's `account_access_revoke` with `accountId`, your `icUserId` from `account_access_list`, and the `tier`. A lease that already ran out needs nothing here.
   - **CLI path, Identity Center account:** delete the assignment and wait for it:
     ```bash
     REQ=$(aws sso-admin delete-account-assignment \
       --instance-arn "<SSO_INSTANCE_ARN>" --permission-set-arn "<PS_ARN>" \
       --principal-id "<PRINCIPAL_ID>" --principal-type "<PRINCIPAL_TYPE>" \
       --target-id "<ACCOUNT_ID>" --target-type AWS_ACCOUNT \
       --query AccountAssignmentDeletionStatus.RequestId --output text \
       --region "<REGION>" --profile "<MGMT_PROFILE>")
     "${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh" await-assignment deletion "$REQ"
     ```
   - **CLI path, role-assumption profile:** nothing was granted; continue with step 2.

2. **Remove the CLI profile**, and its `-hop` profile when it has one:
   ```bash
   "${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh" remove <PROFILE_NAME>
   "${CLAUDE_PLUGIN_ROOT}/scripts/manage-profile.sh" remove <PROFILE_NAME>-hop
   ```

3. **Delete cached role credentials.** The CLI keeps a role's temporary credentials in `~/.aws/cli/cache/` until they expire, independent of the grant and the profile:
   ```bash
   grep -l '<ACCOUNT_ID>' ~/.aws/cli/cache/*.json   # then rm each file listed
   ```

4. **Delete Instance Connect key material** if [instance-connect.md](instance-connect.md) was used: `rm -r <scratchpad>/eic-<ACCOUNT_ID>`.

5. **Verify**: on the access-broker path, `account_access_list` no longer lists your tier; on the CLI path, `aws sts get-caller-identity --profile <PROFILE_NAME>` fails because the profile is gone.

A console session opened from the profile with the `console` skill stays valid until its own expiry — close its browser tab as part of cleanup.
