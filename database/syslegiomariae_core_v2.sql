-- ============================================================
-- SysLegioMariae - Estrutura base V2
-- PostgreSQL
--
-- Estratégia:
--   1) NÃO altera nem exclui as tabelas antigas do schema public.
--   2) Cria a nova modelagem no schema legio.
--   3) Permite migrar os dados legados gradualmente.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS legio;

-- ============================================================
-- FUNÇÃO PADRÃO DE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION legio.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================
-- PESSOA
-- Dados civis e de contato. Não guardar senha, SMTP, banco etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.pessoa (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome                VARCHAR(180) NOT NULL,
    nome_preferido      VARCHAR(180),
    data_nascimento     DATE,

    tipo_documento      VARCHAR(30),
    documento           VARCHAR(50),
    pais_documento      CHAR(2),
    cpf                 VARCHAR(14),
    rg                  VARCHAR(30),
    orgao_expeditor     VARCHAR(30),

    email               VARCHAR(254),
    celular             VARCHAR(30),
    telefone            VARCHAR(30),

    cep                 VARCHAR(20),
    logradouro          VARCHAR(200),
    numero_logradouro   VARCHAR(30),
    complemento         VARCHAR(150),
    bairro              VARCHAR(120),
    cidade              VARCHAR(120),
    estado_regiao       VARCHAR(120),
    pais_codigo         CHAR(2) NOT NULL DEFAULT 'BR',

    observacao          TEXT,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pessoa_cpf
    ON legio.pessoa ((regexp_replace(cpf, '[^0-9]', '', 'g')))
    WHERE cpf IS NOT NULL
      AND btrim(cpf) <> '';

CREATE INDEX IF NOT EXISTS ix_pessoa_nome
    ON legio.pessoa (nome);

DROP TRIGGER IF EXISTS trg_pessoa_updated_at ON legio.pessoa;
CREATE TRIGGER trg_pessoa_updated_at
BEFORE UPDATE ON legio.pessoa
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- MEMBRO
-- Dados especificamente legionários.
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.membro (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id           BIGINT NOT NULL UNIQUE,

    dt_recrutamento     DATE,
    dt_ingresso         DATE,
    dt_compromisso      DATE,

    formacao_escolar    VARCHAR(80),
    aposentado          BOOLEAN NOT NULL DEFAULT FALSE,

    pretoriano          BOOLEAN NOT NULL DEFAULT FALSE,
    adjutor             BOOLEAN NOT NULL DEFAULT FALSE,
    mesc                BOOLEAN NOT NULL DEFAULT FALSE,
    catequista          BOOLEAN NOT NULL DEFAULT FALSE,
    coroinha            BOOLEAN NOT NULL DEFAULT FALSE,

    status              VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    observacao          TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_membro_pessoa
        FOREIGN KEY (pessoa_id)
        REFERENCES legio.pessoa(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_membro_status
        CHECK (status IN ('ATIVO', 'INATIVO', 'FALECIDO'))
);

DROP TRIGGER IF EXISTS trg_membro_updated_at ON legio.membro;
CREATE TRIGGER trg_membro_updated_at
BEFORE UPDATE ON legio.membro
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- USUÁRIO
-- Uma conta web vinculada à pessoa.
-- senha_hash deve conter SOMENTE hash produzido pelo backend
-- (Argon2id/bcrypt/scrypt), nunca senha em texto puro.
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.usuario (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id               BIGINT NOT NULL UNIQUE,

    email                   VARCHAR(254) NOT NULL,
    senha_hash              VARCHAR(255) NOT NULL,

    status                  VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_EMAIL',
    email_verificado_em     TIMESTAMPTZ,
    ultimo_acesso_em        TIMESTAMPTZ,
    tentativas_falhas       INTEGER NOT NULL DEFAULT 0,
    bloqueado_ate           TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuario_pessoa
        FOREIGN KEY (pessoa_id)
        REFERENCES legio.pessoa(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_usuario_status
        CHECK (status IN (
            'PENDENTE_EMAIL',
            'ATIVO',
            'BLOQUEADO',
            'INATIVO'
        ))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_email
    ON legio.usuario (lower(email));

DROP TRIGGER IF EXISTS trg_usuario_updated_at ON legio.usuario;
CREATE TRIGGER trg_usuario_updated_at
BEFORE UPDATE ON legio.usuario
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- PERFIS DE ACESSO
-- GLOBAL  = empresa operadora do SysLegioMariae
-- UNIDADE = acesso dentro de uma unidade legionária
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.perfil_acesso (
    id              SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          VARCHAR(40) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    escopo          VARCHAR(10) NOT NULL,
    descricao       TEXT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_perfil_escopo
        CHECK (escopo IN ('GLOBAL', 'UNIDADE'))
);

INSERT INTO legio.perfil_acesso (codigo, nome, escopo, descricao)
VALUES
    ('PLATFORM_OWNER',      'Proprietário da plataforma',       'GLOBAL',  'Controle máximo do SysLegioMariae.'),
    ('PLATFORM_ADMIN',      'Administrador da plataforma',      'GLOBAL',  'Administração global de unidades, usuários e configurações.'),
    ('PLATFORM_FINANCEIRO', 'Financeiro da plataforma',         'GLOBAL',  'Planos, assinaturas, cobranças e pagamentos.'),
    ('PLATFORM_SUPORTE',    'Suporte da plataforma',            'GLOBAL',  'Atendimento e suporte operacional.'),

    ('MEMBRO',              'Membro',                            'UNIDADE', 'Acesso básico e aos próprios dados.'),
    ('CONSULTA',            'Consulta',                          'UNIDADE', 'Consulta informações autorizadas da unidade.'),
    ('OPERADOR',            'Operador',                          'UNIDADE', 'Opera cadastros e rotinas autorizadas da unidade.'),
    ('ADMIN_UNIDADE',       'Administrador da unidade',         'UNIDADE', 'Administra membros, oficiais, operadores e dados da unidade.')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- TIPOS DE UNIDADE LEGIONÁRIA
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.tipo_unidade (
    id                  SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    nome                VARCHAR(80) NOT NULL,
    estrutura           VARCHAR(20) NOT NULL DEFAULT 'HIERARQUICA',
    ordem_hierarquica   SMALLINT,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT ck_tipo_unidade_estrutura
        CHECK (estrutura IN ('HIERARQUICA', 'ESPECIAL'))
);

INSERT INTO legio.tipo_unidade
    (codigo, nome, estrutura, ordem_hierarquica)
VALUES
    ('PATRICIOS',  'Patrícios',   'ESPECIAL',    0),
    ('VELITE',     'Velite',      'ESPECIAL',    0),
    ('PRAESIDIUM', 'Praesidium',  'HIERARQUICA', 1),
    ('CURIA',      'Curia',       'HIERARQUICA', 2),
    ('COMITIUM',   'Comitium',    'HIERARQUICA', 3),
    ('REGIA',      'Regia',       'HIERARQUICA', 4),
    ('SENATUS',    'Senatus',     'HIERARQUICA', 5),
    ('CONCILIUM',  'Concilium',   'HIERARQUICA', 6)
ON CONFLICT (codigo) DO NOTHING;

-- Pares válidos filho -> superior.
CREATE TABLE IF NOT EXISTS legio.tipo_unidade_hierarquia (
    tipo_filho_id   SMALLINT NOT NULL,
    tipo_pai_id     SMALLINT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (tipo_filho_id, tipo_pai_id),

    CONSTRAINT fk_tipo_hierarquia_filho
        FOREIGN KEY (tipo_filho_id)
        REFERENCES legio.tipo_unidade(id),

    CONSTRAINT fk_tipo_hierarquia_pai
        FOREIGN KEY (tipo_pai_id)
        REFERENCES legio.tipo_unidade(id),

    CONSTRAINT ck_tipo_hierarquia_diferente
        CHECK (tipo_filho_id <> tipo_pai_id)
);

INSERT INTO legio.tipo_unidade_hierarquia
    (tipo_filho_id, tipo_pai_id)
SELECT filho.id, pai.id
FROM (
    VALUES
        ('PATRICIOS',  'PRAESIDIUM'),

        ('VELITE',     'PRAESIDIUM'),
        ('VELITE',     'CURIA'),
        ('VELITE',     'COMITIUM'),
        ('VELITE',     'REGIA'),
        ('VELITE',     'SENATUS'),
        ('VELITE',     'CONCILIUM'),

        ('PRAESIDIUM', 'CURIA'),
        ('PRAESIDIUM', 'COMITIUM'),
        ('PRAESIDIUM', 'REGIA'),
        ('PRAESIDIUM', 'SENATUS'),
        ('PRAESIDIUM', 'CONCILIUM'),

        ('CURIA',      'COMITIUM'),
        ('CURIA',      'REGIA'),
        ('CURIA',      'SENATUS'),
        ('CURIA',      'CONCILIUM'),

        ('COMITIUM',   'REGIA'),
        ('COMITIUM',   'SENATUS'),
        ('COMITIUM',   'CONCILIUM'),

        ('REGIA',      'SENATUS'),
        ('REGIA',      'CONCILIUM'),

        ('SENATUS',    'CONCILIUM')
) AS regra(filho_codigo, pai_codigo)
JOIN legio.tipo_unidade filho
  ON filho.codigo = regra.filho_codigo
JOIN legio.tipo_unidade pai
  ON pai.codigo = regra.pai_codigo
ON CONFLICT DO NOTHING;

-- ============================================================
-- UNIDADE LEGIONÁRIA
-- Substitui conceitualmente a antiga tabela conselho.
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.unidade_legionaria (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_unidade_id         SMALLINT NOT NULL,
    unidade_superior_id     BIGINT,

    nome                    VARCHAR(180) NOT NULL,
    nome_reduzido           VARCHAR(120),

    email                   VARCHAR(254),
    celular                 VARCHAR(30),
    telefone                VARCHAR(30),
    site                    VARCHAR(255),

    cep                     VARCHAR(20),
    logradouro              VARCHAR(200),
    numero_logradouro       VARCHAR(30),
    complemento             VARCHAR(150),
    bairro                  VARCHAR(120),
    cidade                  VARCHAR(120),
    estado_regiao           VARCHAR(120),
    pais_codigo             CHAR(2) NOT NULL DEFAULT 'BR',

    data_constituicao       DATE,

    dia_semana_reuniao      SMALLINT,
    horario_inicio_reuniao  TIME,
    horario_fim_reuniao     TIME,
    fuso_horario            VARCHAR(80),

    status_aprovacao        VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,

    criado_por_usuario_id   BIGINT,
    aprovado_por_usuario_id BIGINT,
    aprovado_em             TIMESTAMPTZ,
    motivo_status           TEXT,
    observacao              TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_unidade_tipo
        FOREIGN KEY (tipo_unidade_id)
        REFERENCES legio.tipo_unidade(id),

    CONSTRAINT fk_unidade_superior
        FOREIGN KEY (unidade_superior_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_unidade_criador
        FOREIGN KEY (criado_por_usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_unidade_aprovador
        FOREIGN KEY (aprovado_por_usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_unidade_status_aprovacao
        CHECK (status_aprovacao IN (
            'PENDENTE',
            'APROVADA',
            'REJEITADA',
            'BLOQUEADA'
        )),

    CONSTRAINT ck_unidade_dia_semana
        CHECK (
            dia_semana_reuniao IS NULL
            OR dia_semana_reuniao BETWEEN 0 AND 6
        )
);

CREATE INDEX IF NOT EXISTS ix_unidade_superior
    ON legio.unidade_legionaria (unidade_superior_id);

CREATE INDEX IF NOT EXISTS ix_unidade_tipo
    ON legio.unidade_legionaria (tipo_unidade_id);

CREATE INDEX IF NOT EXISTS ix_unidade_nome
    ON legio.unidade_legionaria (nome);

CREATE INDEX IF NOT EXISTS ix_unidade_status_aprovacao
    ON legio.unidade_legionaria (status_aprovacao);

DROP TRIGGER IF EXISTS trg_unidade_updated_at ON legio.unidade_legionaria;
CREATE TRIGGER trg_unidade_updated_at
BEFORE UPDATE ON legio.unidade_legionaria
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- Validação de hierarquia e prevenção de ciclos.
CREATE OR REPLACE FUNCTION legio.fn_validar_hierarquia_unidade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_codigo_tipo VARCHAR(30);
    v_tipo_pai_id SMALLINT;
    v_tem_ciclo   BOOLEAN;
BEGIN
    SELECT codigo
      INTO v_codigo_tipo
      FROM legio.tipo_unidade
     WHERE id = NEW.tipo_unidade_id;

    IF v_codigo_tipo = 'CONCILIUM' THEN
        IF NEW.unidade_superior_id IS NOT NULL THEN
            RAISE EXCEPTION 'CONCILIUM não pode possuir unidade superior.';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.unidade_superior_id IS NULL THEN
        RAISE EXCEPTION '% deve possuir unidade superior.', v_codigo_tipo;
    END IF;

    IF NEW.id IS NOT NULL AND NEW.unidade_superior_id = NEW.id THEN
        RAISE EXCEPTION 'Uma unidade não pode ser superior de si própria.';
    END IF;

    SELECT tipo_unidade_id
      INTO v_tipo_pai_id
      FROM legio.unidade_legionaria
     WHERE id = NEW.unidade_superior_id;

    IF v_tipo_pai_id IS NULL THEN
        RAISE EXCEPTION 'Unidade superior % não encontrada.', NEW.unidade_superior_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM legio.tipo_unidade_hierarquia h
         WHERE h.tipo_filho_id = NEW.tipo_unidade_id
           AND h.tipo_pai_id = v_tipo_pai_id
           AND h.ativo = TRUE
    ) THEN
        RAISE EXCEPTION 'Relação hierárquica não permitida entre os tipos informados.';
    END IF;

    IF NEW.id IS NOT NULL THEN
        WITH RECURSIVE cadeia AS (
            SELECT u.id, u.unidade_superior_id
              FROM legio.unidade_legionaria u
             WHERE u.id = NEW.unidade_superior_id

            UNION ALL

            SELECT u.id, u.unidade_superior_id
              FROM legio.unidade_legionaria u
              JOIN cadeia c
                ON u.id = c.unidade_superior_id
        )
        SELECT EXISTS (
            SELECT 1
              FROM cadeia
             WHERE id = NEW.id
        )
        INTO v_tem_ciclo;

        IF v_tem_ciclo THEN
            RAISE EXCEPTION 'A alteração criaria um ciclo na hierarquia de unidades.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_hierarquia_unidade
    ON legio.unidade_legionaria;

CREATE TRIGGER trg_validar_hierarquia_unidade
BEFORE INSERT OR UPDATE OF tipo_unidade_id, unidade_superior_id
ON legio.unidade_legionaria
FOR EACH ROW
EXECUTE FUNCTION legio.fn_validar_hierarquia_unidade();

-- ============================================================
-- CATEGORIAS DE MEMBRO
-- Separa categoria de membro de cargo de oficial.
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.categoria_membro (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      VARCHAR(40) NOT NULL UNIQUE,
    nome        VARCHAR(100) NOT NULL,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO legio.categoria_membro (codigo, nome)
VALUES
    ('ATIVO_COM_PROMESSA',      'Membro ativo com promessa'),
    ('ATIVO_SEM_PROMESSA',      'Membro ativo sem promessa'),
    ('AUXILIAR_PERMANENTE',     'Membro auxiliar permanente'),
    ('AUXILIAR_PROVISORIO',     'Membro auxiliar provisório'),
    ('PATRICIO',                'Membro patrício')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- VÍNCULO MEMBRO x UNIDADE
-- Permite o mesmo membro estar ligado a mais de uma unidade.
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.membro_unidade (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    membro_id           BIGINT NOT NULL,
    unidade_id          BIGINT NOT NULL,
    categoria_membro_id SMALLINT,

    principal           BOOLEAN NOT NULL DEFAULT FALSE,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,

    data_inicio         DATE,
    data_fim            DATE,
    observacao          TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_membro_unidade_membro
        FOREIGN KEY (membro_id)
        REFERENCES legio.membro(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_membro_unidade_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_membro_unidade_categoria
        FOREIGN KEY (categoria_membro_id)
        REFERENCES legio.categoria_membro(id),

    CONSTRAINT ck_membro_unidade_datas
        CHECK (
            data_fim IS NULL
            OR data_inicio IS NULL
            OR data_fim >= data_inicio
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_membro_unidade_ativo
    ON legio.membro_unidade (membro_id, unidade_id)
    WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS ix_membro_unidade_unidade
    ON legio.membro_unidade (unidade_id, ativo);

DROP TRIGGER IF EXISTS trg_membro_unidade_updated_at ON legio.membro_unidade;
CREATE TRIGGER trg_membro_unidade_updated_at
BEFORE UPDATE ON legio.membro_unidade
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- CARGOS LEGIONÁRIOS / OFICIAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.cargo_legionario (
    id              SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          VARCHAR(40) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    eh_oficial      BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao  SMALLINT,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO legio.cargo_legionario
    (codigo, nome, eh_oficial, ordem_exibicao)
VALUES
    ('DIRETOR_ESPIRITUAL',     'Diretor Espiritual',        TRUE, 1),
    ('PRESIDENTE',             'Presidente',                TRUE, 2),
    ('VICE_PRESIDENTE',        'Vice-Presidente',           TRUE, 3),
    ('SECRETARIO',             'Secretário',                TRUE, 4),
    ('TESOUREIRO',             'Tesoureiro',                TRUE, 5),
    ('ASSISTENTE_SECRETARIO',  'Assistente de Secretário',  TRUE, 6),
    ('ASSISTENTE_TESOUREIRO',  'Assistente de Tesoureiro',  TRUE, 7)
ON CONFLICT (codigo) DO NOTHING;

-- Substitui conceitualmente a antiga tabela oficial.
CREATE TABLE IF NOT EXISTS legio.membro_cargo_unidade (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    membro_id           BIGINT NOT NULL,
    unidade_id          BIGINT NOT NULL,
    cargo_id            SMALLINT NOT NULL,

    numero_mandato      SMALLINT,
    data_inicio         DATE NOT NULL,
    data_fim            DATE,
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    observacao          TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_membro_cargo_membro
        FOREIGN KEY (membro_id)
        REFERENCES legio.membro(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_membro_cargo_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_membro_cargo_cargo
        FOREIGN KEY (cargo_id)
        REFERENCES legio.cargo_legionario(id),

    CONSTRAINT ck_membro_cargo_datas
        CHECK (data_fim IS NULL OR data_fim >= data_inicio),

    CONSTRAINT ck_membro_cargo_mandato
        CHECK (numero_mandato IS NULL OR numero_mandato > 0)
);

CREATE INDEX IF NOT EXISTS ix_membro_cargo_unidade
    ON legio.membro_cargo_unidade (unidade_id, ativo);

CREATE INDEX IF NOT EXISTS ix_membro_cargo_membro
    ON legio.membro_cargo_unidade (membro_id, ativo);

DROP TRIGGER IF EXISTS trg_membro_cargo_updated_at ON legio.membro_cargo_unidade;
CREATE TRIGGER trg_membro_cargo_updated_at
BEFORE UPDATE ON legio.membro_cargo_unidade
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- PERFIS GLOBAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.usuario_perfil_global (
    usuario_id      BIGINT NOT NULL,
    perfil_id       SMALLINT NOT NULL,
    concedido_por   BIGINT,
    concedido_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (usuario_id, perfil_id),

    CONSTRAINT fk_usuario_perfil_global_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_perfil_global_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES legio.perfil_acesso(id),

    CONSTRAINT fk_usuario_perfil_global_concedido_por
        FOREIGN KEY (concedido_por)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION legio.fn_validar_perfil_global()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM legio.perfil_acesso p
         WHERE p.id = NEW.perfil_id
           AND p.escopo = 'GLOBAL'
           AND p.ativo = TRUE
    ) THEN
        RAISE EXCEPTION 'O perfil informado não é um perfil global ativo.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_perfil_global
    ON legio.usuario_perfil_global;

CREATE TRIGGER trg_validar_perfil_global
BEFORE INSERT OR UPDATE OF perfil_id
ON legio.usuario_perfil_global
FOR EACH ROW
EXECUTE FUNCTION legio.fn_validar_perfil_global();

-- ============================================================
-- PERFIS POR UNIDADE
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.usuario_unidade_perfil (
    usuario_id      BIGINT NOT NULL,
    unidade_id      BIGINT NOT NULL,
    perfil_id       SMALLINT NOT NULL,

    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    concedido_por   BIGINT,
    concedido_em    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revogado_em     TIMESTAMPTZ,
    observacao      TEXT,

    PRIMARY KEY (usuario_id, unidade_id, perfil_id),

    CONSTRAINT fk_usuario_unidade_perfil_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_unidade_perfil_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_unidade_perfil_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES legio.perfil_acesso(id),

    CONSTRAINT fk_usuario_unidade_perfil_concedido_por
        FOREIGN KEY (concedido_por)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_usuario_unidade_perfil_unidade
    ON legio.usuario_unidade_perfil (unidade_id, ativo);

CREATE OR REPLACE FUNCTION legio.fn_validar_perfil_unidade()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM legio.perfil_acesso p
         WHERE p.id = NEW.perfil_id
           AND p.escopo = 'UNIDADE'
           AND p.ativo = TRUE
    ) THEN
        RAISE EXCEPTION 'O perfil informado não é um perfil de unidade ativo.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_perfil_unidade
    ON legio.usuario_unidade_perfil;

CREATE TRIGGER trg_validar_perfil_unidade
BEFORE INSERT OR UPDATE OF perfil_id
ON legio.usuario_unidade_perfil
FOR EACH ROW
EXECUTE FUNCTION legio.fn_validar_perfil_unidade();

-- ============================================================
-- SOLICITAÇÃO DE CADASTRO/APROVAÇÃO DE UNIDADE
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.solicitacao_unidade (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unidade_id              BIGINT NOT NULL,
    solicitante_usuario_id  BIGINT NOT NULL,

    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    justificativa           TEXT,
    resposta                TEXT,

    analisado_por_usuario_id BIGINT,
    solicitado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    analisado_em            TIMESTAMPTZ,

    CONSTRAINT fk_solicitacao_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_solicitacao_unidade_solicitante
        FOREIGN KEY (solicitante_usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_solicitacao_unidade_analisador
        FOREIGN KEY (analisado_por_usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_solicitacao_unidade_status
        CHECK (status IN (
            'PENDENTE',
            'APROVADA',
            'REJEITADA',
            'CANCELADA'
        ))
);

CREATE INDEX IF NOT EXISTS ix_solicitacao_unidade_status
    ON legio.solicitacao_unidade (status, solicitado_em);

-- ============================================================
-- SOLICITAÇÃO DE ACESSO ADMINISTRATIVO À UNIDADE
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.solicitacao_acesso_unidade (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id              BIGINT NOT NULL,
    unidade_id              BIGINT NOT NULL,
    perfil_id               SMALLINT NOT NULL,

    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    justificativa           TEXT,
    resposta                TEXT,

    analisado_por_usuario_id BIGINT,
    solicitado_em           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    analisado_em            TIMESTAMPTZ,

    CONSTRAINT fk_solicitacao_acesso_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_solicitacao_acesso_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_solicitacao_acesso_perfil
        FOREIGN KEY (perfil_id)
        REFERENCES legio.perfil_acesso(id),

    CONSTRAINT fk_solicitacao_acesso_analisador
        FOREIGN KEY (analisado_por_usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_solicitacao_acesso_status
        CHECK (status IN (
            'PENDENTE',
            'APROVADA',
            'REJEITADA',
            'CANCELADA'
        ))
);

CREATE INDEX IF NOT EXISTS ix_solicitacao_acesso_pendente
    ON legio.solicitacao_acesso_unidade (status, solicitado_em);

-- ============================================================
-- PLANOS E ASSINATURAS
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.plano_assinatura (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              VARCHAR(50) NOT NULL UNIQUE,
    nome                VARCHAR(120) NOT NULL,

    valor               NUMERIC(12,2) NOT NULL DEFAULT 0,
    moeda               CHAR(3) NOT NULL DEFAULT 'BRL',
    periodicidade_meses SMALLINT NOT NULL DEFAULT 1,
    dias_tolerancia     SMALLINT NOT NULL DEFAULT 5,

    limite_operadores   INTEGER,
    limite_membros      INTEGER,

    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    observacao          TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_plano_valor
        CHECK (valor >= 0),

    CONSTRAINT ck_plano_periodicidade
        CHECK (periodicidade_meses > 0),

    CONSTRAINT ck_plano_tolerancia
        CHECK (dias_tolerancia >= 0)
);

DROP TRIGGER IF EXISTS trg_plano_updated_at ON legio.plano_assinatura;
CREATE TRIGGER trg_plano_updated_at
BEFORE UPDATE ON legio.plano_assinatura
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS legio.assinatura_unidade (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    unidade_id              BIGINT NOT NULL,
    plano_id                BIGINT,

    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',

    inicio_em               DATE,
    fim_em                  DATE,
    proximo_vencimento      DATE,
    tolerancia_ate          DATE,

    valor_contratado        NUMERIC(12,2),
    moeda                   CHAR(3) NOT NULL DEFAULT 'BRL',

    cobre_subordinadas      BOOLEAN NOT NULL DEFAULT FALSE,
    renovacao_automatica    BOOLEAN NOT NULL DEFAULT FALSE,

    observacao              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_assinatura_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_assinatura_plano
        FOREIGN KEY (plano_id)
        REFERENCES legio.plano_assinatura(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_assinatura_status
        CHECK (status IN (
            'PENDENTE',
            'ATIVA',
            'ATRASADA',
            'SUSPENSA',
            'CANCELADA',
            'ISENTA'
        )),

    CONSTRAINT ck_assinatura_valor
        CHECK (valor_contratado IS NULL OR valor_contratado >= 0),

    CONSTRAINT ck_assinatura_datas
        CHECK (fim_em IS NULL OR inicio_em IS NULL OR fim_em >= inicio_em)
);

CREATE INDEX IF NOT EXISTS ix_assinatura_unidade
    ON legio.assinatura_unidade (unidade_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_assinatura_corrente_unidade
    ON legio.assinatura_unidade (unidade_id)
    WHERE status IN ('PENDENTE', 'ATIVA', 'ATRASADA', 'ISENTA');

DROP TRIGGER IF EXISTS trg_assinatura_updated_at ON legio.assinatura_unidade;
CREATE TRIGGER trg_assinatura_updated_at
BEFORE UPDATE ON legio.assinatura_unidade
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

CREATE TABLE IF NOT EXISTS legio.pagamento_assinatura (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assinatura_id           BIGINT NOT NULL,

    competencia_inicio      DATE,
    competencia_fim         DATE,
    vencimento              DATE NOT NULL,
    pago_em                 TIMESTAMPTZ,

    valor                   NUMERIC(12,2) NOT NULL,
    moeda                   CHAR(3) NOT NULL DEFAULT 'BRL',

    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    forma_pagamento         VARCHAR(30),

    provedor_pagamento      VARCHAR(60),
    id_transacao_externa    VARCHAR(150),

    observacao              TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pagamento_assinatura
        FOREIGN KEY (assinatura_id)
        REFERENCES legio.assinatura_unidade(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_pagamento_status
        CHECK (status IN (
            'PENDENTE',
            'PAGO',
            'ATRASADO',
            'CANCELADO',
            'ESTORNADO'
        )),

    CONSTRAINT ck_pagamento_valor
        CHECK (valor >= 0),

    CONSTRAINT ck_pagamento_competencia
        CHECK (
            competencia_fim IS NULL
            OR competencia_inicio IS NULL
            OR competencia_fim >= competencia_inicio
        )
);

CREATE INDEX IF NOT EXISTS ix_pagamento_assinatura_vencimento
    ON legio.pagamento_assinatura (assinatura_id, vencimento, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pagamento_transacao_externa
    ON legio.pagamento_assinatura (provedor_pagamento, id_transacao_externa)
    WHERE id_transacao_externa IS NOT NULL;

DROP TRIGGER IF EXISTS trg_pagamento_updated_at ON legio.pagamento_assinatura;
CREATE TRIGGER trg_pagamento_updated_at
BEFORE UPDATE ON legio.pagamento_assinatura
FOR EACH ROW
EXECUTE FUNCTION legio.fn_set_updated_at();

-- ============================================================
-- REGRA CENTRAL: UNIDADE LIBERADA PARA GESTÃO?
-- ============================================================

CREATE OR REPLACE FUNCTION legio.fn_unidade_gestao_liberada(
    p_unidade_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT
        EXISTS (
            SELECT 1
              FROM legio.unidade_legionaria u
             WHERE u.id = p_unidade_id
               AND u.ativo = TRUE
               AND u.status_aprovacao = 'APROVADA'
        )
        AND
        EXISTS (
            SELECT 1
              FROM legio.assinatura_unidade a
             WHERE a.unidade_id = p_unidade_id
               AND (
                    a.status = 'ISENTA'
                    OR (
                        a.status = 'ATIVA'
                        AND (a.fim_em IS NULL OR a.fim_em >= CURRENT_DATE)
                    )
                    OR (
                        a.status = 'ATRASADA'
                        AND a.tolerancia_ate IS NOT NULL
                        AND a.tolerancia_ate >= CURRENT_DATE
                    )
               )
        );
$$;

-- ============================================================
-- AUDITORIA
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.auditoria_evento (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT,
    unidade_id      BIGINT,

    acao            VARCHAR(60) NOT NULL,
    entidade        VARCHAR(80),
    entidade_id     VARCHAR(80),

    dados_antes     JSONB,
    dados_depois    JSONB,

    ip              INET,
    user_agent      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_auditoria_unidade
        FOREIGN KEY (unidade_id)
        REFERENCES legio.unidade_legionaria(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_auditoria_usuario_data
    ON legio.auditoria_evento (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_auditoria_unidade_data
    ON legio.auditoria_evento (unidade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_auditoria_entidade
    ON legio.auditoria_evento (entidade, entidade_id);

-- ============================================================
-- LOG DE ACESSO
-- ============================================================

CREATE TABLE IF NOT EXISTS legio.usuario_acesso (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT,

    email_informado VARCHAR(254),
    sucesso         BOOLEAN NOT NULL,
    motivo_falha    VARCHAR(120),

    ip              INET,
    user_agent      TEXT,
    data_acesso     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuario_acesso_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_usuario_acesso_usuario_data
    ON legio.usuario_acesso (usuario_id, data_acesso DESC);

CREATE INDEX IF NOT EXISTS ix_usuario_acesso_email_data
    ON legio.usuario_acesso (lower(email_informado), data_acesso DESC);

-- ============================================================
-- VIEW ÚTIL PARA O BACKEND
-- Contexto de perfil por unidade.
-- ============================================================

CREATE OR REPLACE VIEW legio.vw_usuario_unidade_perfil AS
SELECT
    uup.usuario_id,
    u.email AS usuario_email,
    uup.unidade_id,
    ul.nome AS unidade_nome,
    tu.codigo AS tipo_unidade,
    pa.codigo AS perfil_codigo,
    pa.nome AS perfil_nome,
    uup.ativo,
    legio.fn_unidade_gestao_liberada(uup.unidade_id) AS gestao_liberada
FROM legio.usuario_unidade_perfil uup
JOIN legio.usuario u
  ON u.id = uup.usuario_id
JOIN legio.unidade_legionaria ul
  ON ul.id = uup.unidade_id
JOIN legio.tipo_unidade tu
  ON tu.id = ul.tipo_unidade_id
JOIN legio.perfil_acesso pa
  ON pa.id = uup.perfil_id;

COMMIT;

-- ============================================================
-- EXEMPLOS DE USO (NÃO EXECUTADOS AUTOMATICAMENTE)
-- ============================================================

-- 1) Depois de criar seu usuário proprietário, conceder PLATFORM_OWNER:
--
-- INSERT INTO legio.usuario_perfil_global (usuario_id, perfil_id)
-- SELECT 1, id
--   FROM legio.perfil_acesso
--  WHERE codigo = 'PLATFORM_OWNER';

-- 2) Liberar um administrador para uma unidade:
--
-- INSERT INTO legio.usuario_unidade_perfil
--     (usuario_id, unidade_id, perfil_id, concedido_por)
-- SELECT
--     10,
--     25,
--     p.id,
--     1
-- FROM legio.perfil_acesso p
-- WHERE p.codigo = 'ADMIN_UNIDADE';

-- 3) Consultar se uma unidade pode realizar gestão:
--
-- SELECT legio.fn_unidade_gestao_liberada(25);

-- 4) Consultar árvore direta:
--
-- SELECT
--     filho.id,
--     filho.nome,
--     tf.codigo AS tipo,
--     pai.id AS superior_id,
--     pai.nome AS superior
-- FROM legio.unidade_legionaria filho
-- JOIN legio.tipo_unidade tf
--   ON tf.id = filho.tipo_unidade_id
-- LEFT JOIN legio.unidade_legionaria pai
--   ON pai.id = filho.unidade_superior_id
-- ORDER BY filho.nome;
