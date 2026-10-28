-- ============================================================
-- VALIDAÇÃO - UNIDADE LEGIONÁRIA / DIA DE REUNIÃO / AUDITORIA
-- ============================================================

SELECT
    COUNT(*) AS dias_reuniao_ativos
FROM legio.dia_reuniao
WHERE status = 'ATIVO';

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'legio'
  AND table_name = 'unidade_legionaria'
  AND column_name IN (
      'nome_reduzido',
      'dia_reuniao',
      'horario_inicio_reuniao',
      'horario_fim_reuniao',
      'fuso_horario',
      'usu_inc_id',
      'usu_alt_id',
      'criado_por_usuario_id',
      'alterado_por_usuario_id'
  )
ORDER BY column_name;

SELECT
    conname,
    pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'legio.unidade_legionaria'::regclass
  AND conname IN (
      'fk_unidade_dia_reuniao',
      'fk_unidade_usu_inc',
      'fk_unidade_usu_alt'
  )
ORDER BY conname;

SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'legio'
  AND tablename = 'unidade_legionaria'
  AND indexname IN (
      'ix_unidade_dia_reuniao',
      'ix_unidade_usu_inc',
      'ix_unidade_usu_alt'
  )
ORDER BY indexname;

SELECT
    COUNT(*) FILTER (
        WHERE ul.dia_reuniao IS NOT NULL
          AND dr.id IS NULL
    ) AS dias_orfaos,
    COUNT(*) FILTER (
        WHERE ul.usu_inc_id IS NOT NULL
          AND ui.id IS NULL
    ) AS usu_inc_orfaos,
    COUNT(*) FILTER (
        WHERE ul.usu_alt_id IS NOT NULL
          AND ua.id IS NULL
    ) AS usu_alt_orfaos
FROM legio.unidade_legionaria ul
LEFT JOIN legio.dia_reuniao dr
  ON dr.id = ul.dia_reuniao
LEFT JOIN legio.usuario ui
  ON ui.id = ul.usu_inc_id
LEFT JOIN legio.usuario ua
  ON ua.id = ul.usu_alt_id;
