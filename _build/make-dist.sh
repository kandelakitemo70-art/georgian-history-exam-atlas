#!/usr/bin/env bash
# Copies the static site (no _build) into _build/dist for deployment,
# and writes _build/artifact-index.html (index.html without the html/head/body wrapper, for the claude.ai artifact).
set -e
cd "$(dirname "$0")/.."
rm -rf _build/dist && mkdir -p _build/dist
cp index.html manifest.webmanifest sw.js _build/dist/
cp -r assets data img _build/dist/
node -e "
const fs = require('fs');
const h = fs.readFileSync('index.html', 'utf8');
const out = h.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset=\"utf-8\">\s*/i, '').replace(/<meta name=\"viewport\"[^>]*>\s*/i, '');
fs.writeFileSync('_build/artifact-index.html', out);
"
echo "dist: $(find _build/dist -type f | wc -l) files, $(du -sh _build/dist | cut -f1)"
