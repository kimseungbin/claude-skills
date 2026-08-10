#!/bin/bash
# plugin_version: 1.0.18
#
# Compose git diff output with the project's diff_policy exclusions applied.
#
# The commit skill must never load diffs of derived files (lock files, build
# output, codegen). Encoding that as a prose instruction is advisory — the model
# can still run a bare `git diff`. Encoding it as a git pathspec is enforcing:
# excluded content is never emitted in the first place.
#
# Exclusion patterns are the union of:
#   1. diff_policy.never_read in .claude/config/git/commit/main.yaml
#   2. .gitattributes entries marked `-diff` or `linguist-generated=true`
#   3. a built-in default (common lock files), used only when neither exists
#
# Usage:
#   changed.sh stat                 Staged + unstaged stat, exclusions applied
#   changed.sh diff [--staged] F... Diff for the named files, exclusions applied
#   changed.sh policy               Print the resolved exclusion patterns
#   changed.sh check-pairs          Report derived files changed without their source
#
# Env:
#   COMMIT_CONFIG   override config path (default .claude/config/git/commit/main.yaml)

set -euo pipefail

CONFIG="${COMMIT_CONFIG:-.claude/config/git/commit/main.yaml}"
GITATTRS=".gitattributes"

DEFAULT_PATTERNS="package-lock.json
yarn.lock
pnpm-lock.yaml"

# Extract a flat YAML list under `key:` — no nesting, quoted or bare items.
extract_list() {
	local key="$1" file="$2"
	[ -f "$file" ] || return 0
	awk -v key="$key" '
		$0 ~ "^[[:space:]]*" key ":[[:space:]]*$" { inlist = 1; next }
		inlist && /^[[:space:]]*#/ { next }
		inlist && /^[[:space:]]*-[[:space:]]/ {
			line = $0
			sub(/^[[:space:]]*-[[:space:]]*/, "", line)
			gsub(/^"|"$/, "", line)
			gsub(/^'"'"'|'"'"'$/, "", line)
			if (line != "") print line
			next
		}
		inlist { inlist = 0 }
	' "$file"
}

# Extract a flat YAML map under `key:` as "lhs<TAB>rhs" lines.
extract_map() {
	local key="$1" file="$2"
	[ -f "$file" ] || return 0
	awk -v key="$key" '
		$0 ~ "^[[:space:]]*" key ":[[:space:]]*$" { inmap = 1; next }
		inmap && /^[[:space:]]*#/ { next }
		inmap && /^[[:space:]]*[^[:space:]-].*:/ {
			line = $0
			sub(/^[[:space:]]*/, "", line)
			idx = index(line, ":")
			k = substr(line, 1, idx - 1)
			v = substr(line, idx + 1)
			gsub(/^[[:space:]]+|[[:space:]]+$/, "", v)
			gsub(/^"|"$/, "", k); gsub(/^"|"$/, "", v)
			if (k != "" && v != "") print k "\t" v
			next
		}
		inmap { inmap = 0 }
	' "$file"
}

# Patterns from .gitattributes: lines marking a path `-diff` or linguist-generated.
gitattr_patterns() {
	[ -f "$GITATTRS" ] || return 0
	grep -vE '^[[:space:]]*(#|$)' "$GITATTRS" 2>/dev/null |
		grep -E '(^|[[:space:]])(-diff|linguist-generated(=true)?)([[:space:]]|$)' |
		sed -E 's/[[:space:]].*$//'
}

# Normalize to gitignore-style depth semantics: a pattern containing no `/`
# matches at any depth, one containing `/` is anchored to the repo root. Git
# pathspec globs are always anchored, so slash-less patterns get a `**/` prefix.
# Without this, `*.generated.ts` from .gitattributes would match only root-level
# files, silently diverging from what git itself does with that same line.
normalize_patterns() {
	local p
	while IFS= read -r p; do
		[ -n "$p" ] || continue
		case "$p" in
		*/*) printf '%s\n' "$p" ;;
		*) printf '**/%s\n' "$p" ;;
		esac
	done
}

resolve_patterns() {
	local from_config from_attrs combined
	from_config=$(extract_list "never_read" "$CONFIG")
	from_attrs=$(gitattr_patterns)
	combined=$(printf '%s\n%s\n' "$from_config" "$from_attrs" | sed '/^$/d' | normalize_patterns | sort -u)
	if [ -z "$combined" ]; then
		printf '%s\n' "$DEFAULT_PATTERNS" | normalize_patterns
	else
		printf '%s\n' "$combined"
	fi
}

# Build the pathspec array: "." plus one :(exclude,glob) entry per pattern.
#
# The `glob` magic is required. Without it git uses wildmatch without
# WM_PATHNAME, where `*` silently crosses `/` and a leading `**/` fails to match
# a repo-root path — so `**/dist/**` would NOT exclude `dist/bundle.js`. With
# `glob`, semantics are predictable: `*` stays within one path component and
# `**/` spans directories, so nested patterns need an explicit `**/` prefix.
build_pathspec() {
	PATHSPEC=(".")
	local p
	while IFS= read -r p; do
		[ -n "$p" ] && PATHSPEC+=(":(exclude,glob)$p")
	done <<<"$(resolve_patterns)"
}

cmd_stat() {
	build_pathspec
	echo "# staged"
	git diff --staged --stat -- "${PATHSPEC[@]}"
	echo "# unstaged"
	git diff --stat -- "${PATHSPEC[@]}"

	# Report what was withheld, computed as a set difference rather than by
	# matching patterns against names — the pathspec is the authority on what
	# it excluded, and globs cannot be compared as fixed strings.
	local all kept excluded
	all=$(git diff --name-only HEAD 2>/dev/null | sort -u || true)
	kept=$(git diff --name-only HEAD -- "${PATHSPEC[@]}" 2>/dev/null | sort -u || true)
	excluded=$(comm -23 <(printf '%s\n' "$all") <(printf '%s\n' "$kept") | sed '/^$/d')
	if [ -n "$excluded" ]; then
		echo "# excluded by diff_policy (still committed; diff deliberately not read)"
		printf '%s\n' "$excluded"
	fi
	return 0
}

cmd_diff() {
	local staged=""
	if [ "${1:-}" = "--staged" ]; then
		staged="--staged"
		shift
	fi
	[ $# -gt 0 ] || {
		echo "changed.sh diff: name at least one file" >&2
		exit 2
	}
	build_pathspec
	# Caller-named files first, then the exclusions still apply on top.
	git diff $staged -- "$@" "${PATHSPEC[@]:1}"
}

# A derived file that moved without its source is itself the change — its diff
# must be read, not skipped. Report those so the skill can surface them.
cmd_check_pairs() {
	local changed derived source found=0
	changed=$(git diff --name-only HEAD 2>/dev/null || true)
	[ -n "$changed" ] || return 0
	while IFS=$'\t' read -r derived source; do
		[ -n "$derived" ] || continue
		if printf '%s\n' "$changed" | grep -Fxq "$derived"; then
			if ! printf '%s\n' "$changed" | grep -Fxq "$source"; then
				[ "$found" -eq 0 ] && echo "# derived files changed WITHOUT their source — read these diffs:"
				echo "$derived (expected alongside $source)"
				found=1
			fi
		fi
	done <<<"$(extract_map "commit_with" "$CONFIG")"
	return 0
}

case "${1:-}" in
stat)
	cmd_stat
	;;
diff)
	shift
	cmd_diff "$@"
	;;
policy)
	resolve_patterns
	;;
check-pairs)
	cmd_check_pairs
	;;
*)
	sed -n '4,26p' "$0"
	exit 2
	;;
esac
