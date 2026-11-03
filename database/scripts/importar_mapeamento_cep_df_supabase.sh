#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# IMPORTAÇÃO DO MAPEAMENTO CEP x RA DO DF NO SUPABASE
# ============================================================
# Pré-requisito: executar 009_cep_api_cache.sql no Supabase.
#
# Uso:
#   PGHOST=... PGPORT=5432 PGUSER=... PGDATABASE=postgres \
#   PGPASSWORD=... \
#   ./importar_mapeamento_cep_df_supabase.sh /caminho/cep_subdivisao_df.csv.gz
# ============================================================

ARQUIVO="${1:-}"

if [[ -z "$ARQUIVO" || ! -f "$ARQUIVO" ]]; then
  echo "Informe o arquivo cep_subdivisao_df.csv.gz." >&2
  exit 1
fi

TMP="$(mktemp --suffix=.csv)"
trap 'rm -f "$TMP"' EXIT

gunzip -c "$ARQUIVO" > "$TMP"

psql -v ON_ERROR_STOP=1 <<SQL
CREATE TEMP TABLE tmp_cep_subdivisao_df (
  codigo_postal TEXT,
  subdivisao_local_id BIGINT,
  subdivisao_codigo TEXT,
  subdivisao_nome TEXT
);

\\copy tmp_cep_subdivisao_df(codigo_postal, subdivisao_local_id, subdivisao_codigo, subdivisao_nome) FROM '$TMP' WITH (FORMAT csv, HEADER true)

INSERT INTO legio.codigo_postal_subdivisao
(
  codigo_postal,
  subdivisao_local_id,
  fonte,
  ativo
)
SELECT
  regexp_replace(t.codigo_postal, '[^0-9]', '', 'g'),
  destino.id,
  'DF_ESPACIAL_V4',
  TRUE
FROM tmp_cep_subdivisao_df t
JOIN LATERAL (
  SELECT sl.id
  FROM legio.subdivisao_local sl
  JOIN legio.municipio m
    ON m.id = sl.municipio_id
  WHERE m.codigo_ibge = 5300108
    AND (
      sl.id = t.subdivisao_local_id
      OR (
        NULLIF(btrim(t.subdivisao_codigo), '') IS NOT NULL
        AND sl.codigo = t.subdivisao_codigo
      )
      OR upper(btrim(sl.nome)) = upper(btrim(t.subdivisao_nome))
    )
  ORDER BY
    CASE
      WHEN sl.id = t.subdivisao_local_id THEN 0
      WHEN NULLIF(btrim(t.subdivisao_codigo), '') IS NOT NULL
           AND sl.codigo = t.subdivisao_codigo THEN 1
      ELSE 2
    END,
    sl.id
  LIMIT 1
) destino ON TRUE
WHERE regexp_replace(t.codigo_postal, '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
ON CONFLICT DO NOTHING;

SELECT COUNT(*) AS total_mapeamentos_df
FROM legio.codigo_postal_subdivisao;
SQL
