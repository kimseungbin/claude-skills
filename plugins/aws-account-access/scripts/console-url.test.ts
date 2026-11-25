/**
 * Tests for console-url.sh.
 *
 * `aws` and `curl` are replaced by stubs placed first on PATH, so no case reaches
 * AWS. The stubs record what the script sends — curl's arguments and stdin — and
 * answer from environment variables each case sets. The script runs under
 * `/bin/bash`, which on macOS is bash 3.2, the oldest shell it meets in practice.
 *
 * Run: node --test plugins/aws-account-access/scripts/console-url.test.ts
 */

import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'console-url.sh')

const ROOT = mkdtempSync(path.join(tmpdir(), 'console-url-'))
after(() => rmSync(ROOT, { recursive: true, force: true }))

const BIN = path.join(ROOT, 'bin')
mkdirSync(BIN)

const AWS_STUB = `#!/bin/bash
case "$1 $2" in
  "configure export-credentials")
    [ -n "$STUB_CREDS_FAIL" ] && { echo "The SSO session has expired" >&2; exit 255; }
    printf '%s\\n' "$STUB_CREDS" ;;
  "configure get")
    [ -n "$STUB_REGION" ] || exit 1
    echo "$STUB_REGION" ;;
  *) echo "unexpected aws call: $*" >&2; exit 2 ;;
esac
`

const CURL_STUB = `#!/bin/bash
printf '%s\\n' "$@" > "$STUB_LOG/curl-args"
cat > "$STUB_LOG/curl-stdin"
printf '%s\\n%s' "$STUB_BODY" "$STUB_HTTP_CODE"
`

writeFileSync(path.join(BIN, 'aws'), AWS_STUB)
writeFileSync(path.join(BIN, 'curl'), CURL_STUB)
chmodSync(path.join(BIN, 'aws'), 0o755)
chmodSync(path.join(BIN, 'curl'), 0o755)

const ROLE_CREDS = JSON.stringify({
	Version: 1,
	AccessKeyId: 'ASIAEXAMPLE',
	SecretAccessKey: 'secret/with+chars',
	SessionToken: 'token-value',
	Expiration: '2026-11-25T12:00:00Z',
})

const LONG_TERM_CREDS = JSON.stringify({
	Version: 1,
	AccessKeyId: 'AKIAEXAMPLE',
	SecretAccessKey: 'long-term-secret',
})

interface Stub {
	creds?: string
	credsFail?: boolean
	region?: string
	httpCode?: string
	body?: string
}

let caseCount = 0

function run(args: string[], stub: Stub = {}) {
	const log = path.join(ROOT, `case-${++caseCount}`)
	mkdirSync(log)
	const result = spawnSync('/bin/bash', [SCRIPT, ...args], {
		encoding: 'utf8',
		env: {
			PATH: `${BIN}:${process.env.PATH}`,
			STUB_LOG: log,
			STUB_CREDS: stub.creds ?? ROLE_CREDS,
			STUB_CREDS_FAIL: stub.credsFail ? '1' : '',
			STUB_REGION: stub.region ?? 'ap-northeast-2',
			STUB_HTTP_CODE: stub.httpCode ?? '200',
			STUB_BODY: stub.body ?? JSON.stringify({ SigninToken: 'signin/token+value' }),
		},
	})
	const read = (name: string) => {
		try {
			return readFileSync(path.join(log, name), 'utf8')
		} catch {
			return undefined
		}
	}
	return { ...result, curlArgs: read('curl-args'), curlStdin: read('curl-stdin') }
}

function loginUrl(stdout: string) {
	const url = new URL(stdout.trim())
	return {
		url,
		destination: url.searchParams.get('Destination'),
		token: url.searchParams.get('SigninToken'),
	}
}

describe('console-url.sh', () => {
	it('prints a login URL carrying the sign-in token', () => {
		const r = run(['workload'])
		assert.equal(r.status, 0, r.stderr)
		const { url, token } = loginUrl(r.stdout)
		assert.equal(url.origin + url.pathname, 'https://signin.aws.amazon.com/federation')
		assert.equal(url.searchParams.get('Action'), 'login')
		assert.equal(token, 'signin/token+value')
	})

	it('sends the session on stdin and keeps credentials off the command line', () => {
		const r = run(['workload'])
		assert.equal(r.status, 0, r.stderr)
		assert.deepEqual(JSON.parse(r.curlStdin ?? ''), {
			sessionId: 'ASIAEXAMPLE',
			sessionKey: 'secret/with+chars',
			sessionToken: 'token-value',
		})
		const args = r.curlArgs ?? ''
		assert.match(args, /Action=getSigninToken/)
		assert.match(args, /Session@-/)
		for (const secret of ['ASIAEXAMPLE', 'secret/with+chars', 'token-value']) {
			assert.ok(!args.includes(secret), `curl argv leaked ${secret}`)
		}
	})

	it('omits SessionDuration from the token request', () => {
		const r = run(['workload'])
		assert.equal(r.status, 0, r.stderr)
		assert.ok(!`${r.curlArgs}${r.curlStdin}`.includes('SessionDuration'))
	})

	it("lands on the profile region's console home by default", () => {
		const r = run(['workload'])
		assert.equal(
			loginUrl(r.stdout).destination,
			'https://ap-northeast-2.console.aws.amazon.com/console/home?region=ap-northeast-2',
		)
	})

	it('lands on the global console home when the profile has no region', () => {
		const r = run(['workload'], { region: '' })
		assert.equal(r.status, 0, r.stderr)
		assert.equal(loginUrl(r.stdout).destination, 'https://console.aws.amazon.com/console/home')
	})

	it('resolves a destination path against the regional console', () => {
		const r = run(['workload', '--destination', '/codesuite/settings/connections'])
		assert.equal(
			loginUrl(r.stdout).destination,
			'https://ap-northeast-2.console.aws.amazon.com/codesuite/settings/connections',
		)
	})

	it('passes a full destination URL through unchanged', () => {
		const dest = 'https://us-east-1.console.aws.amazon.com/billing/home#/bills'
		const r = run(['--destination', dest, 'workload'])
		assert.equal(r.status, 0, r.stderr)
		assert.equal(loginUrl(r.stdout).destination, dest)
	})

	it('refuses long-term access keys before calling the endpoint', () => {
		const r = run(['workload'], { creds: LONG_TERM_CREDS })
		assert.equal(r.status, 1)
		assert.match(r.stderr, /long-term access keys/)
		assert.equal(r.curlArgs, undefined)
	})

	it('reports unresolvable credentials with the SSO login hint', () => {
		const r = run(['workload'], { credsFail: true })
		assert.equal(r.status, 1)
		assert.match(r.stderr, /aws sso login --profile workload/)
		assert.equal(r.stdout, '')
	})

	it('reports an HTTP error from the federation endpoint', () => {
		const r = run(['workload'], { httpCode: '400', body: '' })
		assert.equal(r.status, 1)
		assert.match(r.stderr, /HTTP 400/)
		assert.equal(r.stdout, '')
	})

	it('reports a response without a SigninToken', () => {
		const r = run(['workload'], { body: '{}' })
		assert.equal(r.status, 1)
		assert.match(r.stderr, /no SigninToken/)
	})

	it('prints usage when the profile is missing', () => {
		const r = run([])
		assert.equal(r.status, 1)
		assert.match(r.stdout, /Usage:/)
	})
})
