/**
 * Tests for manage-profile.sh.
 *
 * Each case gets its own AWS config file and access config, pointed at through
 * AWS_CONFIG_FILE and AWS_ACCOUNT_ACCESS_CONFIG. `aws` is a stub placed first on
 * PATH that answers the sso-admin calls from environment variables, so no case
 * reaches AWS. The script runs under `/bin/bash`, which on macOS is bash 3.2.
 *
 * Run: node --test plugins/aws-account-access/scripts/manage-profile.test.ts
 */

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'manage-profile.sh')

const ROOT = mkdtempSync(path.join(tmpdir(), 'manage-profile-'))
after(() => rmSync(ROOT, { recursive: true, force: true }))

const BIN = path.join(ROOT, 'bin')
mkdirSync(BIN)

// list-permission-sets prints STUB_PS_ARNS; describe-permission-set maps an ARN to
// its name through STUB_PS_<last ARN segment>; the status calls pop one status per
// call from STUB_STATUS_FILE.
const AWS_STUB = `#!/bin/bash
echo "$*" >> "$STUB_LOG"
case "$2" in
  list-permission-sets) [ -n "$STUB_LIST_FAIL" ] && exit 255; echo "$STUB_PS_ARNS" ;;
  describe-permission-set)
    while [ $# -gt 0 ]; do [ "$1" = --permission-set-arn ] && arn="$2"; shift; done
    var="STUB_PS_\${arn##*/}"; var="\${var//-/_}"; echo "\${!var}" ;;
  describe-account-assignment-*-status)
    head -1 "$STUB_STATUS_FILE"; sed -i.bak 1d "$STUB_STATUS_FILE" ;;
  *) echo "unexpected aws call: $*" >&2; exit 2 ;;
esac
`
writeFileSync(path.join(BIN, 'aws'), AWS_STUB)
chmodSync(path.join(BIN, 'aws'), 0o755)

const FULL_CONFIG = {
	sso_instance_arn: 'arn:aws:sso:::instance/ssoins-test',
	management_profile: 'mgmt',
	sso_session_name: 'corp',
	region: 'ap-northeast-2',
	default_role: 'ViewOnlyAccess',
	role_session_name: 'operator',
}

let caseCount = 0

function setup(awsConfig = '', accessConfig: object | null = FULL_CONFIG) {
	const dir = path.join(ROOT, `case-${++caseCount}`)
	mkdirSync(dir)
	const files = {
		dir,
		awsConfig: path.join(dir, 'config'),
		accessConfig: path.join(dir, 'access.json'),
		log: path.join(dir, 'aws.log'),
		status: path.join(dir, 'status'),
	}
	writeFileSync(files.awsConfig, awsConfig)
	if (accessConfig) writeFileSync(files.accessConfig, JSON.stringify(accessConfig))
	return files
}

type Files = ReturnType<typeof setup>

function run(files: Files, args: string[], env: Record<string, string> = {}) {
	const result = spawnSync('/bin/bash', [SCRIPT, ...args], {
		encoding: 'utf8',
		env: {
			PATH: `${BIN}:${process.env.PATH}`,
			AWS_CONFIG_FILE: files.awsConfig,
			AWS_ACCOUNT_ACCESS_CONFIG: files.accessConfig,
			AWS_ACCOUNT_ACCESS_POLL_SECONDS: '0',
			STUB_LOG: files.log,
			STUB_STATUS_FILE: files.status,
			...env,
		},
	})
	return { ...result, config: readFileSync(files.awsConfig, 'utf8') }
}

