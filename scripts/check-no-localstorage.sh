#!/usr/bin/env bash
set -euo pipefail

if rg -n "localStorage|sessionStorage" -- *.js *.html; then
  echo "❌ Found forbidden browser storage usage. Use Firebase Realtime Database helpers instead."
  exit 1
fi

echo "✅ No localStorage/sessionStorage usage found."
