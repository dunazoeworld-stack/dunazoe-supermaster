#!/usr/bin/env bash
# DUNAZOE — Production build script
# Runs Next.js build for the frontend app
set -e
echo "Building DUNAZOE frontend for production..."
cd apps/core/frontend
npm run build
echo "Build complete."
