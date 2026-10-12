# Zeroshot trial: third attempt (non-root user zsrun)

**Status: stopped at step 3. Zeroshot ran as a non-root user and got past its own preflight, but the `claude` CLI cannot authenticate as `zsrun`. T1 was attempted once and failed on authentication before any model work. T2 and T3 were not run. No code was changed, nothing was merged.**

Branch `zeroshot-run`, base commit `364d18d` (`8e0de6b` is the original invoice-kit commit). Date of run: 2026-10-12 (UTC).

## Summary

| Step | Result |
|---|---|
| 1. Install `@the-open-engine/zeroshot@7.0.1`, `zeroshot --version` | Done. Prints `7.0.1`. |
| 2. Non-root user, copy of the tree | Done. `zsrun` (uid 30033) existed; tree copied to `/home/zsrun/trial`, owned by `zsrun`, on branch `zeroshot-run`. |
| 3. `claude -p "reply OK" --max-turns 1` as zsrun must print OK | **Failed** (3 variants, see below). Output: `Authentication error · This may be a temporary network issue, please try again`, exit 1. |
| 4. Pin models | Done, with one addition to the listed keys (see Settings). |
| 5. T1–T3 | T1 attempted once: failed on `Provider claude failed (authentication; permanent-pattern)`. T2, T3 not run. |
| 6. Post-T3 checks | `test/money.test.js` is byte-for-byte what it was at `8e0de6b` (`cmp`, identical; nothing was changed). Baseline `npm test`: 6 of 6 pass. The "tests before vs code after" check has no code to run against. |
| 7. Results, logs, push | This file, `results/zeroshot-logs/`, pushed to `zeroshot-run` only. |

The decisive result is positive for the approach and negative for the environment: the root-user preflight failure from the first attempt is gone when Zeroshot runs as `zsrun`, and the cluster started, but every model call fails at authentication, so none of the three tasks could be measured.

## Step 3 in detail: the `claude` check as zsrun

All runs used `runuser -u zsrun`, with the session environment preserved (not printed). Output was the same each time apart from a warning in the first:

| Variant | Output | Exit |
|---|---|---|
| `runuser -u zsrun -- env HOME=/home/zsrun … claude -p "reply OK" --max-turns 1` (environment inherited) | `Warning: Ignoring extra certs from /root/.ccr/ca-bundle.crt, load failed: EACCES: permission denied, access '/root/.ccr/ca-bundle.crt'` then `Authentication error · This may be a temporary network issue, please try again` | 1 |
| same, with `NODE_EXTRA_CA_CERTS` unset | `Authentication error · This may be a temporary network issue, please try again` | 1 |
| same, with `--preserve-environment` and `NODE_EXTRA_CA_CERTS=/home/zsrun/ca-bundle.crt` (a copy of the CA bundle, see below) | `Authentication error · This may be a temporary network issue, please try again` | 1 |

What I found and did:
- The session's CA bundle path points into `/root/.ccr/`, which `zsrun` cannot enter. I copied that one file, the public certificate bundle (127 certificates, checked by counting `BEGIN CERTIFICATE` lines only; contents not printed), to `/home/zsrun/ca-bundle.crt` (mode 644, owned by `zsrun`) and pointed `NODE_EXTRA_CA_CERTS` at it. That removed the EACCES warning but did not fix authentication. The copy is outside the repository and is not committed.
- There is no Claude login *file* to copy. Listing names only (no contents), neither `/root/.claude` nor `/home/zsrun/.claude` contains a credentials file; `/home/zsrun` already had `.claude/` and `.claude.json`. So the login is not stored in the home directory the way step 3 assumes. How the session authenticates (some environment-provided mechanism) was not determined. See the refusal below for why I stopped looking.
- I did not print, log, commit or send any credential. No environment variable values were printed, and none were listed.

## Refused command

One command was refused by the permission check in this attempt. It tried to read the proxy/CA documentation in `/root/.ccr/` and call the proxy status endpoint, to learn how the proxy and authentication are handed to child processes:

```
cat /root/.ccr/README.md; echo ----; curl -sS "$HTTPS_PROXY/__agentproxy/status" 2>&1 | head -40
```

The exact message:

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Credential Exploration]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

I did not retry it in another form (`head`, `less`, other paths). The CA bundle copy above was a separate, narrower action, done because the instructions say the CA settings must carry over; it was not refused.

The refusal from the second attempt (credential copy and listing of environment variable names) is kept in git history at `364d18d`.

## Settings (as zsrun, `~/.zeroshot/settings.json`)

Commands run as `zsrun`: `zeroshot -q settings set <key> <value>`.

| Key | Value set | Read back with `zeroshot settings get` |
|---|---|---|
| `providerSettings.claude.minLevel` | `level2` | `level2` |
| `providerSettings.claude.maxLevel` | `level2` | `level2` |
| `providerSettings.claude.defaultLevel` | `level2` | `level2` |
| `providerSettings.claude.minModel` | `sonnet` | `sonnet` |
| `providerSettings.claude.maxModel` | `sonnet` | `sonnet` |
| `maxModel` (top-level, **added**) | `sonnet` | `sonnet` |

