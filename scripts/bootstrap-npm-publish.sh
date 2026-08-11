#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Build & test"
npm test

echo "==> Pack"
npm pack

echo "==> npm whoami"
if npm whoami --registry https://registry.npmjs.org; then
  echo "Already logged in."
else
  echo "Not logged in. Starting npm web login (complete in browser)…"
  # Drop stale token lines so login can refresh
  if [[ -f "$HOME/.npmrc" ]]; then
    cp -a "$HOME/.npmrc" "$HOME/.npmrc.bak-relay-publish"
    grep -v '_authToken' "$HOME/.npmrc" > "$HOME/.npmrc.tmp" || true
    mv "$HOME/.npmrc.tmp" "$HOME/.npmrc"
  fi
  npm login --auth-type=web --registry https://registry.npmjs.org
fi

echo "==> Publish @hypabolic/relay@0.1.0"
npm publish --access public

echo "==> Verify"
npm view @hypabolic/relay version
npm view @hypabolic/relay dist-tags

echo "Done. Next: configure Trusted Publisher on npmjs for Hypabolic/Relay release.yml"
