-- ============================================================
-- VALIDAÇÃO DA LOCALIZAÇÃO NORMALIZADA
-- ============================================================

SELECT
    p.sigla,
    COUNT(*) AS paises
FROM legio.pais p
WHERE upper(p.sigla) = 'BR'
GROUP BY p.sigla;

SELECT
    COUNT(*) AS total_ufs_br
FROM legio.uf u
JOIN legio.pais p ON p.id = u.id_pais
WHERE upper(p.sigla) = 'BR';

SELECT
    COUNT(*) AS total_municipios_br
FROM legio.municipio m
JOIN legio.uf u ON u.id = m.id_uf
JOIN legio.pais p ON p.id = u.id_pais
WHERE upper(p.sigla) = 'BR';

SELECT
    COUNT(*) AS total_codigos_postais_br
FROM legio.codigo_postal cp
JOIN legio.pais p ON p.id = cp.pais_id
WHERE upper(p.sigla) = 'BR'
  AND cp.ativo = TRUE;

SELECT
    COUNT(*) AS subdivisoes_brasilia
FROM legio.subdivisao_local sl
JOIN legio.municipio m ON m.id = sl.municipio_id
WHERE m.codigo_ibge = 5300108
  AND sl.ativo = TRUE;

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'legio'
  AND table_name = 'igreja'
  AND column_name IN (
      'id_municipio',
      'subdivisao_local_id',
      'codigo_postal_id',
      'usu_inc_id',
      'usu_alt_id'
  )
ORDER BY column_name;

SELECT *
FROM legio.fn_buscar_codigo_postal('72499899')
LIMIT 20;
