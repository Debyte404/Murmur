#!/bin/bash

# Vercel Ignored Build Step for Murmur Registry Server
# Exit 1 = Proceed with deployment
# Exit 0 = Skip / cancel deployment

echo "🔍 Checking if registry-server has changes in this commit..."

# If parent commit is unavailable (e.g. initial commit), proceed with build
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "⚡ Initial commit or shallow clone. Proceeding with build."
  exit 1
fi

# Target directory check (supports running from repo root or from inside registry-server)
TARGET_DIR="."
if [ -d "registry-server" ]; then
  TARGET_DIR="registry-server"
fi

if git diff HEAD^ HEAD --quiet -- "$TARGET_DIR"; then
  echo "🛑 No changes in $TARGET_DIR. Skipping Vercel deployment."
  exit 0
else
  echo "🚀 Changes detected in $TARGET_DIR. Proceeding with deployment."
  exit 1
fi
