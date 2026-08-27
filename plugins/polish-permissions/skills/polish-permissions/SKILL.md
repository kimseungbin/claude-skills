---
name: polish-permissions
description: Audit the allow/deny/ask rules across the user, project and local settings scopes, then dedupe them and promote read-only rules up the scope ladder. Use when permission arrays have grown messy, when the same rule keeps getting re-approved in every project, or when reviewing what a repo grants.
argument-hint: "[optional: a tool family to focus on, e.g. gh]"
disable-model-invocation: true
allowed-tools: Bash Read Edit Write AskUserQuestion
---

# /polish-permissions

Permission rules accumulate one prompt at a time. Nothing ever goes back and asks whether the rule you approved in this repo last March belongs in all of them, or whether it is already granted twice.

This reorganizes what is there. It does not discover new rules from transcripts — the built-in `fewer-permission-prompts` skill does that, and the two compose: that one finds rules, this one files them.

## What the scopes actually do

Three files merge at runtime:

| Scope | File | Reaches |
|---|---|---|
| User | `~/.claude/settings.json` | every project, only you |
| Project | `.claude/settings.json` | only this repo, everyone who clones it |
| Local | `.claude/settings.local.json` | only this repo, only you |

Two facts drive every decision below, and both are easy to get wrong:

**`allow`, `deny` and `ask` merge — they do not override.** Unlike scalar settings, where a later scope wins, the arrays union. A rule present in two scopes is granted once, and the second copy does nothing.

**Scope reach is not a ladder.** User scope is broader in projects; project scope is broader in people. Neither contains the other. So a rule at user scope never justifies deleting the committed project copy — that copy is what grants the permission to everyone else who clones the repo, and deleting it revokes their access while yours keeps working. The audit enforces this: it will only ever call a **local** copy safe to delete.

