-- SysLegioMariae v3.2.1 - banco sem lançamentos anteriores.
-- Pré-requisito: migration 014_unidade_numeros.sql executada.
-- NÃO migra dados históricos. Mantém IDs e a tabela existente.
-- Executar como proprietário do schema legio no SQL Editor.
BEGIN;

-- 1. Campo institucional = valores duradouros da unidade.
ALTER TABLE legio.unidade_legionaria
    ADD COLUMN IF NOT EXISTS num_ult_ata INTEGER,
    ADD COLUMN IF NOT EXISTS num_ult_relatorio INTEGER,
    ADD COLUMN IF NOT EXISTS dt_apresentacao_ult_relatorio DATE,
    ADD COLUMN IF NOT EXISTS dt_ultimo_congresso DATE;

ALTER TABLE legio.unidade_legionaria
    DROP CONSTRAINT IF EXISTS ck_unidade_institucional_numeros;
ALTER TABLE legio.unidade_legionaria
    ADD CONSTRAINT ck_unidade_institucional_numeros
      CHECK ((num_ult_ata IS NULL OR num_ult_ata >= 0)
         AND (num_ult_relatorio IS NULL OR num_ult_relatorio >= 0));

-- 2. Retira atributos movidos para outras tabelas.
ALTER TABLE legio.unidade_numeros
    DROP CONSTRAINT IF EXISTS ck_numeros_nao_negativos;
ALTER TABLE legio.unidade_numeros
    DROP COLUMN IF EXISTS numero_ultimo_ata,
    DROP COLUMN IF EXISTS numero_ultimo_relatorio,
    DROP COLUMN IF EXISTS numero_ultimo_relotorio,
    DROP COLUMN IF EXISTS data_ultima_visita,
    DROP COLUMN IF EXISTS visitante_01_id,
    DROP COLUMN IF EXISTS visitante_02_id,
    DROP COLUMN IF EXISTS visitante_01_ind,
    DROP COLUMN IF EXISTS visitante_02_ind;
ALTER TABLE legio.unidade_numeros
    ADD COLUMN IF NOT EXISTS usu_inc_id BIGINT,
    ADD COLUMN IF NOT EXISTS usu_alt_id BIGINT;

ALTER TABLE legio.unidade_numeros
    ADD CONSTRAINT ck_numeros_nao_negativos
    CHECK (
      (qtd_senatus IS NULL OR qtd_senatus >= 0)
            AND (qtd_regiae IS NULL OR qtd_regiae >= 0)
            AND (qtd_comitia IS NULL OR qtd_comitia >= 0)
            AND (qtd_comitia_juv IS NULL OR qtd_comitia_juv >= 0)
            AND (qtd_curiae IS NULL OR qtd_curiae >= 0)
            AND (qtd_curiae_juv IS NULL OR qtd_curiae_juv >= 0)
            AND (qtd_praesidia IS NULL OR qtd_praesidia >= 0)
            AND (qtd_praesidia_juv IS NULL OR qtd_praesidia_juv >= 0)
            AND (qtd_velites IS NULL OR qtd_velites >= 0)
            AND (qtd_praticios IS NULL OR qtd_praticios >= 0)
            AND (qtd_pretorianos IS NULL OR qtd_pretorianos >= 0)
            AND (qtd_adjutores IS NULL OR qtd_adjutores >= 0)
            AND (qtd_ativos_com_promessa IS NULL OR qtd_ativos_com_promessa >= 0)
            AND (qtd_ativos_sem_promessa IS NULL OR qtd_ativos_sem_promessa >= 0)
            AND (qtd_auxiliares_permanentes IS NULL OR qtd_auxiliares_permanentes >= 0)
            AND (qtd_auxiliares_provisorios IS NULL OR qtd_auxiliares_provisorios >= 0)
            AND (qtd_mescs IS NULL OR qtd_mescs >= 0)
            AND (qtd_catequistas IS NULL OR qtd_catequistas >= 0)
            AND (qtd_coroinhas IS NULL OR qtd_coroinhas >= 0)
            AND (qtd_praesidia_total IS NULL OR qtd_praesidia_total >= 0)
            AND (qtd_igrejas_com_legiao IS NULL OR qtd_igrejas_com_legiao >= 0)
            AND (qtd_igrejas_sem_legiao IS NULL OR qtd_igrejas_sem_legiao >= 0)
    );

