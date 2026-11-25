# Running commands on an EC2 instance

Needs a profile whose role allows EC2 Instance Connect or Session Manager — an access broker's `connect` or `admin` tier, or a permission set such as `AdministratorAccess`. The Bash tool has no TTY, so every connection runs one command batch and exits. Group what you need into one heredoc per instance per step.

Reading an instance is not changing it. Stay read-only on an instance someone else runs (`ps`, `journalctl`, `docker inspect`, `df`, reading configs) unless the user approves a specific change. Skip files holding credentials (`.git-credentials`, `.env`, `~/.aws`, shell history).

## 1. Find a way in

```bash
aws ec2 describe-instances --profile <PROFILE> --region <REGION> \
  --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress||`-`,ImageId,join(`,`,SecurityGroups[].GroupId),IamInstanceProfile.Arn||`-`,Tags[?Key==`Name`]|[0].Value]' --output table
aws ssm describe-instance-information --profile <PROFILE> --region <REGION> \
  --query 'InstanceInformationList[].[InstanceId,PingStatus,PlatformName]' --output table
curl -s https://checkip.amazonaws.com
```

| Path | Works when |
|---|---|
| Session Manager | the instance is `Online` in `describe-instance-information`, which needs an instance role with `AmazonSSMManagedInstanceCore` and a running SSM agent |
| Instance Connect, direct | the instance has a public IP, its security group allows port 22 from your IP, and the AMI ships the Instance Connect agent (Amazon Linux 2+, Ubuntu 20.04+) |
| Instance Connect Endpoint | an endpoint exists in the VPC (`aws ec2 describe-instance-connect-endpoints`) and the security group allows 22 from it |

When none applies, report it. Opening port 22, attaching a role or creating an endpoint changes the account, and that is the user's decision.

The login user follows the AMI: `ubuntu` for Ubuntu, `ec2-user` for Amazon Linux. Read the AMI name with `aws ec2 describe-images --image-ids <ami>`.

## 2. Instance Connect: one key per account, pushed per batch

Keep the key in the scratchpad, outside `~/.ssh`. A pushed key is valid for 60 seconds, so push right before each `ssh`:

```bash
D=<scratchpad>/eic-<ACCOUNT_ID>
[ -f $D/key ] || { mkdir -p $D && ssh-keygen -q -t ed25519 -N '' -f $D/key; }

aws ec2-instance-connect send-ssh-public-key --instance-id <INSTANCE_ID> --instance-os-user <USER> \
  --ssh-public-key file://$D/key.pub --profile <PROFILE> --region <REGION> --query Success >/dev/null && \
ssh -i $D/key -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$D/known_hosts -o BatchMode=yes -o ConnectTimeout=10 \
  <USER>@<PUBLIC_IP> 'bash -s' <<'EOF'
echo "== os"; lsb_release -ds; nproc; free -m; swapon --show; df -h -x tmpfs -x squashfs
EOF
```

Through an Instance Connect Endpoint, add `-o ProxyCommand='aws ec2-instance-connect open-tunnel --instance-id <INSTANCE_ID> --profile <PROFILE> --region <REGION>'` and connect to the private IP.

## 3. Session Manager: commands without a shell

For a batch of commands, run them through Run Command rather than an interactive session:

```bash
CMD=$(aws ssm send-command --instance-ids <INSTANCE_ID> --document-name AWS-RunShellScript \
  --parameters 'commands=["uptime","free -m"]' --profile <PROFILE> --region <REGION> --query Command.CommandId --output text)
aws ssm get-command-invocation --command-id $CMD --instance-id <INSTANCE_ID> --profile <PROFILE> --region <REGION> \
  --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
```

`send-command` needs `ssm:SendCommand`, which runs as root with no session record, so a connect-only role usually lacks it. Use it under an administrator role; otherwise use Instance Connect, or ask the user to run `aws ssm start-session` in their own terminal.

## Cleanup

Delete `$D` as part of [cleanup.md](cleanup.md). The keys were only ever pushed for 60 seconds, so nothing remains on the instance.
