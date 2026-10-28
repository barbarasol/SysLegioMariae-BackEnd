BEGIN;

-- ============================================================
-- SYSLEGIOMARIAE
-- LOCALIZAÇÃO / CÓDIGO POSTAL / SUBDIVISÃO / IGREJA
-- REGRA:
--   BRASIL = somente registros existentes
--   EXTERIOR = inclusão permitida pelo backend
-- ============================================================

DO $$
BEGIN
    IF to_regclass('legio.pais') IS NULL
       OR to_regclass('legio.uf') IS NULL
       OR to_regclass('legio.municipio') IS NULL
       OR to_regclass('legio.subdivisao_local') IS NULL
       OR to_regclass('legio.codigo_postal') IS NULL
       OR to_regclass('legio.usuario') IS NULL
       OR to_regclass('legio.unidade_legionaria') IS NULL
    THEN
        RAISE EXCEPTION
            'Pré-requisitos ausentes. Devem existir pais, uf, municipio, subdivisao_local, codigo_postal, usuario e unidade_legionaria.';
    END IF;
END
$$;

-- ============================================================
-- PADRÃO DE AUDITORIA DA TABELA codigo_postal
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'codigo_postal'
           AND column_name = 'usuario_inclusao_id'
    )
    AND NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'codigo_postal'
           AND column_name = 'usu_inc_id'
    ) THEN
        ALTER TABLE legio.codigo_postal
            RENAME COLUMN usuario_inclusao_id TO usu_inc_id;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'codigo_postal'
           AND column_name = 'usuario_alteracao_id'
    )
    AND NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'codigo_postal'
           AND column_name = 'usu_alt_id'
    ) THEN
        ALTER TABLE legio.codigo_postal
            RENAME COLUMN usuario_alteracao_id TO usu_alt_id;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_usuario_inclusao'
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_usu_inc'
    ) THEN
        ALTER TABLE legio.codigo_postal
            RENAME CONSTRAINT fk_codigo_postal_usuario_inclusao
            TO fk_codigo_postal_usu_inc;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_usuario_alteracao'
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_usu_alt'
    ) THEN
        ALTER TABLE legio.codigo_postal
            RENAME CONSTRAINT fk_codigo_postal_usuario_alteracao
            TO fk_codigo_postal_usu_alt;
    END IF;
END
$$;

ALTER TABLE legio.codigo_postal
    ADD COLUMN IF NOT EXISTS uf_id INTEGER,
    ADD COLUMN IF NOT EXISTS municipio_id INTEGER,
    ADD COLUMN IF NOT EXISTS subdivisao_local_id BIGINT,
    ADD COLUMN IF NOT EXISTS localidade VARCHAR(150),
    ADD COLUMN IF NOT EXISTS tipo_logradouro VARCHAR(50),
    ADD COLUMN IF NOT EXISTS logradouro VARCHAR(200),
    ADD COLUMN IF NOT EXISTS bairro VARCHAR(120),
    ADD COLUMN IF NOT EXISTS fonte VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS origem_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS usu_inc_id BIGINT,
    ADD COLUMN IF NOT EXISTS usu_alt_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
DECLARE
    v_tipo TEXT;
BEGIN
    SELECT data_type
      INTO v_tipo
      FROM information_schema.columns
     WHERE table_schema = 'legio'
       AND table_name = 'codigo_postal'
       AND column_name = 'origem_id';

    IF v_tipo = 'uuid' THEN
        ALTER TABLE legio.codigo_postal
            ALTER COLUMN origem_id TYPE VARCHAR(100)
            USING origem_id::TEXT;
    END IF;
END
$$;

UPDATE legio.codigo_postal
   SET fonte = 'MANUAL'
 WHERE fonte IS NULL
    OR btrim(fonte) = '';

