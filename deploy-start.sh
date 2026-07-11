#!/usr/bin/env bash
# DUNAZOE — Production start script
# Starts Next.js production server on port 5000, bound to 0.0.0.0
set -e
echo "Starting DUNAZOE frontend (production)..."
cd apps/core/frontend
exec npm run start
