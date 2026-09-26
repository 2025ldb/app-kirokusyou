#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
touch dist/.nojekyll
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
cd "$TMP"
git init -b gh-pages >/dev/null
git add -A
git -c user.name="2025ldb" -c user.email="2025ldb@users.noreply.github.com" commit -m "Publish GitHub Pages"
git push --force "https://github.com/2025ldb/app-kirokusyou.git" HEAD:gh-pages
echo "Published https://2025ldb.github.io/app-kirokusyou/"
