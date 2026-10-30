#!/usr/bin/env bash
# Cópia da base de dados e dos PDFs para ./backups (guarda os 14 mais recentes).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
ts=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U postgres -Fc plataforma > "backups/db-${ts}.dump"
docker compose cp app:/app/data "backups/data-${ts}" >/dev/null 2>&1 || true
ls -1t backups/db-*.dump | tail -n +15 | xargs -r rm -f
echo "Backup: backups/db-${ts}.dump"
