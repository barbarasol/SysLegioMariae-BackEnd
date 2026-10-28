BEGIN;

-- ============================================================
-- SYSLEGIOMARIAE
-- UNIDADE LEGIONÁRIA
-- Padronização de auditoria + relacionamento com dia_reuniao
--
-- criado_por_usuario_id   -> usu_inc_id
-- alterado_por_usuario_id -> usu_alt_id
-- dia_semana_reuniao      -> dia_reuniao (FK)
-- ============================================================

DO $$
BEGIN
    IF to_regclass('legio.unidade_legionaria') IS NULL THEN
        RAISE EXCEPTION 'Tabela legio.unidade_legionaria não encontrada.';
    END IF;

    IF to_regclass('legio.dia_reuniao') IS NULL THEN
        RAISE EXCEPTION 'Tabela legio.dia_reuniao não encontrada.';
    END IF;

    IF to_regclass('legio.usuario') IS NULL THEN
        RAISE EXCEPTION 'Tabela legio.usuario não encontrada.';
    END IF;
END
$$;

-- ============================================================
-- 1. CAMPOS CADASTRAIS / REUNIÃO
-- ============================================================

ALTER TABLE legio.unidade_legionaria
    ADD COLUMN IF NOT EXISTS nome_reduzido VARCHAR(120),
    ADD COLUMN IF NOT EXISTS horario_inicio_reuniao TIME,
    ADD COLUMN IF NOT EXISTS horario_fim_reuniao TIME,
    ADD COLUMN IF NOT EXISTS fuso_horario VARCHAR(80);

-- ============================================================
-- 2. DIA DE REUNIÃO
--
-- A coluna antiga representava 0..6.
-- Ao renomear, convertemos UMA ÚNICA VEZ:
-- 0=DOMINGO ... 6=SÁBADO
-- para os IDs 1..7 da nova tabela dia_reuniao.
-- ============================================================

ALTER TABLE legio.unidade_legionaria
    DROP CONSTRAINT IF EXISTS ck_unidade_dia_semana;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'unidade_legionaria'
           AND column_name = 'dia_semana_reuniao'
    )
    AND NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'unidade_legionaria'
           AND column_name = 'dia_reuniao'
    )
    THEN
        ALTER TABLE legio.unidade_legionaria
            RENAME COLUMN dia_semana_reuniao TO dia_reuniao;

        UPDATE legio.unidade_legionaria
           SET dia_reuniao = dia_reuniao + 1
         WHERE dia_reuniao BETWEEN 0 AND 6;
    END IF;
END
$$;

ALTER TABLE legio.unidade_legionaria
    ADD COLUMN IF NOT EXISTS dia_reuniao INTEGER;

ALTER TABLE legio.unidade_legionaria
    ALTER COLUMN dia_reuniao TYPE INTEGER
    USING dia_reuniao::INTEGER;

-- ============================================================
-- 3. PADRÃO DE AUDITORIA
-- ============================================================

ALTER TABLE legio.unidade_legionaria
    DROP CONSTRAINT IF EXISTS fk_unidade_criador,
    DROP CONSTRAINT IF EXISTS fk_unidade_alterador,
    DROP CONSTRAINT IF EXISTS fk_unidade_usu_inc,
    DROP CONSTRAINT IF EXISTS fk_unidade_usu_alt;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'unidade_legionaria'
           AND column_name = 'criado_por_usuario_id'
    ) THEN
        IF EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'legio'
               AND table_name = 'unidade_legionaria'
               AND column_name = 'usu_inc_id'
        ) THEN
            UPDATE legio.unidade_legionaria
               SET usu_inc_id = COALESCE(usu_inc_id, criado_por_usuario_id);

            ALTER TABLE legio.unidade_legionaria
                DROP COLUMN criado_por_usuario_id;
        ELSE
            ALTER TABLE legio.unidade_legionaria
                RENAME COLUMN criado_por_usuario_id TO usu_inc_id;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'unidade_legionaria'
           AND column_name = 'alterado_por_usuario_id'
    ) THEN
        IF EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'legio'
               AND table_name = 'unidade_legionaria'
               AND column_name = 'usu_alt_id'
        ) THEN
            UPDATE legio.unidade_legionaria
               SET usu_alt_id = COALESCE(usu_alt_id, alterado_por_usuario_id);

            ALTER TABLE legio.unidade_legionaria
                DROP COLUMN alterado_por_usuario_id;
        ELSE
            ALTER TABLE legio.unidade_legionaria
                RENAME COLUMN alterado_por_usuario_id TO usu_alt_id;
        END IF;
    END IF;