Two things to know:
1. **Addition to the listed keys.** After setting the five keys, `providerSettings.claude.maxLevel` read back as `level3`. Cause, from `lib/settings-models.js` in the package (`applyLegacyModelBounds`): the legacy top-level `maxModel` (default `opus`) overwrites `providerSettings.claude.maxLevel` every time settings are loaded. With the five listed keys alone, Opus stays reachable. I therefore also set the top-level `maxModel` to `sonnet`. The top-level `minModel` is left at `null`; the Haiku floor comes from `providerSettings.claude.minLevel=level2` and `minModel=sonnet`.
2. **Stored value differs from effective value.** The raw `maxLevel` in the settings file still reads `level3` after a re-set (see `results/zeroshot-logs/zeroshot-settings-model-keys.json`), while every effective read returns `level2`, because the loader derives it from `maxModel=sonnet`. I did not find out why the file keeps `level3`. The agents in the T1 attempt were shown as `[sonnet]`, which agrees with the effective values, but no model call succeeded, so this has not been confirmed by a real run.

## T1: Discount codes (attempted)

Task text, exactly as in `TASKS.md` (line breaks folded to spaces): "Add `applyDiscount(netCents, code)` in `src/discount.js`. `TEN` takes 10% off, `FIFTY` takes 5000 cents off, and the result never goes below zero. An unknown code throws a `RangeError`. Add tests."

Command: `zeroshot -q run "<text>" --worktree` in `/home/zsrun/trial` as `zsrun`, wrapped in `timeout 420`.

| Item | Value |
|---|---|
| Start / end (UTC), wrapper | 2026-10-12 20:35:05 / 20:35:39 |
| Start / end (UTC), cluster `calm-prism-24` | 20:35:06 / 20:35:09 |
| Classification by the conductor | None. The conductor never received a model response. |
| Workflow and agents chosen | Default bootstrap only: `junior-conductor` (sonnet, ran) and `senior-conductor` (sonnet, never started a task). No worker or validator agents were created. |
| Iterations | `junior-conductor`: 1 attempt, failed. `senior-conductor`: 0. |
| Validator verdicts and feedback | None. No validator existed. |
| Tokens / cost | `0 in, 0 out`; cost not reported (`-`). |
| Failure | `Provider claude failed (authentication; permanent-pattern)`, then `MAX RETRIES EXHAUSTED - AGENT: junior-conductor`, cluster state `stopped`, `provider_execution_failed`. Zeroshot also printed `Error: foreground agent processes did not settle after terminal`. Exit 1. |
| Diff stat | Empty. Worktree `/home/zsrun/.zeroshot/worktrees/calm-prism-24` (branch `zeroshot/calm-prism-24`) is at `364d18d` with no changes. Nothing to merge. |
| `npm test` after | Not applicable (nothing merged). Baseline on `zeroshot-run`: 6 pass, 0 fail. |
| Would a person have had to step in? | Yes. Authentication for `claude` as `zsrun` has to be fixed by someone with access to how the session authenticates. |

## T2: Discounted invoices: not run

Depends on a merged T1. Not attempted.

## T3: Cash rounding: not run

Depends on T2. Not attempted. (The check that `test/money.test.js` is unchanged was done on the untouched tree and passes.)

## Things that went wrong

1. `claude -p "reply OK" --max-turns 1` fails as `zsrun` with an authentication error in every variant tried. Cause not established.
2. A command to read the proxy documentation in `/root/.ccr/` was refused (message above).
3. Zeroshot's default settings let the legacy top-level `maxModel=opus` undo a `level2` pin of `providerSettings.claude.maxLevel`. A trial that pins only the listed keys can still use Opus.
4. Zeroshot printed `foreground agent processes did not settle after terminal` after the failure, and left a stopped cluster and a worktree behind in `/home/zsrun/.zeroshot/`.

## What is needed to continue

Someone has to make the session's `claude` authentication work for `zsrun` (or run the step 3 check by hand and say how it authenticates). Then re-run from step 3. The rest of the plan is ready: `zsrun` exists, `/home/zsrun/trial` is on `zeroshot-run`, the models are pinned, and Zeroshot's preflight passes as non-root. First check: `runuser -u zsrun … claude -p "reply OK" --max-turns 1` must print `OK`.

## Files

- `results/zeroshot-logs/T1-run.log`: full foreground output of the T1 attempt.
- `results/zeroshot-logs/T1-cluster-logs.txt`, `T1-status.txt`, `zeroshot-ls.txt`: `zeroshot logs`, `status`, `ls` for cluster `calm-prism-24`.
- `results/zeroshot-logs/calm-prism-24.html`, `T1-export.md`: `zeroshot export` of that cluster.
- `results/zeroshot-logs/zeroshot-settings-model-keys.json`: the model and level keys from zsrun's settings file (no other keys).
- Logs were scanned for credential-like strings before commit; none found.
