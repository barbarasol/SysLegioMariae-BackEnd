-- SysLegioMariae — localização de legio.pessoa
-- Executar em homologação primeiro, com backup e revisão dos tipos das chaves.
-- Estrutura verificada nos services: pais.id INTEGER, municipio.id INTEGER,
-- subdivisao_local.id BIGINT, municipio.id_uf -> uf.id, uf.id_pais -> pais.id.
-- NÃO exige dados geográficos de pessoas anteriores.
BEGIN;

ALTER TABLE legio.pessoa
  ADD COLUMN IF NOT EXISTS pais_id INTEGER,
  ADD COLUMN IF NOT EXISTS id_municipio INTEGER,
  ADD COLUMN IF NOT EXISTS subdivisao_local_id BIGINT,
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);

-- Impede subdivisão sem município (valores antigos NULL continuam válidos).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'legio.pessoa'::regclass
                 AND conname = 'ck_pessoa_subdivisao_exige_municipio') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT ck_pessoa_subdivisao_exige_municipio
      CHECK (subdivisao_local_id IS NULL OR id_municipio IS NOT NULL) NOT VALID;
  END IF;
END $$;

-- Chaves estrangeiras. NOT VALID evita rejeição imediata de dados históricos;
-- novas inserções/alterações passam a respeitá-las.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'legio.pessoa'::regclass
                 AND conname = 'fk_pessoa_pais') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_pais
      FOREIGN KEY (pais_id) REFERENCES legio.pais(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'legio.pessoa'::regclass
                 AND conname = 'fk_pessoa_municipio') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_municipio
      FOREIGN KEY (id_municipio) REFERENCES legio.municipio(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'legio.pessoa'::regclass
                 AND conname = 'fk_pessoa_subdivisao_local') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_subdivisao_local
      FOREIGN KEY (subdivisao_local_id) REFERENCES legio.subdivisao_local(id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_pessoa_pais_id ON legio.pessoa (pais_id);
CREATE INDEX IF NOT EXISTS ix_pessoa_id_municipio ON legio.pessoa (id_municipio);
CREATE INDEX IF NOT EXISTS ix_pessoa_subdivisao_local_id ON legio.pessoa (subdivisao_local_id);

-- Valida coerência da hierarquia geográfica para novos/alterados registros.
CREATE OR REPLACE FUNCTION legio.validar_localizacao_pessoa()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id_municipio IS NOT NULL THEN
    IF NEW.pais_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM legio.municipio m
      JOIN legio.uf u ON u.id = m.id_uf
      WHERE m.id = NEW.id_municipio AND u.id_pais = NEW.pais_id
    ) THEN
      RAISE EXCEPTION 'O município selecionado não pertence ao país da pessoa.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.subdivisao_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM legio.subdivisao_local sl
    WHERE sl.id = NEW.subdivisao_local_id AND sl.municipio_id = NEW.id_municipio
  ) THEN
    RAISE EXCEPTION 'A subdivisão local não pertence ao município da pessoa.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_localizacao_pessoa ON legio.pessoa;
CREATE TRIGGER trg_validar_localizacao_pessoa
BEFORE INSERT OR UPDATE OF pais_id, id_municipio, subdivisao_local_id
ON legio.pessoa FOR EACH ROW EXECUTE FUNCTION legio.validar_localizacao_pessoa();

COMMIT;

-- Diagnóstico de CPF (somente consulta, sem alterar dados):
SELECT regexp_replace(cpf, '[^0-9]', '', 'g') AS cpf_normalizado,
       COUNT(*) AS quantidade, array_agg(id ORDER BY id) AS pessoas
FROM legio.pessoa
WHERE NULLIF(regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
GROUP BY 1 HAVING COUNT(*) > 1;

-- Após resolver duplicidades, criar índice único SEPARADAMENTE:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_pessoa_cpf_normalizado
-- ON legio.pessoa ((regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g')))
-- WHERE nullif(regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g'), '') IS NOT NULL;

-- Opcional, após inspeção/regularização dos dados legados:
-- ALTER TABLE legio.pessoa VALIDATE CONSTRAINT fk_pessoa_pais;
-- ALTER TABLE legio.pessoa VALIDATE CONSTRAINT fk_pessoa_municipio;
-- ALTER TABLE legio.pessoa VALIDATE CONSTRAINT fk_pessoa_subdivisao_local;
-- ALTER TABLE legio.pessoa VALIDATE CONSTRAINT ck_pessoa_subdivisao_exige_municipio;
