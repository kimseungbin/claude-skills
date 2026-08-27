// Read-only classification data.
//
// Promotion to a broader scope is only ever *recommended* for rules this file
// can prove are read-only. Everything else defaults to "keep where it is" —
// the cost of wrongly promoting a mutating rule is that a destructive command
// stops prompting in every project at once, which is not a mistake worth
// risking to save a keystroke.
//
// Entries are glob patterns matched against a Bash rule's specifier with any
// trailing wildcard removed. `*` matches any run of characters.

/** Bash command shapes that cannot modify state. */
export const READONLY_BASH: readonly string[] = [
	// version control — inspection only
	'git status*',
	'git diff*',
	'git log*',
	'git show*',
	'git branch',
	'git branch -a*',
	'git branch --list*',
	'git remote -v*',
	'git remote show*',
	'git blame*',
	'git describe*',
	'git rev-parse*',
	'git rev-list*',
	'git ls-files*',
	'git ls-remote*',
	'git shortlog*',
	'git tag -l*',
	'git tag --list*',
	'git stash list*',
	'git config --get*',
	'git config --list*',

	// github cli
	'gh * view*',
	'gh * list*',
	'gh * status*',
	'gh search *',
	'gh api --method GET *',
	'gh auth status*',

	// aws — the three read-only verb families
	'aws * describe-*',
	'aws * list-*',
	'aws sts get-caller-identity*',
	'aws * get-*',
	'aws s3 ls*',

	// kubernetes
	'kubectl get *',
	'kubectl describe *',
	'kubectl logs *',
	'kubectl explain *',
	'kubectl top *',
	'kubectl api-resources*',
	'kubectl config get-contexts*',
	'kubectl config current-context*',

	// containers
	'docker ps*',
	'docker images*',
	'docker inspect *',
	'docker logs *',
	'docker version*',
	'docker compose ps*',
	'docker compose config*',

	// package managers — query subcommands only
	'npm ls*',
	'npm list*',
	'npm view *',
	'npm outdated*',
	'npm run',
	'pnpm ls*',
	'pnpm list*',
	'pnpm outdated*',
	'yarn list*',
	'yarn info *',
	'pip list*',
	'pip show *',
	'pip freeze*',
	'cargo tree*',
	'cargo metadata*',
	'go list *',
	'go version*',

	// infrastructure — plan/validate never applies
	'terraform plan*',
	'terraform validate*',
	'terraform show*',
	'terraform output*',
	'terraform fmt -check*',
	'cdk diff*',
	'cdk list*',
	'cdk ls*',

	// filesystem inspection
	'ls*',
	'wc *',
	'file *',
	'stat *',
	'find *',
	'tree*',
	'du *',
	'df*',
	'pwd*',
	'which *',
	'type *',
	'realpath *',
	'basename *',
	'dirname *',

	// text search
	'grep *',
	'rg *',
	'ag *',
	'jq *',
	'yq *',
	'diff *',
	'sort *',
	'uniq *',
	'cut *',
	'column *',

	// misc introspection
	'echo *',
	'date*',
	'uname*',
	'whoami*',
	'node --version*',
	'python3 --version*',
	'man *',
	'* --help',
	'* --version',
	'*-h',
]

/**
 * Tools whose every invocation is read-only, keyed by the tool name that opens
 * a permission rule. A rule naming one of these is safe to promote regardless
 * of its specifier.
 */
export const READONLY_TOOLS: readonly string[] = [
	'Read',
	'Glob',
	'Grep',
	'WebSearch',
	'WebFetch',
	'NotebookRead',
	'TodoWrite', // session-local scratch state; touches no project file
	'ListAgents',
	'TaskList',
	'TaskGet',
	'TaskOutput',
]

/** Tools that write. Never recommended for promotion. */
export const MUTATING_TOOLS: readonly string[] = [
	'Edit',
	'Write',
	'MultiEdit',
	'NotebookEdit',
	'Artifact',
	'KillShell',
]

/**
 * Verbs that mark a command as mutating.
 *
 * Matched per token, never as a raw substring: `codecommit` must not match
 * `commit`, and `mcp` must not match `cp`. A token also matches when it is the
 * marker followed by a hyphen, which is how AWS and similar CLIs spell their
 * mutating subcommands (`delete-bucket`, `put-object`, `terminate-instances`).
 */
export const MUTATING_MARKERS: readonly string[] = [
	// filesystem
	'rm',
	'rmdir',
	'mv',
	'cp',
	'dd',
	'tee',
	'chmod',
	'chown',
	'truncate',
	'mkfs',
	'kill',
	// package and release verbs
	'install',
	'uninstall',
	'publish',
	'deploy',
	// version control
	'push',
	'commit',
	'merge',
	'rebase',
	'reset',
	'checkout',
	// infrastructure and API verbs
	'apply',
	'destroy',
	'delete',
	'create',
	'update',
	'put',
	'terminate',
]

/**
 * Commands that do not modify anything and still must never be promoted.
 *
 * The read-only safelist answers "does this change state". Promotion needs a
 * second answer: "is this safe to stop prompting for, in every project at
 * once". Those come apart on data exfiltration — `get-secret-value` mutates
 * nothing and hands back a production credential.
 *
 * A rule matching any pattern here is never recommended for promotion, and no
 * suggested wildcard is allowed to cover one.
 */
export const SENSITIVE_READS: readonly string[] = [
	// AWS credential and secret material
	'aws * get-secret-value*',
	'aws * get-parameter*',
	'aws iam get-credential-report*',
	'aws iam get-*-policy*',
	'aws sts get-session-token*',
	'aws sts assume-role*',
	'aws kms decrypt*',
	'aws s3api get-object*',
	'aws s3 cp*',
	// EC2 user-data routinely carries bootstrap secrets
	'aws ec2 describe-instance-attribute*',
	// Kubernetes secrets are base64, not encrypted
	'kubectl get secret*',
	'kubectl describe secret*',
	// token-printing subcommands
	'gh auth token*',
	// `claude mcp get` prints a server's env block, which carries API keys
	'claude mcp get*',
	'gh secret *',
	'vault read*',
	'vault kv get*',
	'op read*',
	'security find-generic-password*',
	// whole-environment dumps
	'env',
	'printenv*',
	'set',
	// reading credential files by path
	'cat *credential*',
	'cat *secret*',
	'cat *.env*',
	'cat *.pem',
	'cat *id_rsa*',
	'cat *_token*',
	'cat *.aws/*',
	'cat *.ssh/*',
	'cat *.npmrc*',
	'cat *.netrc*',
]