-- Evita duplicidade de FK em execução repetida.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'legio.unidade_numeros'::regclass AND conname = 'fk_unidade_numeros_usu_inc') THEN
    ALTER TABLE legio.unidade_numeros ADD CONSTRAINT fk_unidade_numeros_usu_inc
      FOREIGN KEY (usu_inc_id) REFERENCES legio.usuario(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'legio.unidade_numeros'::regclass AND conname = 'fk_unidade_numeros_usu_alt') THEN
    ALTER TABLE legio.unidade_numeros ADD CONSTRAINT fk_unidade_numeros_usu_alt
      FOREIGN KEY (usu_alt_id) REFERENCES legio.usuario(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Visitas: múltiplas por unidade e ano; ano coerente com data_visita.
CREATE TABLE IF NOT EXISTS legio.unidade_visitas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unidade_id BIGINT NOT NULL REFERENCES legio.unidade_legionaria(id) ON DELETE RESTRICT,
    ano INTEGER NOT NULL CHECK (ano BETWEEN 1900 AND 2200),
    data_visita DATE NOT NULL,
    visitantes VARCHAR(200) NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usu_inc_id BIGINT REFERENCES legio.usuario(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usu_alt_id BIGINT REFERENCES legio.usuario(id) ON DELETE SET NULL,
    CONSTRAINT ck_unidade_visitas_ano_data
        CHECK (ano = EXTRACT(YEAR FROM data_visita)::INTEGER),
    CONSTRAINT ck_unidade_visitas_visitantes_nao_vazios
        CHECK (length(trim(visitantes)) > 0)
);
CREATE INDEX IF NOT EXISTS ix_unidade_visitas_unidade_ano_data
    ON legio.unidade_visitas (unidade_id, ano, data_visita DESC, id DESC);

-- Padrão adotado no SysLegioMariae para updated_at.
DROP TRIGGER IF EXISTS trg_unidade_visitas_updated_at ON legio.unidade_visitas;
CREATE TRIGGER trg_unidade_visitas_updated_at
BEFORE UPDATE ON legio.unidade_visitas FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

ALTER TABLE legio.unidade_visitas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legio.unidade_visitas FROM anon, authenticated;
-- Backend Sequelize com role com privilégios apropriados / RLS bypass.

-- 4. Nova função anual: copia EXCLUSIVAMENTE números quantitativos,
-- e deixa auditoria de usuário nula quando acionada por Cron.
CREATE OR REPLACE FUNCTION legio.fn_iniciar_ano_numeros_unidade(p_ano INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_inseridos INTEGER := 0;
BEGIN
    IF p_ano IS NULL OR p_ano < 1901 OR p_ano > 2200 THEN
       RAISE EXCEPTION 'Ano inválido: %', p_ano;
    END IF;

    WITH ultimos AS (
      SELECT DISTINCT ON (n.unidade_id) n.*
      FROM legio.unidade_numeros n
      JOIN legio.unidade_legionaria u ON u.id = n.unidade_id
      WHERE n.ano = p_ano - 1 AND u.ativo = TRUE
      ORDER BY n.unidade_id, (n.status = 'CONFIRMADO') DESC, n.mes DESC, n.id DESC
    )
    INSERT INTO legio.unidade_numeros
      (unidade_id, ano, mes, qtd_senatus, qtd_regiae, qtd_comitia, qtd_comitia_juv, qtd_curiae, qtd_curiae_juv, qtd_praesidia, qtd_praesidia_juv, qtd_velites, qtd_praticios, qtd_pretorianos, qtd_adjutores, qtd_ativos_com_promessa, qtd_ativos_sem_promessa, qtd_auxiliares_permanentes, qtd_auxiliares_provisorios, qtd_mescs, qtd_catequistas, qtd_coroinhas, qtd_praesidia_total, qtd_igrejas_com_legiao, qtd_igrejas_sem_legiao,
       status, origem, copiado_de_id, usu_inc_id, usu_alt_id)
    SELECT n.unidade_id, p_ano, 1,
        n.qtd_senatus,
        n.qtd_regiae,
        n.qtd_comitia,
        n.qtd_comitia_juv,
        n.qtd_curiae,
        n.qtd_curiae_juv,
        n.qtd_praesidia,
        n.qtd_praesidia_juv,
        n.qtd_velites,
        n.qtd_praticios,
        n.qtd_pretorianos,
        n.qtd_adjutores,
        n.qtd_ativos_com_promessa,
        n.qtd_ativos_sem_promessa,
        n.qtd_auxiliares_permanentes,
        n.qtd_auxiliares_provisorios,
        n.qtd_mescs,
        n.qtd_catequistas,
        n.qtd_coroinhas,
        n.qtd_praesidia_total,
        n.qtd_igrejas_com_legiao,
        n.qtd_igrejas_sem_legiao,
        'RASCUNHO', 'VIRADA_ANO', n.id, NULL, NULL
    FROM ultimos n
    ON CONFLICT ON CONSTRAINT uq_unidade_numeros_competencia DO NOTHING;
    GET DIAGNOSTICS v_inseridos = ROW_COUNT;
    RETURN v_inseridos;
END; $$;
REVOKE ALL ON FUNCTION legio.fn_iniciar_ano_numeros_unidade(INTEGER) FROM PUBLIC;

COMMIT;

-- Verificação:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='legio' AND table_name='unidade_numeros' ORDER BY ordinal_position;
-- SELECT * FROM legio.unidade_visitas LIMIT 1;
-- SELECT num_ult_ata, num_ult_relatorio FROM legio.unidade_legionaria LIMIT 1;
