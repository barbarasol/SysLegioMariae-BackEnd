-- SysLegioMariae / PostgreSQL — LOCALIZACAO DE PESSOA (SEM pais_id)
-- País é derivado por pessoa.id_municipio -> municipio.id_uf -> uf.id_pais -> pais.id.
-- Subdivisao é usada exclusivamente para as Regiões Administrativas do DF.
-- pessoa.celular e pessoa.telefone já existem; esta migração NÃO cria nem modifica essas colunas.
-- Faça backup e execute primeiro em homologação. Compatível com pessoas legadas sem município.
BEGIN;

ALTER TABLE legio.pessoa
  ADD COLUMN IF NOT EXISTS id_municipio INTEGER,
  ADD COLUMN IF NOT EXISTS subdivisao_local_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'legio.pessoa'::regclass AND conname = 'fk_pessoa_municipio') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_municipio
      FOREIGN KEY (id_municipio) REFERENCES legio.municipio(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'legio.pessoa'::regclass AND conname = 'fk_pessoa_subdivisao_local') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT fk_pessoa_subdivisao_local
      FOREIGN KEY (subdivisao_local_id) REFERENCES legio.subdivisao_local(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'legio.pessoa'::regclass AND conname = 'ck_pessoa_subdivisao_exige_municipio') THEN
    ALTER TABLE legio.pessoa ADD CONSTRAINT ck_pessoa_subdivisao_exige_municipio
      CHECK (subdivisao_local_id IS NULL OR id_municipio IS NOT NULL) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_pessoa_id_municipio ON legio.pessoa (id_municipio);
CREATE INDEX IF NOT EXISTS ix_pessoa_subdivisao_local_id ON legio.pessoa (subdivisao_local_id);

-- Regra de consistência de municipio e Região Administrativa do DF.
CREATE OR REPLACE FUNCTION legio.validar_localizacao_pessoa()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.subdivisao_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM legio.subdivisao_local sl
    JOIN legio.municipio m ON m.id = sl.municipio_id
    JOIN legio.uf uf ON uf.id = m.id_uf
    JOIN legio.pais p ON p.id = uf.id_pais
    WHERE sl.id = NEW.subdivisao_local_id
      AND sl.municipio_id = NEW.id_municipio
      AND uf.sigla = 'DF' AND UPPER(p.sigla) = 'BR'
  ) THEN
    RAISE EXCEPTION 'A Região Administrativa deve pertencer ao município do Distrito Federal.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_localizacao_pessoa ON legio.pessoa;
CREATE TRIGGER trg_validar_localizacao_pessoa
BEFORE INSERT OR UPDATE OF id_municipio, subdivisao_local_id
ON legio.pessoa FOR EACH ROW EXECUTE FUNCTION legio.validar_localizacao_pessoa();

COMMIT;

-- Consultas de diagnóstico APÓS a migração:
-- SELECT column_name,data_type FROM information_schema.columns
-- WHERE table_schema='legio' AND table_name='pessoa' ORDER BY ordinal_position;
-- SELECT p.id,p.nome,m.nome AS municipio,uf.sigla AS uf,pa.nome AS pais
-- FROM legio.pessoa p LEFT JOIN legio.municipio m ON m.id=p.id_municipio
-- LEFT JOIN legio.uf uf ON uf.id=m.id_uf LEFT JOIN legio.pais pa ON pa.id=uf.id_pais;

-- Se uma migração anterior já acrescentou pessoa.pais_id, não removê-lo
-- automaticamente porque pode conter dados. Após migrar/validar esses dados,
-- avaliar separadamente:
-- ALTER TABLE legio.pessoa DROP CONSTRAINT IF EXISTS fk_pessoa_pais;
-- DROP INDEX IF EXISTS legio.ix_pessoa_pais_id;
-- ALTER TABLE legio.pessoa DROP COLUMN IF EXISTS pais_id;

-- Unicidade de CPF: não criar automaticamente sem verificar duplicidades prévias.
-- SELECT regexp_replace(cpf, '[^0-9]', '', 'g') cpf, COUNT(*) total
-- FROM legio.pessoa WHERE cpf IS NOT NULL
-- GROUP BY 1 HAVING COUNT(*) > 1;
