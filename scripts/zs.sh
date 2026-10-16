#!/bin/bash
# Run Zeroshot as the non-root user zsrun, signed in with the owner's Claude subscription token.
#
#   bash scripts/zs.sh setup            make zsrun, install Zeroshot 7.0.1, copy this tree to /home/zsrun/trial
#   bash scripts/zs.sh check            one tiny Claude Code call as zsrun with the token, and one with a wrong token
#   bash scripts/zs.sh zeroshot <args>  run `zeroshot <args>` as zsrun, in /home/zsrun/trial
#
# Why: Zeroshot 7.0.1 refuses to run as root (its own preflight), and as another user Claude Code
# cannot use the cloud session's own sign-in (RESULTS-zeroshot.md, both earlier attempts). The owner's
# subscription token is in the environment as ZEROSHOT_TOKEN (a variable named CLAUDE_CODE_OAUTH_TOKEN
# did not reach cloud sessions). This script hands it to zsrun's processes as CLAUDE_CODE_OAUTH_TOKEN,
# through the environment only: it is never printed, written to a file or put on a command line.
# zsrun gets a login environment with none of the session's own sign-in (no ANTHROPIC_BASE_URL, no
# host-managed provider variables), so the subscription token is the only credential it can use, and
# `check` proves it by a wrong token failing where the real one works.
#
# Do not edit this script inside a run: the session's permission rule allows running it as it is.
set -euo pipefail

ZS_VERSION=7.0.1
HOME_ZS=/home/zsrun
TREE="$HOME_ZS/trial"
here="$(cd "$(dirname "$0")/.." && pwd)"
nodebin="$(dirname "$(command -v node)")"

need_token() {
  if [ -z "${ZEROSHOT_TOKEN:-}" ]; then
    echo "zs: ZEROSHOT_TOKEN is not set in this environment" >&2
    exit 2
  fi
}

# Run a command line as zsrun. The token travels in this process's environment and through
# runuser's whitelist, never on the command line.
as_zsrun() {
  local token="$1" cmdline="$2"
  (
    for v in $(compgen -e); do
      case "$v" in
        ANTHROPIC_*|CLAUDE*|ZEROSHOT_TOKEN) unset "$v" ;;
      esac
    done
    export CLAUDE_CODE_OAUTH_TOKEN="$token"
    export NODE_EXTRA_CA_CERTS="$HOME_ZS/ca-bundle.crt" SSL_CERT_FILE="$HOME_ZS/ca-bundle.crt"
    keep=CLAUDE_CODE_OAUTH_TOKEN,NODE_EXTRA_CA_CERTS,SSL_CERT_FILE,PATH
    for p in HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy; do
      if [ -n "${!p:-}" ]; then keep="$keep,$p"; fi
    done
    runuser -l zsrun -w "$keep" -c "export PATH=$nodebin:\$PATH; $cmdline"
  )
}

case "${1:-}" in
  setup)
    if ! uid_out=$(id -u zsrun 2>&1); then
      useradd -m -s /bin/bash zsrun
    fi
    if [ -n "${NODE_EXTRA_CA_CERTS:-}" ] && [ -r "$NODE_EXTRA_CA_CERTS" ]; then
      install -o zsrun -m 0644 "$NODE_EXTRA_CA_CERTS" "$HOME_ZS/ca-bundle.crt"
    fi
    if ! zs_path=$(command -v zeroshot 2>&1) || [ "$(zeroshot --version 2>&1 | tail -1)" != "$ZS_VERSION" ]; then
      npm install -g "@the-open-engine/zeroshot@$ZS_VERSION"
    fi
    if [ ! -d "$TREE/.git" ]; then
      runuser -u zsrun -- git -c safe.directory="$here" -c safe.directory="$here/.git" clone -q "$here" "$TREE"
    fi
    echo "zs setup: zsrun $(id -u zsrun), zeroshot $(zeroshot --version 2>&1 | tail -1), tree $TREE ($(runuser -u zsrun -- git -C "$TREE" rev-parse --short HEAD))"
    ;;
  check)
    need_token
    set +e
    as_zsrun "$ZEROSHOT_TOKEN" "cd $TREE && timeout 180 claude -p 'Reply with exactly: ok' --max-turns 1"
    real=$?
    as_zsrun "not-a-real-token" "cd $TREE && timeout 180 claude -p 'Reply with exactly: ok' --max-turns 1"
    wrong=$?
    set -e
    echo "zs check: with the token exit $real; with a wrong token exit $wrong"
    if [ "$real" -eq 0 ] && [ "$wrong" -ne 0 ]; then
      echo "zs check: the subscription token works, and it is the credential in use"
    else
      echo "zs check: not proven (the token must work and a wrong one must fail)"
      exit 1
    fi
    ;;
  zeroshot)
    need_token
    shift
    args=""
    for a in "$@"; do args="$args $(printf '%q' "$a")"; done
    as_zsrun "$ZEROSHOT_TOKEN" "cd $TREE && zeroshot$args"
    ;;
  *)
    echo "usage: bash scripts/zs.sh setup | check | zeroshot <args>" >&2
    exit 2
    ;;
esac
