-- Etapa 1: expansão NÃO destrutiva (aplicar antes do deploy Backend)
BEGIN;
ALTER TABLE legio.pessoa
  ADD COLUMN IF NOT EXISTS dt_ordenacao_presbiteral DATE,
  ADD COLUMN IF NOT EXISTS id_municipio INTEGER,
  ADD COLUMN IF NOT EXISTS subdivisao_local_id BIGINT,
  ADD COLUMN IF NOT EXISTS localidade VARCHAR(120);
ALTER TABLE legio.solicitacao_oficial
  ADD COLUMN IF NOT EXISTS pessoa_dt_ordenacao_presbiteral DATE,
  ADD COLUMN IF NOT EXISTS pessoa_id_municipio INTEGER,
  ADD COLUMN IF NOT EXISTS pessoa_subdivisao_local_id BIGINT,
  ADD COLUMN IF NOT EXISTS pessoa_cep VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pessoa_logradouro VARCHAR(200),
  ADD COLUMN IF NOT EXISTS pessoa_numero_logradouro VARCHAR(30),
  ADD COLUMN IF NOT EXISTS pessoa_complemento VARCHAR(150),
  ADD COLUMN IF NOT EXISTS pessoa_bairro VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pessoa_localidade VARCHAR(120);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='legio.pessoa'::regclass AND conname='fk_pessoa_municipio') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_municipio FOREIGN KEY (id_municipio) REFERENCES legio.municipio(id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='legio.pessoa'::regclass AND conname='fk_pessoa_subdivisao_local') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_subdivisao_local FOREIGN KEY (subdivisao_local_id) REFERENCES legio.subdivisao_local(id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='legio.solicitacao_oficial'::regclass AND conname='fk_sol_oficial_municipio') THEN
    ALTER TABLE legio.solicitacao_oficial ADD CONSTRAINT fk_sol_oficial_municipio FOREIGN KEY (pessoa_id_municipio) REFERENCES legio.municipio(id) NOT VALID;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='legio.solicitacao_oficial'::regclass AND conname='fk_sol_oficial_subdivisao') THEN
    ALTER TABLE legio.solicitacao_oficial ADD CONSTRAINT fk_sol_oficial_subdivisao FOREIGN KEY (pessoa_subdivisao_local_id) REFERENCES legio.subdivisao_local(id) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_pessoa_id_municipio ON legio.pessoa(id_municipio);
COMMIT;
