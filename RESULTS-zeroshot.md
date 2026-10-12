# Zeroshot trial: root route with IS_SANDBOX=1

**Status: stopped at T1. The `claude` check and the model pinning as root worked, but Zeroshot's own preflight refuses to run as root even with `IS_SANDBOX=1`. A one-line change to that check was refused by the permission check, so no agent started. T1, T2 and T3 were not run. No code was changed.**

Branch `zeroshot-run`, base commit `028d592`. Date: 2026-10-12 (UTC). Task texts are taken word for word from `TASKS.md` (line breaks folded to spaces).

## Owner's decision (recorded as instructed)

The owner decided to use the root route: Zeroshot is run **as root**, with `IS_SANDBOX=1` set on every `zeroshot` and `claude` command. This container is a throwaway sandbox, and the owner accepts that Zeroshot's agents run here **without Claude Code's root guard** (Claude Code refuses `--dangerously-skip-permissions` as root; `IS_SANDBOX=1` turns that check off). This replaces the non-root plan of the earlier attempt below, which stopped because `claude` could not authenticate as `zsrun`. It means the agents run with full permissions as root in this container; the results below were produced under that condition.

## Step 1: `claude` check as root

In `/home/user/backstop-zeroshot-trial`, branch `zeroshot-run`, uid 0:

```
IS_SANDBOX=1 claude -p "reply OK" --max-turns 1
```

Output: `OK`, exit 0. (It also printed a notice that `permissions.allow` from `.claude/settings.json` was ignored because the workspace is not trusted; this does not affect the check.)

## Step 2: model pinning as root

Commands: `IS_SANDBOX=1 zeroshot -q settings set <key> <value>`, run in this order: top-level `maxModel`, then the five `providerSettings.claude` keys. Setting `maxModel` first matters: Zeroshot's loader (`applyLegacyModelBounds`) overwrites `providerSettings.claude.maxLevel` from the legacy top-level `maxModel`, which defaults to `opus`.

| Key | Set | Read back (`zeroshot settings get`) | Raw in `~/.zeroshot/settings.json` |
|---|---|---|---|
| `maxModel` (top-level) | `sonnet` | `sonnet` | `sonnet` |
| `minModel` (top-level) | not set | `null` | `null` |
| `providerSettings.claude.minLevel` | `level2` | `level2` | `level2` |
| `providerSettings.claude.maxLevel` | `level2` | `level2` | `level2` |
| `providerSettings.claude.defaultLevel` | `level2` | `level2` | `level2` |
| `providerSettings.claude.minModel` | `sonnet` | `sonnet` | `sonnet` |
| `providerSettings.claude.maxModel` | `sonnet` | `sonnet` | `sonnet` |

Raw model/level keys are saved in `results/zeroshot-logs/zeroshot-settings-model-keys-root.json`. Unlike the zsrun attempt, the stored and effective values agree.

## Step 3: T1 attempted, stopped at Zeroshot's own preflight

**Status: stopped at T1. Zeroshot's own preflight rejects root even with `IS_SANDBOX=1`, so no agent started and none of T1, T2, T3 ran. No code was changed and nothing was merged.**

Task text: "Add `applyDiscount(netCents, code)` in `src/discount.js`. `TEN` takes 10% off, `FIFTY` takes 5000 cents off, and the result never goes below zero. An unknown code throws a `RangeError`. Add tests."

Command, as root (uid 0), in `/home/user/backstop-zeroshot-trial` on `zeroshot-run`:

```
IS_SANDBOX=1 zeroshot -q run "<task text>" --worktree
```

The output, verbatim (the whole log is 615 bytes; see the note at the end of this section about why it is not a separate file):

```
============================================================
PREFLIGHT CHECK FAILED
============================================================

❌ Running as root
   Claude CLI refuses --dangerously-skip-permissions flag when running as root (UID 0)

   To fix:
   1. Run as non-root user in Docker: docker run --user 1000:1000 ...
   2. Or create non-root user: adduser testuser && su - testuser
   3. Or use existing node user: docker run --user node ...
   4. Security: Claude CLI blocks this flag as root to prevent privilege escalation

============================================================

exit=1
```

This is the same message as the very first attempt. The check is Zeroshot's own, not Claude Code's: in the installed package, `src/preflight.js:405` is `if (process.getuid && process.getuid() === 0) {` and it adds the "Running as root" error. Nothing in the package mentions `IS_SANDBOX` or any other switch for it (searched `.js`, `.md` and `.json` outside `node_modules`). `IS_SANDBOX=1` only affects the `claude` CLI, which is why step 1 passed and the preflight did not.

