BEGIN;

-- ============================================================
-- V3.0 - CEP SOMENTE POR API
-- ============================================================
-- Regra definitiva:
--   * NÃO usar legio.codigo_postal como catálogo/cache.
--   * Brasil: consultar BrasilAPI e usar ViaCEP como fallback.
--   * Brasília/DF: consultar legio.codigo_postal_subdivisao somente
--     para resolver a Região Administrativa.
--   * Igreja/Paróquia/Sede passa a armazenar o código postal
--     diretamente em legio.igreja.codigo_postal.
-- ============================================================

-- 1. Novo campo direto na Igreja/Paróquia/Sede.
ALTER TABLE legio.igreja
    ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(20);

-- 2. Preserva CEPs de Igrejas já vinculadas à antiga tabela, se ela
--    ainda existir neste banco.
DO $$
BEGIN
    IF to_regclass('legio.codigo_postal') IS NOT NULL
       AND EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'legio'
               AND table_name = 'igreja'
               AND column_name = 'codigo_postal_id'
       ) THEN
        EXECUTE $SQL$
            UPDATE legio.igreja i
               SET codigo_postal = cp.codigo_postal
              FROM legio.codigo_postal cp
             WHERE cp.id = i.codigo_postal_id
               AND (i.codigo_postal IS NULL OR btrim(i.codigo_postal) = '')
        $SQL$;
    END IF;
END
$$;

-- 3. A função antiga dependia da tabela catálogo.
DROP FUNCTION IF EXISTS legio.fn_buscar_codigo_postal(TEXT);

-- 4. Remove vínculo da Igreja com a tabela catálogo.
ALTER TABLE legio.igreja
    DROP CONSTRAINT IF EXISTS fk_igreja_codigo_postal;

DROP INDEX IF EXISTS legio.idx_igreja_codigo_postal;

ALTER TABLE legio.igreja
    DROP COLUMN IF EXISTS codigo_postal_id;

-- 5. Índice útil para consultas de Igreja por código postal, sem
--    transformar o campo em catálogo nacional.
CREATE INDEX IF NOT EXISTS idx_igreja_codigo_postal_normalizado
    ON legio.igreja (
        upper(regexp_replace(COALESCE(codigo_postal, ''), '[^A-Za-z0-9]', '', 'g'))
    );

-- 6. A tabela nacional/cache não faz mais parte da arquitetura.
--    codigo_postal_subdivisao permanece intacta.
DROP TABLE IF EXISTS legio.codigo_postal;

COMMIT;
