# LaborLedger VPS deploy (PM2 + Nginx, no Docker)

Production target for **Mario's Auto Detail**:

| Public URL | Internal | PM2 process |
|------------|----------|-------------|
| `https://admin.mariosautodetail.com` | `127.0.0.1:3000` | `laborledger-admin` |
| *(optional later)* Field PWA | `127.0.0.1:3001` | `laborledger-field` |
| API *(localhost only)* | `127.0.0.1:4000` | `laborledger-api` |

Legacy ServiHour at `/home/ubuntu/apps/servihour` is **not modified** by these scripts.

## Files

| File | Purpose |
|------|---------|
| `setup-vps-first-run.sh` | One-time: Node 22, pnpm, PM2, Nginx site, firewall hints |
| `deploy-vps.sh` | Repeatable: install, migrate, build, PM2 reload, smoke checks |
| `nginx/admin.mariosautodetail.com.conf` | Nginx reverse proxy for Admin |
| `../.env.production.example` | All production env vars (copy to `.env.production` on VPS) |
| `../ecosystem.config.cjs` | PM2 app definitions (loads `.env.production`) |

## First deploy (on VPS)

```bash
# 1. Upload or clone into a NEW directory (do not overwrite servihour)
mkdir -p /home/ubuntu/apps
cd /home/ubuntu/apps
git clone <your-laborledger-repo-url> laborledger
cd laborledger

# 2. Secrets (never commit)
cp .env.production.example .env.production
nano .env.production
# Use the EXISTING Postgres database name/credentials (often still "servihour")

# 3. One-time server setup (Node, pnpm, PM2, Nginx)
chmod +x deploy/setup-vps-first-run.sh deploy/deploy-vps.sh
./deploy/setup-vps-first-run.sh

# 4. Build, migrate (safe forward-only), start
./deploy/deploy-vps.sh

# 5. HTTPS
sudo certbot --nginx -d admin.mariosautodetail.com
```

## Updates (after code changes)

```bash
cd /home/ubuntu/apps/laborledger
git pull
./deploy/deploy-vps.sh
```

## Database rules

- **Never** run `prisma migrate reset`, `db push --force-reset`, or `DROP DATABASE`.
- `deploy-vps.sh` runs only `prisma migrate deploy` (forward, non-destructive).
- Point `DATABASE_URL` at the **existing** PostgreSQL database on the VPS.

## Smoke test

```bash
pm2 list
pm2 logs laborledger-api --lines 50
curl -I http://127.0.0.1:3000/login
curl -I http://127.0.0.1:4000/health
curl -I https://admin.mariosautodetail.com/login
```

## Rollback

Keep `/home/ubuntu/apps/servihour` running until LaborLedger is verified. To roll back Nginx:

```bash
# Re-point Nginx to the old admin port if needed, then:
sudo nginx -t && sudo systemctl reload nginx
pm2 restart <old-process-names>
```

## Optional: public Field subdomain

When ready, add DNS for `field.mariosautodetail.com`, copy and adapt the admin Nginx
config to proxy port `3001`, and run Certbot for that host.
