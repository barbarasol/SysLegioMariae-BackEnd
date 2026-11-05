-- ============================================================
-- VALIDAÇÃO V3.0 - CEP SOMENTE POR API
-- ============================================================

-- Deve ser NULL: a tabela catálogo/cache foi removida.
SELECT to_regclass('legio.codigo_postal') AS codigo_postal_deve_ser_null;

-- Deve existir.
SELECT to_regclass('legio.codigo_postal_subdivisao') AS codigo_postal_subdivisao;

-- Igreja deve possuir codigo_postal direto e NÃO possuir codigo_postal_id.
SELECT
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'legio'
  AND table_name = 'igreja'
  AND column_name IN ('codigo_postal', 'codigo_postal_id')
ORDER BY column_name;

-- Carga CEP x RA de Brasília esperada após os 24 lotes.
SELECT
    COUNT(*) AS total,
    COUNT(DISTINCT regexp_replace(codigo_postal, '[^0-9]', '', 'g')) AS ceps_distintos,
    COUNT(DISTINCT subdivisao_local_id) AS ras_distintas
FROM legio.codigo_postal_subdivisao
WHERE ativo = TRUE;

-- Esperado no conjunto atualmente preparado:
-- total = 23674
-- ceps_distintos = 23674
-- ras_distintas = 33

-- Confirma que todos os vínculos apontam para subdivisões válidas.
SELECT COUNT(*) AS vinculos_sem_subdivisao
FROM legio.codigo_postal_subdivisao cps
LEFT JOIN legio.subdivisao_local sl
  ON sl.id = cps.subdivisao_local_id
WHERE sl.id IS NULL;
-- Esperado: 0
