#!/usr/bin/env bash
# LaborLedger — one-time VPS setup (Ubuntu, PM2 + Nginx, no Docker).
# Run as the deploy user (e.g. ubuntu) from the repo root or any directory.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_SITE="admin.mariosautodetail.com.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

echo "==> LaborLedger first-run setup"
echo "    App root: ${APP_ROOT}"

if [[ ! -f "${APP_ROOT}/.env.production" ]]; then
  echo "ERROR: ${APP_ROOT}/.env.production is missing."
  echo "       cp .env.production.example .env.production && nano .env.production"
  exit 1
fi

echo "==> Checking Node.js (>= 20)"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 22 LTS, e.g.:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 20 ]]; then
  echo "ERROR: Node ${NODE_MAJOR} is too old. Use Node 20+ (22 LTS recommended)."
  exit 1
fi

echo "==> Enabling pnpm via corepack"
if ! command -v pnpm >/dev/null 2>&1; then
  sudo corepack enable
  corepack prepare pnpm@11.5.2 --activate
fi
pnpm --version

echo "==> Installing PM2 globally (if missing)"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
pm2 --version

echo "==> Installing Nginx (if missing)"
if ! command -v nginx >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y nginx
fi

echo "==> Installing Nginx site for admin.mariosautodetail.com"
sudo cp "${APP_ROOT}/deploy/nginx/${NGINX_SITE}" "${NGINX_AVAILABLE}"
sudo ln -sf "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

if [[ -f /etc/nginx/sites-enabled/default ]]; then
  echo "    Disabling default Nginx site (optional)"
  sudo rm -f /etc/nginx/sites-enabled/default
fi

sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> Firewall reminder (run manually if ufw is enabled)"
echo "    sudo ufw allow 22/tcp"
echo "    sudo ufw allow 80/tcp"
echo "    sudo ufw allow 443/tcp"
echo "    sudo ufw enable"

echo "==> PM2 startup on boot"
pm2 startup systemd -u "${USER}" --hp "${HOME}" || true
echo "    After first 'pm2 start', run: pm2 save"

echo ""
echo "Setup complete. Next:"
echo "  cd ${APP_ROOT}"
echo "  ./deploy/deploy-vps.sh"
echo "  sudo certbot --nginx -d admin.mariosautodetail.com"
