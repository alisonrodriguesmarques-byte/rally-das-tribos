#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_BACKUP_URL:?Defina DATABASE_BACKUP_URL com a conexão PostgreSQL para backup}"
: "${BACKUP_ENCRYPTION_KEY:?Defina BACKUP_ENCRYPTION_KEY e guarde uma cópia fora do GitHub}"
[[ ${#BACKUP_ENCRYPTION_KEY} -ge 32 ]] || { echo "Use BACKUP_ENCRYPTION_KEY aleatória com pelo menos 32 caracteres."; exit 1; }
schema="${DB_SCHEMA:-rally}"
[[ "$schema" =~ ^[a-z_][a-z0-9_]*$ && "$schema" != public ]] || { echo 'Schema inválido'; exit 1; }
if [[ "$DATABASE_BACKUP_URL" =~ sslmode=([^\&]+) && "${BASH_REMATCH[1]}" != verify-full ]]; then
  echo 'Use sslmode=verify-full na URL de backup.'; exit 1
fi
export PGSSLMODE=verify-full
if [[ -n "${DATABASE_CA_CERT:-}" ]]; then
  cert_dir=$(mktemp -d)
  printf '%b' "$DATABASE_CA_CERT" > "$cert_dir/root.crt"
  export PGSSLROOTCERT="$cert_dir/root.crt"
fi
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir" "${cert_dir:-}"' EXIT
output="${1:-backups/rally-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg}"
mkdir -p "$(dirname "$output")"
# O formato custom permite restaurar estrutura, sequências e dados.
pg_dump --dbname="$DATABASE_BACKUP_URL" --format=custom --no-owner --no-acl --schema="$schema" --file="$tmp_dir/rally.dump"
pg_restore --list "$tmp_dir/rally.dump" > /dev/null
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 --output "$output" "$tmp_dir/rally.dump" 3<<<"$BACKUP_ENCRYPTION_KEY"
echo "Backup criptografado criado: $output"
