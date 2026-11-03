#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# BACKUP DA BASE LEGADA DE CEPs
# ============================================================
# Uso:
#   PGHOST=localhost PGPORT=5433 PGUSER=syslegio_user \
#   PGDATABASE=syslegiomariae ./backup_codigo_postal_legado.sh
#
# Opcional:
#   ./backup_codigo_postal_legado.sh /caminho/backup
# ============================================================

OUT_BASE="${1:-$PWD/backups_codigo_postal}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$OUT_BASE/$STAMP"
mkdir -p "$OUT"

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=syslegiomariae}"
: "${PGUSER:=syslegio_user}"

export PGHOST PGPORT PGDATABASE PGUSER

printf 'Backup em: %s\n' "$OUT"

# 1) Backup restaurável nativo do PostgreSQL.
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --table=legio.codigo_postal \
  --file="$OUT/legio_codigo_postal.dump" \
  "$PGDATABASE"

# 2) Estrutura SQL legível.
pg_dump \
  --schema-only \
  --no-owner \
  --no-acl \
  --table=legio.codigo_postal \
  "$PGDATABASE" \
  > "$OUT/legio_codigo_postal_schema.sql"

# 3) CSV completo compactado, independente do formato pg_dump.
psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" \
  -c "\\copy (SELECT * FROM legio.codigo_postal ORDER BY id) TO STDOUT WITH (FORMAT csv, HEADER true)" \
  | gzip -9 > "$OUT/legio_codigo_postal.csv.gz"

# 4) Exporta SOMENTE o mapeamento pequeno CEP x Região Administrativa do DF.
#    Este é o arquivo recomendado para levar ao Supabase.
psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" \
  -c "\\copy (
        SELECT DISTINCT
          regexp_replace(cp.codigo_postal, '[^0-9]', '', 'g') AS codigo_postal,
          cp.subdivisao_local_id,
          COALESCE(sl.codigo, '') AS subdivisao_codigo,
          sl.nome AS subdivisao_nome
        FROM legio.codigo_postal cp
        JOIN legio.subdivisao_local sl
          ON sl.id = cp.subdivisao_local_id
        JOIN legio.municipio m
          ON m.id = sl.municipio_id
        WHERE cp.subdivisao_local_id IS NOT NULL
          AND regexp_replace(cp.codigo_postal, '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
          AND m.codigo_ibge = 5300108
        ORDER BY 1, 2
      ) TO STDOUT WITH (FORMAT csv, HEADER true)" \
  | gzip -9 > "$OUT/cep_subdivisao_df.csv.gz"

# 5) Estatísticas para conferência.
psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -At \
  -c "SELECT 'codigo_postal=' || COUNT(*) FROM legio.codigo_postal;
      SELECT 'mapeamentos_df=' || COUNT(*) FROM (
        SELECT DISTINCT regexp_replace(cp.codigo_postal, '[^0-9]', '', 'g'), cp.subdivisao_local_id
        FROM legio.codigo_postal cp
        JOIN legio.subdivisao_local sl ON sl.id = cp.subdivisao_local_id
        JOIN legio.municipio m ON m.id = sl.municipio_id
        WHERE cp.subdivisao_local_id IS NOT NULL
          AND m.codigo_ibge = 5300108
      ) x;" \
  > "$OUT/CONTAGENS.txt"

(
  cd "$OUT"
  sha256sum \
    legio_codigo_postal.dump \
    legio_codigo_postal_schema.sql \
    legio_codigo_postal.csv.gz \
    cep_subdivisao_df.csv.gz \
    CONTAGENS.txt \
    > SHA256SUMS.txt
)

printf '\nArquivos gerados:\n'
ls -lh "$OUT"
printf '\nGuarde esta pasta fora do repositório Git. Recomenda-se manter pelo menos duas cópias em mídias/locais distintos.\n'
