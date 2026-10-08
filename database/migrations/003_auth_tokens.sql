BEGIN;

CREATE TABLE IF NOT EXISTS legio.usuario_refresh_token (
    id              UUID PRIMARY KEY,
    usuario_id      BIGINT NOT NULL,
    token_hash      CHAR(64) NOT NULL UNIQUE,
    expira_em       TIMESTAMPTZ NOT NULL,
    revogado_em     TIMESTAMPTZ,
    ip              INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_refresh_usuario_ativo
    ON legio.usuario_refresh_token (usuario_id, expira_em)
    WHERE revogado_em IS NULL;


CREATE TABLE IF NOT EXISTS legio.usuario_token_acao (
    id              UUID PRIMARY KEY,
    usuario_id      BIGINT NOT NULL,
    tipo            VARCHAR(30) NOT NULL,
    token_hash      CHAR(64) NOT NULL UNIQUE,
    expira_em       TIMESTAMPTZ NOT NULL,
    usado_em        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_token_acao_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES legio.usuario(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_token_acao_tipo
        CHECK (
            tipo IN (
                'VERIFICAR_EMAIL',
                'RECUPERAR_SENHA'
            )
        )
);

CREATE INDEX IF NOT EXISTS ix_token_acao_usuario_tipo
    ON legio.usuario_token_acao
       (usuario_id, tipo, expira_em);

COMMIT;
