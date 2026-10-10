#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

if [ ! -d web/node_modules ]; then
  npm --prefix web install
fi

if [ ! -d web/dist ]; then
  npm --prefix web run build
fi

PORT="${PORT:-3000}" node server/index.js
