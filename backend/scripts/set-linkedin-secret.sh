#!/usr/bin/env bash
# Stores LINKEDIN_CLIENT_SECRET on the Vercel production environment without echoing it.
set -euo pipefail
cd "$(dirname "$0")/.."
read -r -s -p "Paste LinkedIn Client Secret (input hidden), then Enter: " SECRET; echo
[ -z "$SECRET" ] && { echo "Nothing entered — aborting."; exit 1; }
vercel env rm LINKEDIN_CLIENT_SECRET production --yes >/dev/null 2>&1 || true
printf '%s' "$SECRET" | vercel env add LINKEDIN_CLIENT_SECRET production
echo "Done. Now tell Claude: set"
