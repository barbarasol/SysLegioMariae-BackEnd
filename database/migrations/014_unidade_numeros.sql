-- SysLegioMariae | Historico quantitativo de Conselhos e Praesidia
-- Compativel com PostgreSQL / Supabase.
-- Nao executa migracao de dados preexistentes nem altera legio.unidade_legionaria.
-- Execute no SQL Editor, verificando primeiro a base e o schema de destino.

CREATE TABLE IF NOT EXISTS legio.unidade_numeros (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unidade_id BIGINT NOT NULL,
    ano INTEGER NOT NULL,
    mes SMALLINT NOT NULL,

    qtd_senatus INTEGER DEFAULT NULL,
    qtd_regiae INTEGER DEFAULT NULL,
    qtd_comitia INTEGER DEFAULT NULL,
    qtd_comitia_juv INTEGER DEFAULT NULL,
    qtd_curiae INTEGER DEFAULT NULL,
    qtd_curiae_juv INTEGER DEFAULT NULL,
    qtd_praesidia INTEGER DEFAULT NULL,
    qtd_praesidia_juv INTEGER DEFAULT NULL,
    qtd_velites INTEGER DEFAULT NULL,
    qtd_praticios INTEGER DEFAULT NULL,
    qtd_pretorianos INTEGER DEFAULT NULL,
    qtd_adjutores INTEGER DEFAULT NULL,
    qtd_ativos_com_promessa INTEGER DEFAULT NULL,
    qtd_ativos_sem_promessa INTEGER DEFAULT NULL,
    qtd_auxiliares_permanentes INTEGER DEFAULT NULL,
    qtd_auxiliares_provisorios INTEGER DEFAULT NULL,
    qtd_mescs INTEGER DEFAULT NULL,
    qtd_catequistas INTEGER DEFAULT NULL,
    qtd_coroinhas INTEGER DEFAULT NULL,
    qtd_praesidia_total INTEGER DEFAULT NULL,
    qtd_igrejas_com_legiao INTEGER DEFAULT NULL,
    qtd_igrejas_sem_legiao INTEGER DEFAULT NULL,
    numero_ultimo_ata INTEGER DEFAULT NULL,
    numero_ultimo_relotorio INTEGER DEFAULT NULL,
    data_ultima_visita DATE,
    visitante_01_id BIGINT,
    visitante_02_id BIGINT,

    status VARCHAR(15) NOT NULL DEFAULT 'RASCUNHO',
    origem VARCHAR(15) NOT NULL DEFAULT 'MANUAL',
    copiado_de_id BIGINT,
    confirmado_em TIMESTAMPTZ,
    confirmado_por_usuario_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_numeros_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_numeros_copiado_de
        FOREIGN KEY (copiado_de_id)
        REFERENCES legio.unidade_numeros(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_numeros_confirmado_por
        FOREIGN KEY (confirmado_por_usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_unidade_numeros_competencia
        UNIQUE (unidade_id, ano, mes),

    CONSTRAINT ck_numeros_ano
        CHECK (ano BETWEEN 1900 AND 2200),

    CONSTRAINT ck_numeros_mes
        CHECK (mes BETWEEN 1 AND 12),

    CONSTRAINT ck_numeros_status
        CHECK (status IN ('RASCUNHO', 'CONFIRMADO')),

    CONSTRAINT ck_numeros_origem
        CHECK (origem IN ('MANUAL', 'VIRADA_ANO')),

    CONSTRAINT ck_numeros_nao_negativos
        CHECK (
          LEAST(
            COALESCE(qtd_senatus, 0),
            COALESCE(qtd_regiae, 0),
            COALESCE(qtd_comitia, 0),
            COALESCE(qtd_comitia_juv, 0),
            COALESCE(qtd_curiae, 0),
            COALESCE(qtd_curiae_juv, 0),
            COALESCE(qtd_praesidia, 0),
            COALESCE(qtd_praesidia_juv, 0),
            COALESCE(qtd_velites, 0),
            COALESCE(qtd_praticios, 0),
            COALESCE(qtd_pretorianos, 0),
            COALESCE(qtd_adjutores, 0),
            COALESCE(qtd_ativos_com_promessa, 0),
            COALESCE(qtd_ativos_sem_promessa, 0),
            COALESCE(qtd_auxiliares_permanentes, 0),
            COALESCE(qtd_auxiliares_provisorios, 0),
            COALESCE(qtd_mescs, 0),
            COALESCE(qtd_catequistas, 0),
            COALESCE(qtd_coroinhas, 0),
            COALESCE(qtd_praesidia_total, 0),
            COALESCE(qtd_igrejas_com_legiao, 0),
            COALESCE(qtd_igrejas_sem_legiao, 0),
            COALESCE(numero_ultimo_ata, 0),
            COALESCE(numero_ultimo_relotorio, 0)
          ) >= 0
        )
);

CREATE INDEX IF NOT EXISTS ix_unidade_numeros_ano_mes
    ON legio.unidade_numeros (ano, mes);

CREATE INDEX IF NOT EXISTS ix_unidade_numeros_status
    ON legio.unidade_numeros (status);

COMMENT ON TABLE legio.unidade_numeros IS
    'Indicadores historicos por unidade legionaria e competencia mensal. Janeiro pode receber copia provisoria do ultimo registro do ano anterior.';

COMMENT ON COLUMN legio.unidade_numeros.copiado_de_id IS
    'Identificador do registro de origem copiado na virada anual.';

COMMENT ON COLUMN legio.unidade_numeros.visitante_01_id IS
    'Identificador do visitante; validar se referencia legio.pessoa ou legio.membro antes de criar FK.';

COMMENT ON COLUMN legio.unidade_numeros.visitante_02_id IS
    'Identificador do visitante; validar se referencia legio.pessoa ou legio.membro antes de criar FK.';

-- O painel usa autenticacao propria em Node.js; restringe-se acesso
-- direto das roles de API. Configure GRANT/politicas se houver acesso direto.
ALTER TABLE legio.unidade_numeros ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE legio.unidade_numeros FROM anon, authenticated;

-- Prefere a competencia CONFIRMADA mais recente do ano anterior.
-- Na ausencia de confirmacoes, usa o rascunho mais recente.
-- Reaproveita os indicadores do ano anterior,
-- somente para unidades ativas, gerando janeiro como RASCUNHO.
-- Chamadas repetidas nao sobrescrevem registros ja existentes.
CREATE OR REPLACE FUNCTION legio.fn_iniciar_ano_numeros_unidade(p_ano INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_inseridos INTEGER := 0;
BEGIN
    IF p_ano IS NULL OR p_ano < 1901 OR p_ano > 2200 THEN
        RAISE EXCEPTION 'Ano invalido: %', p_ano;
    END IF;

    WITH ultimos AS (
        SELECT DISTINCT ON (n.unidade_id)
            n.*
        FROM legio.unidade_numeros n
        JOIN legio.unidade_legionaria u ON u.id = n.unidade_id
        WHERE n.ano = p_ano - 1
          AND u.ativo = TRUE
        ORDER BY n.unidade_id, (n.status = 'CONFIRMADO') DESC, n.mes DESC, n.id DESC
    )
    INSERT INTO legio.unidade_numeros (
        unidade_id, ano, mes,
            qtd_senatus,
            qtd_regiae,
            qtd_comitia,
            qtd_comitia_juv,
            qtd_curiae,
            qtd_curiae_juv,
            qtd_praesidia,
            qtd_praesidia_juv,
            qtd_velites,
            qtd_praticios,
            qtd_pretorianos,
            qtd_adjutores,
            qtd_ativos_com_promessa,
            qtd_ativos_sem_promessa,
            qtd_auxiliares_permanentes,
            qtd_auxiliares_provisorios,
            qtd_mescs,
            qtd_catequistas,
            qtd_coroinhas,
            qtd_praesidia_total,
            qtd_igrejas_com_legiao,
            qtd_igrejas_sem_legiao,
            numero_ultimo_ata,
            numero_ultimo_relotorio,
        data_ultima_visita,
        visitante_01_id,
        visitante_02_id,
        status, origem, copiado_de_id
    )
    SELECT
        ultimo.unidade_id, p_ano, 1,
            ultimo.qtd_senatus,
            ultimo.qtd_regiae,
            ultimo.qtd_comitia,
            ultimo.qtd_comitia_juv,
            ultimo.qtd_curiae,
            ultimo.qtd_curiae_juv,
            ultimo.qtd_praesidia,
            ultimo.qtd_praesidia_juv,
            ultimo.qtd_velites,
            ultimo.qtd_praticios,
            ultimo.qtd_pretorianos,
            ultimo.qtd_adjutores,
            ultimo.qtd_ativos_com_promessa,
            ultimo.qtd_ativos_sem_promessa,
            ultimo.qtd_auxiliares_permanentes,
            ultimo.qtd_auxiliares_provisorios,
            ultimo.qtd_mescs,
            ultimo.qtd_catequistas,
            ultimo.qtd_coroinhas,
            ultimo.qtd_praesidia_total,
            ultimo.qtd_igrejas_com_legiao,
            ultimo.qtd_igrejas_sem_legiao,
            ultimo.numero_ultimo_ata,
            ultimo.numero_ultimo_relotorio,
        ultimo.data_ultima_visita,
        ultimo.visitante_01_id,
        ultimo.visitante_02_id,
        'RASCUNHO', 'VIRADA_ANO', ultimo.id
    FROM ultimos ultimo
    ON CONFLICT ON CONSTRAINT uq_unidade_numeros_competencia DO NOTHING;

    GET DIAGNOSTICS v_inseridos = ROW_COUNT;
    RETURN v_inseridos;
END;
$$;

-- Nao permita execucao direta da rotina via roles de API / PUBLIC.
REVOKE ALL ON FUNCTION legio.fn_iniciar_ano_numeros_unidade(INTEGER) FROM PUBLIC;

-- Checagem da estrutura apos a instalacao:
-- SELECT * FROM legio.unidade_numeros ORDER BY ano DESC, mes DESC, unidade_id LIMIT 10;
-- SELECT id, nome FROM legio.unidade_legionaria ORDER BY nome LIMIT 10;

-- Observacao: criar a funcao NAO agenda a execucao anual.
-- Use o segundo arquivo, apos habilitar Supabase Cron.