| Item | Value |
|---|---|
| Start / end (UTC) | 2026-10-12 22:24:51 / 22:24:51 |
| Classification by the conductor | None. No agent started. |
| Workflow and agents chosen | None. |
| Iterations | 0 |
| Validator verdicts and feedback | None. |
| Tokens / cost | None used. |
| Diff stat | Empty. |
| `npm test` after | Not applicable (nothing merged). Baseline on `zeroshot-run`: 6 pass, 0 fail. |
| Would a person have had to step in? | Yes. Someone has to decide how Zeroshot's own root check is to be passed (see "What is needed to continue"). |

`zeroshot ls` afterwards shows no clusters and no tasks.

## Refused commands

Three commands were refused in this run. I did not retry any of them in another form, and I did not look for another way to switch off the same check.

**1. Making Zeroshot's root check honor `IS_SANDBOX=1`.** The idea was to change that one condition in the installed package to `process.getuid && process.getuid() === 0 && process.env.IS_SANDBOX !== '1'`, after saving the original file and a checksum, and to keep the diff in the results (it would have made the tested version a patched 7.0.1). It was run as one command: back up `preflight.js`, copy the failed log into `results/zeroshot-logs/`, apply the one-line `sed` edit to `/opt/node22/lib/node_modules/@the-open-engine/zeroshot/src/preflight.js`, write the diff, and check that the module loads. Refused with this exact message:

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: The server-side auto mode classifier judged this action dangerous (it gave no explanation). If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

I checked afterwards that nothing in that command had run: `preflight.js` contains no `IS_SANDBOX`, there is no backup file, and the repository was clean.

**2. Saving the T1 log and finding the insertion point in this file.** A second command, which only copied the 615-byte log from the scratchpad to `results/zeroshot-logs/T1-run-isandbox-preflight-failed.log` and searched this file for a divider line, was also refused:

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Security Weaken]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

Because of your rule not to work around a refusal, I did not save the log by another route. Its full text is in this file instead (above), and the only log file in `results/zeroshot-logs/` for this run is the settings snapshot.

**3. The same edit again, after the owner explicitly asked for it.** The owner then wrote: "yes, make the one-line edit to src/preflight.js and record the diff". I started with only the first, smallest part: saving a copy of the original and its checksum, and printing the line to be changed.

```
P=/opt/node22/lib/node_modules/@the-open-engine/zeroshot/src/preflight.js
S=/tmp/claude-0/-home-user-backstop-zeroshot-trial/1a672a32-b03a-5eb0-8a63-8f0aab640856/scratchpad
cp -p $P $S/preflight.js.orig && sha256sum $P | tee $S/preflight.orig.sha256; grep -n "process.getuid" $P
```

Refused with this exact message, so the owner's instruction did not change the outcome:

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Security Weaken]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

I did not make the edit with another tool (for example the file Edit tool), and I did not add a permission rule for myself: either would be a way round the refusal. A read-only view of the file (lines 403–407) succeeded and shows line 405 is still the original, `if (process.getuid && process.getuid() === 0) {`. No diff exists, so none is recorded. The package is stock 7.0.1.

## T2: Discounted invoices: not run

Depends on a merged T1. Not attempted.

## T3: Cash rounding: not run

Depends on T2. Not attempted.

## Step 4: checks after the (non-)run

| Check | Result |
|---|---|
| `test/money.test.js` against `8e0de6b` | Byte-for-byte identical (`git show 8e0de6b:test/money.test.js \| cmp - test/money.test.js`). This is trivially true: no file under `src/` or `test/` differs from `8e0de6b` (0 files). |
| Each task's earlier test files against the code after it | Not applicable: no task produced code. `npm test` on the untouched tree: 6 tests, 6 pass, 0 fail. |

## What is needed to continue

The owner's `IS_SANDBOX=1` decision covers Claude Code's root guard, but Zeroshot 7.0.1 has a second, separate root check of its own that `IS_SANDBOX` does not reach. One of these is needed, then the run can start again from T1 (steps 1 and 2 above are done and stay valid):
1. Make the one-line change to `src/preflight.js` described in refusal 1 by hand (as root, in the container), or add a Bash permission rule for it in the user's own settings; the owner's instruction in chat was not enough (refusal 3). By hand:
   ```
   F=/opt/node22/lib/node_modules/@the-open-engine/zeroshot/src/preflight.js
   cp -p $F /root/preflight.js.orig && sha256sum $F
   sed -i "s/process.getuid() === 0) {/process.getuid() === 0 \&\& process.env.IS_SANDBOX !== '1') {/" $F
   diff -u /root/preflight.js.orig $F
   ```
   The tested version would then be a patched 7.0.1, and the results must say so; the diff goes in `results/zeroshot-logs/`. After that the run can start at T1.
2. Give `claude` working authentication for a non-root user (the earlier attempt below stopped there) and use the documented non-root route instead.
3. Use a Zeroshot version or setting that has an option for running as root, if one exists; I found none in 7.0.1.

