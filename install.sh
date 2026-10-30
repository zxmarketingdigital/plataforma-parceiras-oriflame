#!/usr/bin/env bash
# Instalação na VPS (Ubuntu/Debian com Docker). Uso: ./install.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Instale o Docker primeiro: https://docs.docker.com/engine/install/"; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  gen() { openssl rand -hex 24; }
  sed -i.bak "s|^APP_SECRET=.*|APP_SECRET=$(gen)|; s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(gen)|; s|^APP_DB_PASSWORD=.*|APP_DB_PASSWORD=$(gen)|" .env
  rm -f .env.bak
  # As URLs de ligação usam as senhas geradas.
  pg=$(grep ^POSTGRES_PASSWORD= .env | cut -d= -f2); ap=$(grep ^APP_DB_PASSWORD= .env | cut -d= -f2)
  sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=postgres://app_rw:${ap}@postgres:5432/plataforma|; s|^MIGRATE_DATABASE_URL=.*|MIGRATE_DATABASE_URL=postgres://postgres:${pg}@postgres:5432/plataforma|" .env
  rm -f .env.bak
  read -rp "Domínio (ex.: parceiras.seudominio.com): " d
  read -rp "E-mail para o certificado HTTPS: " m
  sed -i.bak "s|^DOMAIN=.*|DOMAIN=${d}|; s|^ACME_EMAIL=.*|ACME_EMAIL=${m}|; s|^APP_URL=.*|APP_URL=https://${d}|" .env
  rm -f .env.bak
  echo "Ficheiro .env criado. Reveja SMTP_URL e ANTHROPIC_API_KEY antes de abrir ao público."
fi

docker compose up -d --build
echo "A criar a conta de dono (owner)…"
docker compose run --rm migrate npm run create-owner
echo "Pronto. Abra https://$(grep ^DOMAIN= .env | cut -d= -f2)/painel/login"
