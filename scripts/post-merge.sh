#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Keep merge setup deterministic and non-interactive. The lockfile is the
# source of truth, and lifecycle scripts are skipped until the build step.
npm ci --ignore-scripts --no-audit --no-fund
npm run build