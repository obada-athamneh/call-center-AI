#!/usr/bin/env bash
# Bundle web/ (React + the site) into ui/app.js.
# Needs: node, esbuild, react, react-dom (npm i -g esbuild react react-dom).
set -e
cd "$(dirname "$0")/.."
ESBUILD="${ESBUILD:-esbuild}"
NODE_PATH="${NODE_PATH:-$(npm root -g)}" "$ESBUILD" web/main.jsx \
  --bundle --format=esm --minify --target=es2020 \
  --jsx=automatic --define:process.env.NODE_ENV='"production"' \
  --external:'https://*' \
  --legal-comments=eof \
  --outfile=ui/app.js
echo "built ui/app.js"