describe('manage-profile.sh', () => {
	describe('add', () => {
		it('writes an SSO profile with the session and region from the access config', () => {
			const f = setup()
			const r = run(f, ['add', '111111111111', 'work', 'AdministratorAccess'])
			assert.equal(r.status, 0, r.stderr)
			assert.match(
				r.config,
				/\[profile work\]\nsso_session = corp\nsso_account_id = 111111111111\nsso_role_name = AdministratorAccess\nregion = ap-northeast-2\n/,
			)
		})

		it("defaults the role to the access config's default_role", () => {
			const f = setup()
			run(f, ['add', '111111111111', 'work'])
			assert.match(readFileSync(f.awsConfig, 'utf8'), /sso_role_name = ViewOnlyAccess/)
		})

		it('marks a temporary profile', () => {
			const f = setup()
			const r = run(f, ['add', '111111111111', 'work', '--temporary'])
			assert.match(r.stdout, /\[TEMPORARY\]/)
			assert.match(r.config, /\[profile work\]\n# TEMPORARY/)
		})

		it('refuses a profile that already exists', () => {
			const f = setup('[profile work]\nregion = x\n')
			const r = run(f, ['add', '111111111111', 'work'])
			assert.equal(r.status, 1)
			assert.match(r.stderr, /already exists/)
		})

		it('does not mistake a profile whose name extends another for it', () => {
			const f = setup('[profile work-hop]\nregion = x\n')
			const r = run(f, ['add', '111111111111', 'work'])
			assert.equal(r.status, 0, r.stderr)
		})

		it('names the missing access-config key', () => {
			const f = setup('', { region: 'ap-northeast-2' })
			const r = run(f, ['add', '111111111111', 'work', 'AdministratorAccess'])
			assert.equal(r.status, 1)
			assert.match(r.stderr, /Set "sso_session_name"/)
			assert.equal(r.config, '')
		})
	})

	describe('add-chained', () => {
		it('writes a role-assumption profile from the source profile', () => {
			const f = setup('[profile work-hop]\nsso_session = corp\n')
			const r = run(f, ['add-chained', '222222222222', 'work', 'work-hop', 'cloudy-staff-admin'])
			assert.equal(r.status, 0, r.stderr)
			assert.match(
				r.config,
				/\[profile work\]\nrole_arn = arn:aws:iam::222222222222:role\/cloudy-staff-admin\nsource_profile = work-hop\nrole_session_name = operator\nregion = ap-northeast-2\n/,
			)
		})

		it('omits role_session_name when the access config has none', () => {
			const { role_session_name: _, ...config } = FULL_CONFIG
			const f = setup('[profile work-hop]\n', config)
			run(f, ['add-chained', '222222222222', 'work', 'work-hop', 'cloudy-staff-admin'])
			assert.doesNotMatch(readFileSync(f.awsConfig, 'utf8'), /role_session_name/)
		})

		it('requires the role name', () => {
			const f = setup('[profile work-hop]\n')
			const r = run(f, ['add-chained', '222222222222', 'work', 'work-hop', '--temporary'])
			assert.equal(r.status, 1)
			assert.match(r.stdout, /Usage:/)
		})

		it('refuses a source profile that does not exist', () => {
			const f = setup()
			const r = run(f, ['add-chained', '222222222222', 'work', 'work-hop', 'cloudy-staff-admin'])
			assert.equal(r.status, 1)
			assert.match(r.stderr, /Source profile 'work-hop' not found/)
		})
	})

	describe('remove', () => {
		it('removes only the named block, with its temporary mark', () => {
			const f = setup(
				'[profile keep]\nregion = a\n\n[profile work]\n# TEMPORARY — remove when done\nrole_arn = x\n\n[profile work-hop]\nregion = b\n',
			)
			const r = run(f, ['remove', 'work'])
			assert.equal(r.status, 0, r.stderr)
			assert.equal(r.config, '[profile keep]\nregion = a\n\n[profile work-hop]\nregion = b\n')
		})

		it('reports a missing profile', () => {
			const f = setup()
			const r = run(f, ['remove', 'work'])
			assert.equal(r.status, 1)
			assert.match(r.stderr, /not found/)
		})
	})

	describe('set-role', () => {
		it("replaces an SSO profile's role and clears its temporary mark", () => {
			const f = setup(
				'[profile work]\n# TEMPORARY — remove when done\nsso_session = corp\nsso_role_name = AdministratorAccess\n\n[profile other]\nsso_role_name = AdministratorAccess\n',
			)
			const r = run(f, ['set-role', 'work', 'ReadOnlyAccess'])
			assert.equal(r.status, 0, r.stderr)
			assert.equal(
				r.config,
				'[profile work]\nsso_session = corp\nsso_role_name = ReadOnlyAccess\n\n[profile other]\nsso_role_name = AdministratorAccess\n',
			)
		})

		it('refuses a role-assumption profile', () => {
			const f = setup('[profile work]\nrole_arn = arn:aws:iam::222222222222:role/x\n')
			const r = run(f, ['set-role', 'work', 'ReadOnlyAccess'])
			assert.equal(r.status, 1)
			assert.match(r.stderr, /not an SSO profile/)
		})
	})

	it('lists SSO and role-assumption profiles', () => {
		const f = setup(
			'[profile sso]\nsso_session = corp\nsso_account_id = 111111111111\nsso_role_name = ViewOnlyAccess\n\n[profile chained]\n# TEMPORARY — remove when done\nrole_arn = arn:aws:iam::222222222222:role/r\nsource_profile = sso\n\n[profile keys]\nregion = x\n',
		)
		const r = run(f, ['list'])
		assert.equal(r.status, 0, r.stderr)
		assert.match(r.stdout, /sso\s+account=111111111111\s+role=ViewOnlyAccess/)
		assert.match(r.stdout, /chained\s+arn:aws:iam::222222222222:role\/r via sso \[TEMPORARY\]/)
		assert.doesNotMatch(r.stdout, /keys/)
	})

	describe('permission-set-arn', () => {
		const stub = {
			STUB_PS_ARNS: 'arn:aws:sso:::permissionSet/ssoins-test/ps-aaa\tarn:aws:sso:::permissionSet/ssoins-test/ps-bbb',
			STUB_PS_ps_aaa: 'ViewOnlyAccess',
			STUB_PS_ps_bbb: 'AdministratorAccess',
		}

		it('resolves a name to its ARN through the management profile', () => {
			const f = setup()
			const r = run(f, ['permission-set-arn', 'AdministratorAccess'], stub)
			assert.equal(r.status, 0, r.stderr)
			assert.equal(r.stdout.trim(), 'arn:aws:sso:::permissionSet/ssoins-test/ps-bbb')
			const log = readFileSync(f.log, 'utf8')
			assert.match(log, /--instance-arn arn:aws:sso:::instance\/ssoins-test --region ap-northeast-2 --profile mgmt/)
		})

		it('reports an unknown name', () => {
			const f = setup()
			const r = run(f, ['permission-set-arn', 'Nope'], stub)
			assert.equal(r.status, 1)
			assert.match(r.stderr, /No permission set named 'Nope'/)
		})

		it('reports a failed listing with the login hint', () => {
			const f = setup()
			const r = run(f, ['permission-set-arn', 'Nope'], { STUB_LIST_FAIL: '1' })
			assert.equal(r.status, 1)
			assert.match(r.stderr, /aws sso login --profile mgmt/)
		})

		it('stops before calling AWS when the instance is not configured', () => {
			const { sso_instance_arn: _, ...config } = FULL_CONFIG
			const f = setup('', config)
			const r = run(f, ['permission-set-arn', 'AdministratorAccess'], stub)
			assert.equal(r.status, 1)
			assert.match(r.stderr, /Set "sso_instance_arn"/)
			assert.throws(() => readFileSync(f.log))
		})
	})

	describe('await-assignment', () => {
		it('polls until the request succeeds', () => {
			const f = setup()
			writeFileSync(f.status, 'IN_PROGRESS\tNone\nSUCCEEDED\tNone\n')
			const r = run(f, ['await-assignment', 'creation', 'req-1'])
			assert.equal(r.status, 0, r.stderr)
			assert.match(r.stdout, /creation succeeded/)
			assert.equal(readFileSync(f.log, 'utf8').trim().split('\n').length, 2)
		})

		it('fails with the reason when the request fails', () => {
			const f = setup()
			writeFileSync(f.status, 'FAILED\tPermission set not provisioned\n')
			const r = run(f, ['await-assignment', 'deletion', 'req-1'])
			assert.equal(r.status, 1)
			assert.match(r.stderr, /deletion failed:.*Permission set not provisioned/)
		})
	})

	it('rejects an unknown flag', () => {
		const f = setup()
		const r = run(f, ['add', '111111111111', 'work', '--sso-session', 'corp'])
		assert.equal(r.status, 1)
		assert.match(r.stderr, /Unknown flag '--sso-session'/)
	})
})