END
$$;

ALTER TABLE legio.unidade_legionaria
    ADD COLUMN IF NOT EXISTS usu_inc_id BIGINT,
    ADD COLUMN IF NOT EXISTS usu_alt_id BIGINT;

-- ============================================================
-- 4. VALIDAÇÃO DE ÓRFÃOS ANTES DAS FKs
-- ============================================================

DO $$
DECLARE
    v_dias_invalidos BIGINT;
    v_usu_inc_invalidos BIGINT;
    v_usu_alt_invalidos BIGINT;
BEGIN
    SELECT COUNT(*)
      INTO v_dias_invalidos
      FROM legio.unidade_legionaria ul
      LEFT JOIN legio.dia_reuniao dr
        ON dr.id = ul.dia_reuniao
     WHERE ul.dia_reuniao IS NOT NULL
       AND dr.id IS NULL;

    IF v_dias_invalidos > 0 THEN
        RAISE EXCEPTION
            'Existem % unidade(s) com dia_reuniao inválido. Corrija antes de criar a FK.',
            v_dias_invalidos;
    END IF;

    SELECT COUNT(*)
      INTO v_usu_inc_invalidos
      FROM legio.unidade_legionaria ul
      LEFT JOIN legio.usuario u
        ON u.id = ul.usu_inc_id
     WHERE ul.usu_inc_id IS NOT NULL
       AND u.id IS NULL;

    IF v_usu_inc_invalidos > 0 THEN
        RAISE EXCEPTION
            'Existem % unidade(s) com usu_inc_id inválido.',
            v_usu_inc_invalidos;
    END IF;

    SELECT COUNT(*)
      INTO v_usu_alt_invalidos
      FROM legio.unidade_legionaria ul
      LEFT JOIN legio.usuario u
        ON u.id = ul.usu_alt_id
     WHERE ul.usu_alt_id IS NOT NULL
       AND u.id IS NULL;

    IF v_usu_alt_invalidos > 0 THEN
        RAISE EXCEPTION
            'Existem % unidade(s) com usu_alt_id inválido.',
            v_usu_alt_invalidos;
    END IF;
END
$$;

-- ============================================================
-- 5. FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'legio.unidade_legionaria'::regclass
           AND conname = 'fk_unidade_dia_reuniao'
    )
    THEN
        ALTER TABLE legio.unidade_legionaria
            ADD CONSTRAINT fk_unidade_dia_reuniao
            FOREIGN KEY (dia_reuniao)
            REFERENCES legio.dia_reuniao(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'legio.unidade_legionaria'::regclass
           AND conname = 'fk_unidade_usu_inc'
    )
    THEN
        ALTER TABLE legio.unidade_legionaria
            ADD CONSTRAINT fk_unidade_usu_inc
            FOREIGN KEY (usu_inc_id)
            REFERENCES legio.usuario(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'legio.unidade_legionaria'::regclass
           AND conname = 'fk_unidade_usu_alt'
    )
    THEN
        ALTER TABLE legio.unidade_legionaria
            ADD CONSTRAINT fk_unidade_usu_alt
            FOREIGN KEY (usu_alt_id)
            REFERENCES legio.usuario(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- ============================================================
-- 6. ÍNDICES
-- ============================================================

DROP INDEX IF EXISTS legio.ix_unidade_criador;
DROP INDEX IF EXISTS legio.ix_unidade_alterador;

CREATE INDEX IF NOT EXISTS ix_unidade_dia_reuniao
    ON legio.unidade_legionaria (dia_reuniao);

CREATE INDEX IF NOT EXISTS ix_unidade_usu_inc
    ON legio.unidade_legionaria (usu_inc_id);

CREATE INDEX IF NOT EXISTS ix_unidade_usu_alt
    ON legio.unidade_legionaria (usu_alt_id);

-- ============================================================
-- 7. GARANTE TRIGGER updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trg_unidade_updated_at
    ON legio.unidade_legionaria;

CREATE TRIGGER trg_unidade_updated_at
BEFORE UPDATE ON legio.unidade_legionaria
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

COMMIT;
