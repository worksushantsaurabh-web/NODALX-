#!/usr/bin/env bash
set -euo pipefail

bucket=nodalx-api-artifacts-560246495281-us-east-1
archive=/tmp/caddy_2.11.7_linux_arm64.tar.gz
sha512=3db36ba90c7a6e8dda40ee3dd71fa08844c76b5fb08f61b31e5e78d2ed38e71c51dc7baed875e50d1ca1279196e84302967237386ae87c91ae9f2aaceada682e

aws s3 cp "s3://$bucket/releases/caddy_2.11.7_linux_arm64.tar.gz" "$archive" --region us-east-1 --no-progress
printf '%s  %s\n' "$sha512" "$archive" | sha512sum -c -
tar -xzf "$archive" -C /tmp caddy
install -o root -g root -m 755 /tmp/caddy /usr/local/bin/caddy
id caddy >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/caddy --shell /sbin/nologin caddy
mkdir -p /etc/caddy /var/lib/caddy
chown caddy:caddy /var/lib/caddy
aws s3 cp "s3://$bucket/releases/Caddyfile.api-staging.internal" /etc/caddy/Caddyfile --region us-east-1 --no-progress
aws s3 cp "s3://$bucket/releases/nodalx-caddy.service" /etc/systemd/system/nodalx-caddy.service --region us-east-1 --no-progress
chown root:root /etc/caddy/Caddyfile /etc/systemd/system/nodalx-caddy.service
chmod 644 /etc/caddy/Caddyfile /etc/systemd/system/nodalx-caddy.service
/usr/local/bin/caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now nodalx-caddy
systemctl is-active --quiet nodalx-caddy
