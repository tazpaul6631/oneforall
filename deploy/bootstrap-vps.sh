#!/bin/bash
# Cài OneStore trên VPS Ubuntu 24.04 đã thuê (1–2 vCPU, 2 GB RAM, 40 GB SSD).
# Nhà cung cấp ở Việt Nam: Bizfly, Viettel IDC, VNPT, Nhân Hòa, PA Việt Nam, Mắt Bão.
# Trỏ bản ghi A của tên miền về IP máy này trước khi xin HTTPS.
#
# Chạy bằng root, sau khi đã copy repo vào /opt/onestore:
#   DOMAIN=quan.example.com EMAIL=ban@example.com bash deploy/bootstrap-vps.sh
#
# Script không chạy seed. Tài khoản demo không được tạo trên máy khách.

set -euo pipefail

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
APP=/opt/onestore

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Chạy bằng root trên VPS." >&2
  exit 1
fi
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Cần DOMAIN và EMAIL. Ví dụ: DOMAIN=quan.vn EMAIL=ban@quan.vn bash deploy/bootstrap-vps.sh" >&2
  exit 1
fi
if [[ ! -f "$APP/backend/package.json" || ! -f "$APP/frontend/package.json" ]]; then
  echo "Chưa thấy code tại $APP. Copy repo vào đó rồi chạy lại." >&2
  exit 1
fi

if ! id onestore >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin onestore
fi
chown -R onestore:onestore "$APP"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx ufw
if ! command -v node >/dev/null 2>&1; then
  apt-get install -y ca-certificates curl
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

sudo -u onestore bash -lc "cd '$APP/backend' && npm ci && npm run build"
sudo -u onestore bash -lc "cd '$APP/frontend' && npm ci && npm run build"

ENV_FILE="$APP/backend/.env"
OPS_EMAIL=""
OPS_PASS=""
if [[ ! -f "$ENV_FILE" ]]; then
  SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  OPS_EMAIL="ops@${DOMAIN}"
  OPS_PASS="$(openssl rand -base64 18 | tr -d '\n')"
  cat >"$ENV_FILE" <<EOF
PORT=3000
DB_PATH=data/app.db
JWT_SECRET=${SECRET}
NODE_ENV=production
CORS_ORIGIN=https://${DOMAIN}
BACKUP_DIR=/var/backups/onestore
OPERATOR_EMAIL=${OPS_EMAIL}
OPERATOR_PASSWORD=${OPS_PASS}
EOF
  chown onestore:onestore "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi
mkdir -p /var/backups/onestore
chown onestore:onestore /var/backups/onestore

cp "$APP/deploy/onestore.service" /etc/systemd/system/onestore.service
systemctl daemon-reload
systemctl enable --now onestore

WEB="$APP/frontend/dist"
sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__WEB_ROOT__|${WEB}|g" \
  "$APP/deploy/nginx.conf" >/etc/nginx/sites-available/onestore
ln -sfn /etc/nginx/sites-available/onestore /etc/nginx/sites-enabled/onestore
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if ! certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
  echo "HTTPS chưa xong. Kiểm tra bản ghi A đã trỏ về máy này, rồi chạy lại lệnh certbot." >&2
  exit 1
fi

CRON=/etc/cron.d/onestore-backup
cat >"$CRON" <<EOF
SHELL=/bin/bash
PATH=/usr/bin:/bin
0 3 * * * onestore cd $APP/backend && /usr/bin/node dist/ops/backup-db.js >> /var/log/onestore-backup.log 2>&1
EOF
chmod 644 "$CRON"

KEY_OK=0
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  if [[ -s "$f" ]]; then KEY_OK=1; fi
done
if [[ "$KEY_OK" -eq 1 ]]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
  systemctl reload ssh || systemctl reload sshd
  echo "Đã tắt đăng nhập SSH bằng mật khẩu."
else
  echo "Chưa thấy SSH key. Thêm key vào authorized_keys, rồi đặt PasswordAuthentication no." >&2
fi

echo "API và web đang chạy tại https://${DOMAIN}"
echo "Không chạy npm run seed trên máy này."
if [[ -n "$OPS_PASS" ]]; then
  echo "Tài khoản vận hành: ${OPS_EMAIL}"
  echo "Mật khẩu vận hành (lưu lại, chỉ hiện lần này): ${OPS_PASS}"
fi
