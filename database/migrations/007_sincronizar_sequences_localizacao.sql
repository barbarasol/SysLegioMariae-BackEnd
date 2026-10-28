-- ============================================================
-- 007 - SINCRONIZA SEQUENCES/IDENTITIES DA LOCALIZAÇÃO
-- Evita duplicate key após cargas com OVERRIDING SYSTEM VALUE
-- ou inserções com IDs explícitos.
-- ============================================================

BEGIN;

SELECT setval(
    pg_get_serial_sequence('legio.pais', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.pais), 1),
    EXISTS (SELECT 1 FROM legio.pais)
);

SELECT setval(
    pg_get_serial_sequence('legio.uf', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.uf), 1),
    EXISTS (SELECT 1 FROM legio.uf)
);

SELECT setval(
    pg_get_serial_sequence('legio.municipio', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.municipio), 1),
    EXISTS (SELECT 1 FROM legio.municipio)
);

SELECT setval(
    pg_get_serial_sequence('legio.subdivisao_local', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.subdivisao_local), 1),
    EXISTS (SELECT 1 FROM legio.subdivisao_local)
);

SELECT setval(
    pg_get_serial_sequence('legio.codigo_postal', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.codigo_postal), 1),
    EXISTS (SELECT 1 FROM legio.codigo_postal)
);

SELECT setval(
    pg_get_serial_sequence('legio.igreja', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.igreja), 1),
    EXISTS (SELECT 1 FROM legio.igreja)
);

SELECT setval(
    pg_get_serial_sequence('legio.unidade_legionaria', 'id'),
    COALESCE((SELECT MAX(id) FROM legio.unidade_legionaria), 1),
    EXISTS (SELECT 1 FROM legio.unidade_legionaria)
);

COMMIT;
