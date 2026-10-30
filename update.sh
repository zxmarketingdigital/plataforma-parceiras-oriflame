#!/usr/bin/env bash
# Atualiza para a versão mais recente: backup, código novo, migrações, reinício.
set -euo pipefail
cd "$(dirname "$0")"
./backup.sh
git pull --ff-only
docker compose up -d --build
echo "Atualizado."