## Step 1: Run the audit

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit.ts" --root "$(pwd)"
```

Add `--json` when you want the structured form to work from. The script only reads.

Read the output before doing anything. It reports six things, in the order they should be dealt with.

## Step 2: Fix parse errors first, if there are any

A settings file that does not parse is **silently ignored in its entirety** — no error, no warning, every rule in it simply stops applying. If the audit reports `PARSE ERROR`, nothing else in the report is trustworthy, because the findings were computed without that file's rules.

Fix the JSON, rerun the audit, and start over.

## Step 3: Apply the mechanical fixes

These three findings have a correct answer that does not need the user's judgement, but do show the changes before writing them.

- **Duplicated inside one file** — the same string listed twice. Delete the extra.
- **Already covered by a broader rule**, where the audit says `→ redundant, drop it`. The wider rule is at a scope that reaches at least as far, so the narrow one grants nothing.
- **Present in more than one scope**, where the audit names a safe copy. It only ever names `local`.

Where the audit says `→ keep` or `→ decide manually`, leave it alone and raise it in step 5 instead. Those are the cases where deleting the rule would actually remove access, and the reason is printed next to the finding.

## Step 4: Surface the conflicts — do not resolve them

Two findings are reported for the user to decide, never auto-applied:

**allow / deny overlap.** `deny` beats `allow` at every scope, so an allow rule a deny rule covers is dead. That is sometimes deliberate — a broad allow with a narrow deny carved out of it is a normal, working pattern (`Bash(git *)` allowed, `Bash(git push *)` denied). Report it, name which rule wins, and move on unless the user asks for a change.

**Wildcard does not cover the bare command.** `Bash(npm test *)` requires a space and at least one argument; it does not grant bare `npm test`. Folding the two together looks like tidying and is actually a revocation. Only the user can say whether they want both.

## Step 5: Promote, one family at a time

This is where the value is. Ask per **tool family** — `gh`, `aws`, `git`, `Read`, `mcp__linear` — not per rule. A user with eighty rules has maybe a dozen families.

The audit marks each family:

- `↑ promote-to-user` — every allow rule in it is provably read-only, from the safelist shipped with this plugin. Recommend promotion.
- `· keep` — the family contains something that modifies state, or is already entirely at user scope. Do not offer promotion; say why if asked.
- `? ask` — the effect cannot be determined from the rule text. **Default to keeping it.**
- `SENSITIVE — reads credentials` — never promote, whatever the other marks say.

### Read-only is not the same as safe to promote

The safelist answers *does this change state*. Promotion needs a second answer: *is it safe to never be asked again, in every project at once*. Those come apart on **data exfiltration**.

`aws secretsmanager get-secret-value` mutates nothing. Neither does `aws ssm get-parameter --with-decryption`, `kubectl get secret`, `gh auth token`, `env`, or `cat .env`. Every one of them is read-only and every one hands back a live credential. A family containing any of them is marked `SENSITIVE` and is never recommended for promotion — even when it is otherwise entirely read-only.

The same guard applies to breadth: a rule broad enough to *reach* a secret inherits the restriction. `Bash(aws * get-*)` names no secret but covers `get-secret-value`, so it is treated as sensitive too.

Use `AskUserQuestion`, one question per family that is `↑` or `?`, offering: keep where it is · local → project · local → user · project → user.

Three rules about this step:

- **Never promote a mutating rule silently.** Promoting `Bash(terraform apply)` to user scope means it stops prompting in every repo you ever open. If the user explicitly asks for it, do it and say plainly what it now covers.
- **Treat unknown MCP tools as mutating.** `mcp__linear__create_issue` and `mcp__linear__list_issues` are indistinguishable by name. The audit marks the whole family `?` for this reason.
- **Promoting means moving, not copying.** Add to the target scope and remove from the source, or you have manufactured exactly the cross-scope duplication this skill exists to remove.

### Wildcards the audit suggests

The audit may propose a wildcard that would replace several rules — `Bash(gh * view*)` in place of four separate `gh ... view` rules.

Every suggestion comes from the read-only safelist in `scripts/safelist.ts`. It never invents one by finding a common prefix in the user's own rules, because that technique turns three harmless `git` rules into `Bash(git *)` and grants `git push` along with them. If a pattern is not on the safelist, it is not suggested — offer it, do not apply it unasked.

A suggestion is also withheld when the pattern could reach a credential read, which is why `Bash(aws * get-*)` is never offered despite `get-` being read-only: it covers `get-secret-value`.

**Say out loud that these widen.** `Bash(aws * list-*)` replacing seven service-specific rules does not just tidy them — it grants `list-` on every AWS service, including ones the user has never touched. That is a decision, not housekeeping.

## Step 6: Write the changes

1. **Back up first.** Copy each file you are about to modify to `<file>.bak`. Add `*.bak` to `.gitignore` if the repo does not already ignore it — otherwise you have left untracked noise in someone's working tree.
2. **Show a unified diff per file** and get confirmation before writing.
3. **Preserve everything else in the file.** These files hold hooks, env vars and model settings. Read, modify the `permissions` arrays, write back — never reconstruct a settings file from the permissions alone.
4. **Verify the result parses**, for every file you touched:
   ```bash
   for f in ~/.claude/settings.json .claude/settings.json .claude/settings.local.json; do
     [ -f "$f" ] && { jq -e . "$f" >/dev/null && echo "ok   $f" || echo "BAD  $f"; }
   done
   ```
   A file you just broke disables every setting in it. Check, do not assume.
5. **Rerun the audit** to confirm the findings you addressed are gone.

Permission edits reload immediately — no restart.

## One interaction worth knowing about

Claude Code runs its own audit over `permissions.allow` at **user scope**, flagging rules broad enough that auto mode either ignores them or would auto-approve something destructive, and offering to remove them.

That check narrows user scope; this skill promotes rules into it. They are not in conflict, but a rule promoted in too broad a form may be flagged for removal shortly after. Promote in the narrowest form that still covers the use — which is what the safelist patterns are — rather than widening a rule on the way up.

## Project-specific configuration

`.claude/config/polish-permissions.json` extends the built-in safelist for tools this plugin has never heard of:

```json
{
  "readonlyBash": ["mycli show *", "mycli status*"],
  "readonlyTools": ["mcp__internal__search_docs"],
  "mutatingMarkers": ["provision", "rotate"],
  "sensitiveReads": ["mycli print-token*", "cat *company-secrets*"]
}
```

`sensitiveReads` marks commands that read secrets without changing anything — the ones that must never be promoted however read-only they look.

It **extends only**. A project cannot shorten the mutating-marker list to make its own deploy command look promotable. Create the file when a user tells you a project-specific command is read-only; a copy of this sample ships at `config/samples/polish-permissions.json`.

## What this deliberately does not do

- **Managed scope** is not touched. It is admin-controlled and not writable here.
- **Cross-repo promotion** is out of scope: the audit reads one project's three scopes. A rule sitting in twelve repos' local settings is invisible to it. Run the skill per repo, or raise this as a follow-up.
- **Glob subsumption beyond wildcard prefixes** is not attempted. `Read(src/**)` versus `Read(src/*.ts)` is left to the user.

## Notes

- Nothing here has dependencies or an install step. `scripts/audit.ts` and `scripts/core.ts` run on Node's built-in TypeScript stripping, and the tests run under `node:test` (`npm test` in `scripts/`, or `node --test`).
- The tests in `scripts/core.test.ts` are written to be read — each case names the behavior it pins down, including the non-obvious scope-reach rules.
