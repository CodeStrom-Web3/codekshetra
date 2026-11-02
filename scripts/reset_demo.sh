#!/usr/bin/env bash
# Reset AGENTSHIELD demo state: backend DB reseed + browser storage note.
set -euo pipefail
rm -f backend/data/agentshield.db backend/data/reports/*
echo "Backend DB removed — restart uvicorn to reseed."
echo "Browser state: Settings → Demo Lifecycle → Factory-reset demo data."
