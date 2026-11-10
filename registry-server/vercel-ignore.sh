#!/bin/bash

# Vercel Ignored Build Step for Murmur Registry Server
# Exit 1 = Proceed with deployment
# Exit 0 = Skip / cancel deployment

echo "🔍 Checking if registry or website has changes in this commit..."

# If parent commit is unavailable (e.g. initial commit), proceed with build
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "⚡ Initial commit or shallow clone. Proceeding with build."
  exit 1
fi

if git diff HEAD^ HEAD --quiet -- registry-server api public lib vercel.json package.json; then
  echo "🛑 No registry or web changes. Skipping Vercel deployment."
  exit 0
else
  echo "🚀 Registry/web changes detected. Proceeding with deployment."
  exit 1
fi