ALTER TABLE legio.codigo_postal
    ALTER COLUMN fonte SET DEFAULT 'MANUAL';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_uf'
    ) THEN
        ALTER TABLE legio.codigo_postal
            ADD CONSTRAINT fk_codigo_postal_uf
            FOREIGN KEY (uf_id)
            REFERENCES legio.uf(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_municipio'
    ) THEN
        ALTER TABLE legio.codigo_postal
            ADD CONSTRAINT fk_codigo_postal_municipio
            FOREIGN KEY (municipio_id)
            REFERENCES legio.municipio(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_subdivisao_local'
    ) THEN
        ALTER TABLE legio.codigo_postal
            ADD CONSTRAINT fk_codigo_postal_subdivisao_local
            FOREIGN KEY (subdivisao_local_id)
            REFERENCES legio.subdivisao_local(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_usu_inc'
    ) THEN
        ALTER TABLE legio.codigo_postal
            ADD CONSTRAINT fk_codigo_postal_usu_inc
            FOREIGN KEY (usu_inc_id)
            REFERENCES legio.usuario(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_usu_alt'
    ) THEN
        ALTER TABLE legio.codigo_postal
            ADD CONSTRAINT fk_codigo_postal_usu_alt
            FOREIGN KEY (usu_alt_id)
            REFERENCES legio.usuario(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_codigo_postal_uf
    ON legio.codigo_postal (uf_id);

CREATE INDEX IF NOT EXISTS idx_codigo_postal_municipio
    ON legio.codigo_postal (municipio_id);

CREATE INDEX IF NOT EXISTS idx_codigo_postal_subdivisao_local
    ON legio.codigo_postal (subdivisao_local_id);

CREATE INDEX IF NOT EXISTS idx_codigo_postal_normalizado
    ON legio.codigo_postal (
        upper(regexp_replace(codigo_postal, '[^A-Za-z0-9]', '', 'g'))
    );

DROP TRIGGER IF EXISTS trg_codigo_postal_updated_at
ON legio.codigo_postal;

CREATE TRIGGER trg_codigo_postal_updated_at
BEFORE UPDATE ON legio.codigo_postal
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- IGREJA / PARÓQUIA
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.igreja (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome                    VARCHAR(100) NOT NULL,
    padre                   VARCHAR(100),
    celular                 VARCHAR(20),
    telefone                VARCHAR(20),
    telefone2               VARCHAR(20),
    email                   VARCHAR(150),
    site                    VARCHAR(200),
    id_municipio            INTEGER NOT NULL,
    subdivisao_local_id     BIGINT,
    codigo_postal_id        BIGINT,
    bairro                  VARCHAR(120),
    logradouro              VARCHAR(200),
    numero_logradouro       VARCHAR(30),
    complemento             VARCHAR(150),
    status                  VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
    usu_inc_id              BIGINT,
    usu_alt_id              BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_igreja_status
        CHECK (status IN ('ATIVA', 'INATIVA')),

    CONSTRAINT fk_igreja_municipio
        FOREIGN KEY (id_municipio)
        REFERENCES legio.municipio(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_igreja_subdivisao_local
        FOREIGN KEY (subdivisao_local_id)
        REFERENCES legio.subdivisao_local(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_igreja_codigo_postal
        FOREIGN KEY (codigo_postal_id)
        REFERENCES legio.codigo_postal(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_igreja_usu_inc
        FOREIGN KEY (usu_inc_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_igreja_usu_alt
        FOREIGN KEY (usu_alt_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL
);

-- Renomeia auditoria antiga caso a tabela já exista.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'igreja'
           AND column_name = 'usuario_inclusao_id'
    )
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'igreja'
           AND column_name = 'usu_inc_id'
    ) THEN
        ALTER TABLE legio.igreja
            RENAME COLUMN usuario_inclusao_id TO usu_inc_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'igreja'
           AND column_name = 'usuario_alteracao_id'
    )
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'igreja'
           AND column_name = 'usu_alt_id'
    ) THEN
        ALTER TABLE legio.igreja
            RENAME COLUMN usuario_alteracao_id TO usu_alt_id;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_usuario_inclusao'
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_usu_inc'
    ) THEN
        ALTER TABLE legio.igreja
            RENAME CONSTRAINT fk_igreja_usuario_inclusao
            TO fk_igreja_usu_inc;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_usuario_alteracao'
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_usu_alt'
    ) THEN
        ALTER TABLE legio.igreja
            RENAME CONSTRAINT fk_igreja_usuario_alteracao
            TO fk_igreja_usu_alt;
    END IF;
END
$$;

ALTER TABLE legio.igreja
    ADD COLUMN IF NOT EXISTS padre VARCHAR(100),
    ADD COLUMN IF NOT EXISTS celular VARCHAR(20),
    ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS telefone2 VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS site VARCHAR(200),
    ADD COLUMN IF NOT EXISTS id_municipio INTEGER,
    ADD COLUMN IF NOT EXISTS subdivisao_local_id BIGINT,
    ADD COLUMN IF NOT EXISTS codigo_postal_id BIGINT,
    ADD COLUMN IF NOT EXISTS bairro VARCHAR(120),
    ADD COLUMN IF NOT EXISTS logradouro VARCHAR(200),
    ADD COLUMN IF NOT EXISTS numero_logradouro VARCHAR(30),
    ADD COLUMN IF NOT EXISTS complemento VARCHAR(150),
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
    ADD COLUMN IF NOT EXISTS usu_inc_id BIGINT,
    ADD COLUMN IF NOT EXISTS usu_alt_id BIGINT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE legio.igreja
   SET status = 'ATIVA'
 WHERE status IS NULL
    OR btrim(status) = ''
    OR upper(btrim(status)) IN ('ATIVO', 'ATIVA', 'PENDENTE');

