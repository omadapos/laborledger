# LaborLedger

Multi-company labor timekeeping and operations platform (API + Admin + Field PWA).

## Stack

- **API:** NestJS (`apps/api`) — port 4000
- **Admin:** Next.js (`apps/admin`) — port 3000
- **Field PWA:** Next.js (`apps/field`) — port 3001
- **Database:** PostgreSQL + Prisma (`packages/database`)

## Local setup

```bash
cp .env.example .env
# Edit DATABASE_URL and secrets

pnpm install
pnpm db:generate
pnpm dev
```

## Production (VPS — PM2 + Nginx, no Docker)

```bash
pnpm install --frozen-lockfile
pnpm --filter @laborledger/database db:generate
pnpm --filter @laborledger/api build
pnpm --filter @laborledger/admin build
pnpm --filter @laborledger/field build

# Create .env.production on the server (not committed)
pm2 start ecosystem.config.cjs
pm2 save
```

Deploy runbook: `deploy/README.md`

Quick VPS update:

```bash
cp .env.production.example .env.production   # first time only
./deploy/setup-vps-first-run.sh              # first time only
./deploy/deploy-vps.sh
```

Nginx config: `deploy/nginx/admin.mariosautodetail.com.conf`

## Tests

```bash
pnpm test
pnpm --filter @laborledger/api test
```

## Notes

- Existing PostgreSQL databases are preserved — use `pnpm db:migrate` only for safe forward migrations.
- API stays on localhost; Admin BFF proxies authenticated requests server-side.
- Field/PWA is the single employee-facing app (`apps/field`).
