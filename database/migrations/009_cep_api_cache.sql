BEGIN;

-- ============================================================
-- V2.9 - CEP POR API PÚBLICA + CACHE LOCAL
-- ============================================================
-- A tabela legio.codigo_postal deixa de ser catálogo nacional e
-- passa a armazenar somente CEPs efetivamente consultados/usados.
--
-- Para o DF, o vínculo CEP x Região Administrativa fica separado
-- em legio.codigo_postal_subdivisao, permitindo inclusive CEPs
-- ambíguos (N:N).
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.codigo_postal (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pais_id             INTEGER NOT NULL,
    uf_id               INTEGER,
    municipio_id        INTEGER,
    subdivisao_local_id BIGINT,
    localidade          VARCHAR(150),
    codigo_postal       VARCHAR(20) NOT NULL,
    tipo_logradouro     VARCHAR(50),
    logradouro          VARCHAR(200),
    bairro              VARCHAR(120),
    fonte               VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
    origem_id           VARCHAR(100),
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    usu_inc_id          BIGINT,
    usu_alt_id          BIGINT,
    consultado_em       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE legio.codigo_postal
    ADD COLUMN IF NOT EXISTS consultado_em TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'legio.codigo_postal'::regclass
           AND conname = 'fk_codigo_postal_pais'
    ) THEN
        ALTER TABLE legio.codigo_postal
            ADD CONSTRAINT fk_codigo_postal_pais
            FOREIGN KEY (pais_id)
            REFERENCES legio.pais(id)
            ON DELETE RESTRICT;
    END IF;

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
END $$;

CREATE INDEX IF NOT EXISTS idx_codigo_postal_normalizado
    ON legio.codigo_postal (
        upper(regexp_replace(codigo_postal, '[^A-Za-z0-9]', '', 'g'))
    );

CREATE INDEX IF NOT EXISTS idx_codigo_postal_municipio
    ON legio.codigo_postal(municipio_id);

CREATE INDEX IF NOT EXISTS idx_codigo_postal_subdivisao_local
    ON legio.codigo_postal(subdivisao_local_id);

-- Evita duplicar no cache o mesmo CEP + subdivisão mesmo quando
-- a fonte externa de fallback mudar entre BrasilAPI e ViaCEP.
CREATE UNIQUE INDEX IF NOT EXISTS uq_codigo_postal_cache_brasil
    ON legio.codigo_postal (
        pais_id,
        regexp_replace(codigo_postal, '[^0-9]', '', 'g'),
        COALESCE(subdivisao_local_id, 0::bigint)
    )
    WHERE fonte IN ('BRASILAPI', 'VIACEP');

DROP TRIGGER IF EXISTS trg_codigo_postal_updated_at
ON legio.codigo_postal;

CREATE TRIGGER trg_codigo_postal_updated_at
BEFORE UPDATE ON legio.codigo_postal
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- CEP x SUBDIVISÃO LOCAL (DF)
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.codigo_postal_subdivisao (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_postal       VARCHAR(20) NOT NULL,
    subdivisao_local_id BIGINT NOT NULL,
    fonte               VARCHAR(50) NOT NULL DEFAULT 'DF_ESPACIAL_V4',
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    usu_inc_id          BIGINT,
    usu_alt_id          BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_codigo_postal_subdivisao_local
        FOREIGN KEY (subdivisao_local_id)
        REFERENCES legio.subdivisao_local(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_codigo_postal_subdivisao_usu_inc
        FOREIGN KEY (usu_inc_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_codigo_postal_subdivisao_usu_alt
        FOREIGN KEY (usu_alt_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_codigo_postal_subdivisao_cep
        CHECK (regexp_replace(codigo_postal, '[^0-9]', '', 'g') ~ '^[0-9]{8}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_codigo_postal_subdivisao
    ON legio.codigo_postal_subdivisao (
        regexp_replace(codigo_postal, '[^0-9]', '', 'g'),
        subdivisao_local_id
    );

CREATE INDEX IF NOT EXISTS idx_codigo_postal_subdivisao_cep
    ON legio.codigo_postal_subdivisao (
        regexp_replace(codigo_postal, '[^0-9]', '', 'g')
    );

CREATE INDEX IF NOT EXISTS idx_codigo_postal_subdivisao_local
    ON legio.codigo_postal_subdivisao(subdivisao_local_id);

DROP TRIGGER IF EXISTS trg_codigo_postal_subdivisao_updated_at
ON legio.codigo_postal_subdivisao;

CREATE TRIGGER trg_codigo_postal_subdivisao_updated_at
BEFORE UPDATE ON legio.codigo_postal_subdivisao
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- Se a migration for executada no banco antigo que ainda contém a
-- carga WELYAB/V4, aproveita os vínculos já classificados e os copia
-- para a tabela pequena de mapeamento antes de qualquer limpeza.
INSERT INTO legio.codigo_postal_subdivisao
(
    codigo_postal,
    subdivisao_local_id,
    fonte,
    usu_inc_id,
    usu_alt_id
)
SELECT DISTINCT
    regexp_replace(cp.codigo_postal, '[^0-9]', '', 'g'),
    cp.subdivisao_local_id,
    'MIGRADO_CODIGO_POSTAL',
    cp.usu_inc_id,
    cp.usu_alt_id
FROM legio.codigo_postal cp
JOIN legio.subdivisao_local sl
  ON sl.id = cp.subdivisao_local_id
JOIN legio.municipio m
  ON m.id = sl.municipio_id
WHERE cp.subdivisao_local_id IS NOT NULL
  AND regexp_replace(cp.codigo_postal, '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
  AND m.codigo_ibge = 5300108
ON CONFLICT DO NOTHING;

COMMIT;