UPDATE legio.igreja
   SET status = 'INATIVA'
 WHERE upper(btrim(status)) IN ('INATIVO', 'INATIVA', 'REJEITADA');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM legio.igreja
         WHERE status NOT IN ('ATIVA', 'INATIVA')
    ) THEN
        RAISE EXCEPTION
            'Existem status de igreja não reconhecidos. Corrija-os antes de aplicar a constraint ATIVA/INATIVA.';
    END IF;
END
$$;

ALTER TABLE legio.igreja
    ALTER COLUMN status SET DEFAULT 'ATIVA',
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE legio.igreja
    DROP CONSTRAINT IF EXISTS ck_igreja_status;

ALTER TABLE legio.igreja
    ADD CONSTRAINT ck_igreja_status
    CHECK (status IN ('ATIVA', 'INATIVA'));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_municipio'
    ) THEN
        ALTER TABLE legio.igreja
            ADD CONSTRAINT fk_igreja_municipio
            FOREIGN KEY (id_municipio)
            REFERENCES legio.municipio(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_subdivisao_local'
    ) THEN
        ALTER TABLE legio.igreja
            ADD CONSTRAINT fk_igreja_subdivisao_local
            FOREIGN KEY (subdivisao_local_id)
            REFERENCES legio.subdivisao_local(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_codigo_postal'
    ) THEN
        ALTER TABLE legio.igreja
            ADD CONSTRAINT fk_igreja_codigo_postal
            FOREIGN KEY (codigo_postal_id)
            REFERENCES legio.codigo_postal(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_usu_inc'
    ) THEN
        ALTER TABLE legio.igreja
            ADD CONSTRAINT fk_igreja_usu_inc
            FOREIGN KEY (usu_inc_id)
            REFERENCES legio.usuario(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.igreja'::regclass
           AND conname = 'fk_igreja_usu_alt'
    ) THEN
        ALTER TABLE legio.igreja
            ADD CONSTRAINT fk_igreja_usu_alt
            FOREIGN KEY (usu_alt_id)
            REFERENCES legio.usuario(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- Se existir a coluna legada igreja.cep, vincula SOMENTE a códigos
-- postais que já existem. Não cria CEP brasileiro nem estrangeiro.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'legio'
           AND table_name = 'igreja'
           AND column_name = 'cep'
    ) THEN
        EXECUTE $sql$
            UPDATE legio.igreja i
               SET codigo_postal_id = (
                   SELECT c.id
                     FROM legio.codigo_postal c
                     JOIN legio.municipio m
                       ON m.id = i.id_municipio
                     JOIN legio.uf u
                       ON u.id = m.id_uf
                    WHERE c.pais_id = u.id_pais
                      AND c.ativo = TRUE
                      AND upper(regexp_replace(c.codigo_postal, '[^A-Za-z0-9]', '', 'g'))
                          =
                          upper(regexp_replace(i.cep, '[^A-Za-z0-9]', '', 'g'))
                      AND (
                          c.municipio_id IS NULL
                          OR c.municipio_id = i.id_municipio
                      )
                    ORDER BY
                        CASE WHEN c.municipio_id = i.id_municipio THEN 0 ELSE 1 END,
                        c.id
                    LIMIT 1
               )
             WHERE i.codigo_postal_id IS NULL
               AND i.cep IS NOT NULL
               AND btrim(i.cep) <> ''
        $sql$;
    END IF;
END
$$;

-- Quando o código postal já possui subdivisão inequívoca, aproveita-a
-- somente para igrejas que ainda não possuem subdivisão.
UPDATE legio.igreja i
   SET subdivisao_local_id = cp.subdivisao_local_id
  FROM legio.codigo_postal cp
 WHERE cp.id = i.codigo_postal_id
   AND i.subdivisao_local_id IS NULL
   AND cp.subdivisao_local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_igreja_municipio
    ON legio.igreja (id_municipio);

CREATE INDEX IF NOT EXISTS idx_igreja_subdivisao_local
    ON legio.igreja (subdivisao_local_id);

