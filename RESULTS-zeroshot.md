# Zeroshot results — NO TASKS WERE RUN

Zeroshot 7.0.1 installed and was configured, but `zeroshot run` refused to start on T1 at its preflight check, so none of T1–T3 were attempted. No code was changed, no merges were made, and there are no validator verdicts, iteration counts, tokens, or diffs to report.

## Install
- `npm install -g @the-open-engine/zeroshot@7.0.1` succeeded (359 packages); `zeroshot --version` printed `7.0.1`.
- `claude` CLI 2.1.296, logged in via OAuth (`claude auth status`: loggedIn true, authMethod oauth_token). No API key.

## Exact settings used (`~/.zeroshot/settings.json`, via `zeroshot settings set`)
- `providerSettings.claude.minLevel = level2`
- `providerSettings.claude.maxLevel = level2`
- `providerSettings.claude.defaultLevel = level2`
- `maxModel = sonnet`, `minModel = sonnet` (added: the legacy global `maxModel` default was `opus`, and `zeroshot settings get providerSettings.claude.maxLevel` kept printing `level3` while the file said `level2`; after setting `maxModel sonnet` it printed `level2`.)
- Left at defaults: `defaultProvider=claude`, `defaultIsolation=none`. Note: the default isolation is `none`, not worktree; I intended to pass `--worktree` explicitly.

## What failed
Branch `zeroshot-result` was created from `zeroshot-start` (e51f42c). Baseline `npm test` on it: 6 pass, 0 fail.

Command: `zeroshot run "<T1 text verbatim>" --worktree` (session runs as UID 0). Exact output:

```
PREFLIGHT CHECK FAILED
❌ Running as root
   Claude CLI refuses --dangerously-skip-permissions flag when running as root (UID 0)

   To fix:
   1. Run as non-root user in Docker: docker run --user 1000:1000 ...
   2. Or create non-root user: adduser testuser && su - testuser
   3. Or use existing node user: docker run --user node ...
   4. Security: Claude CLI blocks this flag as root to prevent privilege escalation
```
Full output: `results/zeroshot-logs/t1-run-attempt.txt`. Per the run instructions I did not work around this check (no user switching, no sandbox-flag overrides). Steps 5 (money.test.js check and cross-task test runs) were not applicable since nothing changed; `test/money.test.js` is untouched from 8e0de6b on this branch.

## To retry
Run the same steps as a non-root user (or in an environment where the `claude` CLI accepts `--dangerously-skip-permissions`).
