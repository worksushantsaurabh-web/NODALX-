#!/usr/bin/env bash
set -euo pipefail

bucket=nodalx-api-artifacts-560246495281-us-east-1
sha=04f26e63754961462d69580b45e153cd28c853ddfe9130699becfd4eecbff6f2
secret_arn=arn:aws:secretsmanager:us-east-1:560246495281:secret:nodalx/api/staging-AUnFpD
release=/opt/nodalx-api/releases/$sha
archive=/tmp/nodalx-api-$sha.tar.gz

dnf install -y nodejs24 nodejs24-npm
id nodalx >/dev/null 2>&1 || useradd --system --home-dir /opt/nodalx-api --shell /sbin/nologin nodalx
mkdir -p "$release" /etc/nodalx-api
aws s3 cp "s3://$bucket/releases/nodalx-api-$sha.tar.gz" "$archive" --region us-east-1 --no-progress
printf '%s  %s\n' "$sha" "$archive" | sha256sum -c -
tar -xzf "$archive" -C "$release" --no-same-owner
cd "$release"
npm-24 ci --omit=dev --ignore-scripts --no-audit --no-fund
chown -R root:root "$release"
chmod -R a+rX "$release"
ln -sfn "$release" /opt/nodalx-api/current
printf 'NODALX_API_SECRET_ID=%s\n' "$secret_arn" > /etc/nodalx-api/bootstrap.env
chown root:root /etc/nodalx-api/bootstrap.env
chmod 600 /etc/nodalx-api/bootstrap.env
aws s3 cp "s3://$bucket/releases/nodalx-api.service" /etc/systemd/system/nodalx-api.service --region us-east-1 --no-progress
chown root:root /etc/systemd/system/nodalx-api.service
chmod 644 /etc/systemd/system/nodalx-api.service
systemctl daemon-reload
systemctl enable --now nodalx-api
systemctl is-active --quiet nodalx-api
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:5000/api/health/live
