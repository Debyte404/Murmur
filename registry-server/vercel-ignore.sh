#!/bin/bash

# Vercel Ignored Build Step for Murmur Registry Server
# Exit 1 = Proceed with deployment
# Exit 0 = Skip / cancel deployment

echo "🔍 Checking if registry-server has changes in this commit..."

if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "⚡ Initial commit or shallow clone. Proceeding with build."
  exit 1
fi

# Determine whether running from inside registry-server or repo root
if [ -f "package.json" ] && [ -d "api" ] && [ ! -d "registry-server" ]; then
  CHECK_DIR="."
else
  CHECK_DIR="registry-server"
fi

if git diff HEAD^ HEAD --quiet -- "$CHECK_DIR"; then
  echo "🛑 No changes in $CHECK_DIR. Skipping Vercel deployment."
  exit 0
else
  echo "🚀 Changes detected in $CHECK_DIR. Proceeding with deployment."
  exit 1
fi