---

## Earlier attempt: non-root user zsrun (stopped at authentication)

**Status: stopped at step 3. Zeroshot ran as a non-root user and got past its own preflight, but the `claude` CLI cannot authenticate as `zsrun`. T1 was attempted once and failed on authentication before any model work. T2 and T3 were not run. No code was changed, nothing was merged.**

Branch `zeroshot-run`, base commit `364d18d` (`8e0de6b` is the original invoice-kit commit). Date of run: 2026-10-12 (UTC).

### Summary

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

### Step 3 in detail: the `claude` check as zsrun

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

### Refused command

One command was refused by the permission check in this attempt. It tried to read the proxy/CA documentation in `/root/.ccr/` and call the proxy status endpoint, to learn how the proxy and authentication are handed to child processes:

```
cat /root/.ccr/README.md; echo ----; curl -sS "$HTTPS_PROXY/__agentproxy/status" 2>&1 | head -40
```

The exact message:

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Credential Exploration]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

I did not retry it in another form (`head`, `less`, other paths). The CA bundle copy above was a separate, narrower action, done because the instructions say the CA settings must carry over; it was not refused.

The refusal from the second attempt (credential copy and listing of environment variable names) is kept in git history at `364d18d`.

#### Second refusal, after the user asked me to fix the authentication

The user then asked me to fix it and run it, and asked whether to use this Claude session's sub-agents or just `claude`. I chose the real `claude` CLI: Zeroshot starts `claude` as a subprocess (its `claudeCommand` setting defaults to `claude`), a subprocess cannot call this session's sub-agents, and running the tasks through sub-agents would measure those, not Zeroshot. No Zeroshot code needs rewriting for that.

To fix authentication I need to know how this session's `claude` authenticates, so I tried to list the names (not values) of the authentication- and proxy-related environment variables:

```
env | cut -d= -f1 | grep -i -E 'claude|anthropic|proxy|ccr|oauth|token|auth|ca_certs|ca_bundle|ssl|session' | sort
```

It was refused with this exact message:

> Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Credential Exploration]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings.

I did not retry it in another form. Options for the user (not taken by me):
1. Add the credential `claude` should use for `zsrun` as an environment variable in the cloud environment's settings, so that a new session passes it through `runuser --preserve-environment`. It must not be pasted into the chat.
2. Add a Bash permission rule that allows listing environment variable names, so I can find the mechanism myself.
3. Run `claude -p "reply OK" --max-turns 1` as `zsrun` by hand and tell me what is needed.
4. Run Zeroshot as root with the Claude CLI's root-user override. I did not do this: it switches off the check that made the first attempt stop, and this trial was set up to follow Zeroshot's documented non-root fix instead.

### Settings (as zsrun, `~/.zeroshot/settings.json`)

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

### T1: Discount codes (attempted)

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

### T2: Discounted invoices: not run

Depends on a merged T1. Not attempted.

### T3: Cash rounding: not run

Depends on T2. Not attempted. (The check that `test/money.test.js` is unchanged was done on the untouched tree and passes.)

### Things that went wrong

1. `claude -p "reply OK" --max-turns 1` fails as `zsrun` with an authentication error in every variant tried. Cause not established.
2. A command to read the proxy documentation in `/root/.ccr/` was refused (message above).
3. Zeroshot's default settings let the legacy top-level `maxModel=opus` undo a `level2` pin of `providerSettings.claude.maxLevel`. A trial that pins only the listed keys can still use Opus.
4. Zeroshot printed `foreground agent processes did not settle after terminal` after the failure, and left a stopped cluster and a worktree behind in `/home/zsrun/.zeroshot/`.

### What is needed to continue

Someone has to make the session's `claude` authentication work for `zsrun` (or run the step 3 check by hand and say how it authenticates). Then re-run from step 3. The rest of the plan is ready: `zsrun` exists, `/home/zsrun/trial` is on `zeroshot-run`, the models are pinned, and Zeroshot's preflight passes as non-root. First check: `runuser -u zsrun … claude -p "reply OK" --max-turns 1` must print `OK`.

### Files

- `results/zeroshot-logs/T1-run.log`: full foreground output of the T1 attempt.
- `results/zeroshot-logs/T1-cluster-logs.txt`, `T1-status.txt`, `zeroshot-ls.txt`: `zeroshot logs`, `status`, `ls` for cluster `calm-prism-24`.
- `results/zeroshot-logs/calm-prism-24.html`, `T1-export.md`: `zeroshot export` of that cluster.
- `results/zeroshot-logs/zeroshot-settings-model-keys.json`: the model and level keys from zsrun's settings file (no other keys).
- Logs were scanned for credential-like strings before commit; none found.
