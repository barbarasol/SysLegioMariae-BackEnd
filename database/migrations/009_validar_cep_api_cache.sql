-- V2.9 - Validação CEP por API + cache

SELECT
    to_regclass('legio.codigo_postal') AS codigo_postal,
    to_regclass('legio.codigo_postal_subdivisao') AS codigo_postal_subdivisao;

SELECT
    COUNT(*) AS total_cache,
    COUNT(*) FILTER (WHERE fonte = 'BRASILAPI') AS brasilapi,
    COUNT(*) FILTER (WHERE fonte = 'VIACEP') AS viacep,
    COUNT(*) FILTER (WHERE fonte = 'WELYAB_CEP') AS welyab
FROM legio.codigo_postal;

SELECT COUNT(*) AS mapeamentos_df
FROM legio.codigo_postal_subdivisao;

SELECT
    codigo_postal,
    COUNT(*) AS subdivisoes,
    ARRAY_AGG(subdivisao_local_id ORDER BY subdivisao_local_id) AS ids
FROM legio.codigo_postal_subdivisao
WHERE ativo = TRUE
GROUP BY codigo_postal
HAVING COUNT(*) > 1
ORDER BY codigo_postal;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'legio'
  AND table_name = 'codigo_postal'
  AND column_name IN ('fonte', 'origem_id', 'consultado_em', 'usu_inc_id', 'usu_alt_id')
ORDER BY column_name;
