#!/usr/bin/env bash
# Create github.com/gbordiga/MDWord (if missing) and push main + tags.
# Origin (Cursor) stays the `origin` remote. GitHub is the `github` remote.
set -euo pipefail

REPO="${GITHUB_REPO:-gbordiga/MDWord}"
VISIBILITY="${GITHUB_VISIBILITY:-public}"

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login"
  exit 1
fi

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Creating https://github.com/${REPO} (${VISIBILITY})…"
  gh repo create "$REPO" "--${VISIBILITY}" --description "MDWord — semantic document editor with MyST Markdown" --disable-wiki
fi

url="https://github.com/${REPO}.git"
if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$url"
else
  git remote add github "$url"
fi

echo "Pushing main and tags to github…"
git push -u github main
git push github --tags
echo "Done: https://github.com/${REPO}"
