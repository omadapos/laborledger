#!/usr/bin/env bash
# LaborLedger — build and reload on VPS (safe DB migrate, no reset).
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${APP_ROOT}"

ENV_FILE="${APP_ROOT}/.env.production"

log() {
  printf '==> %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -f "${ENV_FILE}" ]] || die "Missing ${ENV_FILE}. Copy from .env.production.example and fill in values."

if ! command -v pnpm >/dev/null 2>&1; then
  die "pnpm not found. Run deploy/setup-vps-first-run.sh first."
fi

if ! command -v pm2 >/dev/null 2>&1; then
  die "pm2 not found. Run deploy/setup-vps-first-run.sh first."
fi

log "Installing dependencies (frozen lockfile)"
pnpm install --frozen-lockfile

log "Generating Prisma client"
pnpm --filter @laborledger/database db:generate

log "Applying forward-only migrations (prisma migrate deploy)"
pnpm db:migrate

log "Building API"
pnpm --filter @laborledger/api build

log "Building Admin"
pnpm --filter @laborledger/admin build

log "Building Field PWA"
pnpm --filter @laborledger/field build

log "Starting / reloading PM2 (loads .env.production via ecosystem.config.cjs)"
pm2 startOrReload "${APP_ROOT}/ecosystem.config.cjs" --update-env
pm2 save

log "Waiting for processes to bind ports"
sleep 4

log "Smoke checks"
ADMIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login || echo '000')"
API_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/health || echo '000')"
FIELD_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/field/login || echo '000')"

printf '    Admin /login     -> HTTP %s\n' "${ADMIN_CODE}"
printf '    API /health      -> HTTP %s\n' "${API_CODE}"
printf '    Field /field/login -> HTTP %s\n' "${FIELD_CODE}"

pm2 list

if [[ "${ADMIN_CODE}" != "200" && "${ADMIN_CODE}" != "307" ]]; then
  die "Admin smoke check failed (HTTP ${ADMIN_CODE}). Run: pm2 logs laborledger-admin"
fi

if [[ "${API_CODE}" != "200" ]]; then
  die "API smoke check failed (HTTP ${API_CODE}). Run: pm2 logs laborledger-api"
fi

log "Deploy finished. Verify public URL:"
echo "    curl -I https://admin.mariosautodetail.com/login"