CREATE INDEX IF NOT EXISTS idx_igreja_codigo_postal
    ON legio.igreja (codigo_postal_id);

CREATE INDEX IF NOT EXISTS idx_igreja_status
    ON legio.igreja (status);

CREATE INDEX IF NOT EXISTS idx_igreja_usu_inc
    ON legio.igreja (usu_inc_id);

CREATE INDEX IF NOT EXISTS idx_igreja_usu_alt
    ON legio.igreja (usu_alt_id);

DROP TRIGGER IF EXISTS trg_igreja_updated_at
ON legio.igreja;

CREATE TRIGGER trg_igreja_updated_at
BEFORE UPDATE ON legio.igreja
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- VÍNCULOS NORMALIZADOS DA UNIDADE
-- ============================================================

ALTER TABLE legio.unidade_legionaria
    ADD COLUMN IF NOT EXISTS municipio_id INTEGER,
    ADD COLUMN IF NOT EXISTS igreja_id BIGINT,
    ADD COLUMN IF NOT EXISTS alterado_por_usuario_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.unidade_legionaria'::regclass
           AND conname = 'fk_unidade_municipio'
    ) THEN
        ALTER TABLE legio.unidade_legionaria
            ADD CONSTRAINT fk_unidade_municipio
            FOREIGN KEY (municipio_id)
            REFERENCES legio.municipio(id)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.unidade_legionaria'::regclass
           AND conname = 'fk_unidade_igreja'
    ) THEN
        ALTER TABLE legio.unidade_legionaria
            ADD CONSTRAINT fk_unidade_igreja
            FOREIGN KEY (igreja_id)
            REFERENCES legio.igreja(id)
            ON DELETE RESTRICT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_unidade_municipio
    ON legio.unidade_legionaria (municipio_id);

CREATE INDEX IF NOT EXISTS ix_unidade_igreja
    ON legio.unidade_legionaria (igreja_id);

-- ============================================================
-- FUNÇÃO DE CONSULTA DE CÓDIGO POSTAL
-- Agora também retorna subdivisão local.
-- ============================================================

DROP FUNCTION IF EXISTS legio.fn_buscar_codigo_postal(TEXT);

CREATE FUNCTION legio.fn_buscar_codigo_postal(
    p_codigo_postal TEXT
)
RETURNS TABLE (
    id                      BIGINT,
    codigo_postal           VARCHAR(20),
    tipo_logradouro         VARCHAR(50),
    logradouro              VARCHAR(200),
    bairro                  VARCHAR(120),
    localidade              VARCHAR(150),
    municipio_id            INTEGER,
    municipio               VARCHAR(100),
    uf_id                   INTEGER,
    uf                      VARCHAR(20),
    subdivisao_local_id     BIGINT,
    subdivisao_local        VARCHAR(120),
    subdivisao_tipo         VARCHAR(50),
    subdivisao_codigo       VARCHAR(30),
    pais_id                 INTEGER,
    pais                    VARCHAR(100),
    fonte                   VARCHAR(50),
    origem_id               VARCHAR(100)
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        cp.id,
        cp.codigo_postal,
        cp.tipo_logradouro,
        cp.logradouro,
        cp.bairro,
        cp.localidade,
        cp.municipio_id,
        m.nome AS municipio,
        COALESCE(cp.uf_id, m.id_uf) AS uf_id,
        u.sigla AS uf,
        cp.subdivisao_local_id,
        sl.nome AS subdivisao_local,
        sl.tipo AS subdivisao_tipo,
        sl.codigo AS subdivisao_codigo,
        cp.pais_id,
        p.nome AS pais,
        cp.fonte,
        cp.origem_id
    FROM legio.codigo_postal cp
    JOIN legio.pais p
      ON p.id = cp.pais_id
    LEFT JOIN legio.municipio m
      ON m.id = cp.municipio_id
    LEFT JOIN legio.uf u
      ON u.id = COALESCE(cp.uf_id, m.id_uf)
    LEFT JOIN legio.subdivisao_local sl
      ON sl.id = cp.subdivisao_local_id
    WHERE cp.ativo = TRUE
      AND upper(regexp_replace(cp.codigo_postal, '[^A-Za-z0-9]', '', 'g'))
          =
          upper(regexp_replace(p_codigo_postal, '[^A-Za-z0-9]', '', 'g'))
    ORDER BY
        CASE WHEN cp.fonte = 'MANUAL' THEN 0 ELSE 1 END,
        cp.localidade NULLS LAST,
        cp.logradouro NULLS LAST,
        cp.id;
$$;

COMMIT;
