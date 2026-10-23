#!/usr/bin/env bash
#
# Puts the backend's source beside this checkout, at ../backend, where the superproject has it (ADR-0009:
# both repositories are its submodules).
#
# Several specs read it there, so that the two halves cannot drift (invariant §7): the OpenAPI document the
# API client is checked against, and the backend's constants the screens mirror — the office time zone, the
# activation code, the product catalog, template names, the production template, the permission catalog. A
# CI checkout of this repository alone has none of it, and its first run of Phase 18.7 failed six spec files
# on ENOENT (2026-10-23).
#
# Read-only, over SSH, with a deploy key of the backend repository: GITHUB_TOKEN reads this repository and
# nothing else. github.com's host keys come from api.github.com/meta, over TLS, rather than from a first
# connection's say-so. The key is written to a file only for the clone and removed with it.
#
# Which branch: a pull request's own branch where the backend has one — a release PR's development, a
# companion PR's branch — and otherwise the branch it merges into; a push, the branch it was pushed to.
#
#   BACKEND_DEPLOY_KEY   the deploy key's private half (a repository secret, and a Dependabot one)
#   BACKEND_REPOSITORY   owner/name of the backend repository
#   HEAD_REF             a pull request's branch; empty for a push
#   BASE_REF             the branch a pull request merges into, or the branch pushed to
#
#   .github/ci/backend-beside.sh
set -euo pipefail

# On a laptop ../backend is the superproject's own submodule, and this would put a clone in its way.
if [ "${GITHUB_ACTIONS:-}" != true ]; then
  echo "backend-beside.sh runs in GitHub Actions only: here ../backend is already the submodule." >&2
  exit 1
fi
: "${BACKEND_REPOSITORY:?owner/name of the backend repository}"
: "${BASE_REF:?the branch this run is for}"
if [ -z "${BACKEND_DEPLOY_KEY:-}" ]; then
  echo "::error::BACKEND_DEPLOY_KEY is not set. Specs read the backend's OpenAPI document and constants," \
    "and this key is how CI reads them: README.md, CI, says how to make one."
  exit 1
fi

work=${RUNNER_TEMP:-$(mktemp -d)}/backend-access
rm -rf "$work"
mkdir -m 700 "$work"
trap 'rm -rf "$work"' EXIT

printf '%s\n' "$BACKEND_DEPLOY_KEY" >"$work/key"
chmod 600 "$work/key"
curl -fsS --retry 3 https://api.github.com/meta |
  python3 -c 'import json, sys; [print("github.com", k) for k in json.load(sys.stdin)["ssh_keys"]]' >"$work/known_hosts"
export GIT_SSH_COMMAND="ssh -i $work/key -o IdentitiesOnly=yes -o UserKnownHostsFile=$work/known_hosts -o StrictHostKeyChecking=yes"

url="git@github.com:${BACKEND_REPOSITORY}.git"
ref=$BASE_REF
if [ -n "${HEAD_REF:-}" ] && git ls-remote --exit-code --heads "$url" "$HEAD_REF" >/dev/null; then
  ref=$HEAD_REF
fi

# The top level (openapi.json among it) and src/; nothing the specs do not read.
checkout=$(cd .. && pwd)/backend
rm -rf "$checkout"
git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$ref" "$url" "$checkout"
git -C "$checkout" sparse-checkout set src
echo "../backend: ${BACKEND_REPOSITORY}@${ref} ($(git -C "$checkout" rev-parse --short HEAD))"
