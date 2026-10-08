import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import {
  createHash,
  randomBytes,
  randomUUID
} from 'node:crypto';
import {
  QueryTypes,
  Transaction
} from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

type UsuarioLoginRow = {
  id: string;
  pessoa_id: string;
  email: string;
  senha_hash: string;
  status: string;
  tentativas_falhas: number;
  bloqueado_ate: Date | null;
};

type RefreshRow = {
  id: string;
  usuario_id: string;
  email: string;
};

type UsuarioMeRow = {
  usuario_id: string;
  usuario_email: string;
  usuario_status: string;
  pessoa_id: string;
  pessoa_nome: string;
  pessoa_nome_preferido: string | null;
  membro_id: string | null;
};

type UnidadePerfilRow = {
  unidade_id: string;
  unidade_nome: string;
  tipo_unidade: string;
  perfil_codigo: string;
  gestao_liberada: boolean;
};

const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new HttpError(
      500,
      'JWT_SECRET não configurado no servidor.'
    );
  }

  return secret;
}

function getAccessTokenSeconds(): number {
  const seconds = Number(
    process.env.JWT_ACCESS_EXPIRES_SECONDS ?? 900
  );

  return Number.isFinite(seconds) && seconds > 0
    ? seconds
    : 900;
}

function getRefreshTokenDays(): number {
  const days = Number(
    process.env.REFRESH_TOKEN_DAYS ?? 30
  );

  return Number.isFinite(days) && days > 0
    ? days
    : 30;
}

function criarAccessToken(
  usuarioId: string,
  email: string
): string {
  return jwt.sign(
    {
      sub: usuarioId,
      email
    },
    getJwtSecret(),
    {
      expiresIn: getAccessTokenSeconds()
    }
  );
}

function hashToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex');
}

async function registrarAcesso(
  usuarioId: string | null,
  email: string,
  sucesso: boolean,
  motivoFalha: string | null,
  ip?: string,
  userAgent?: string
): Promise<void> {

  await sequelize.query(
    `
      INSERT INTO legio.usuario_acesso
        (
          usuario_id,
          email_informado,
          sucesso,
          motivo_falha,
          ip,
          user_agent
        )
      VALUES
        (
          :usuarioId,
          :email,
          :sucesso,
          :motivoFalha,
          CAST(:ip AS inet),
          :userAgent
        )
    `,
    {
      replacements: {
        usuarioId,
        email,
        sucesso,
        motivoFalha,
        ip: ip ?? null,
        userAgent: userAgent ?? null
      }
    }
  );
}

async function criarRefreshToken(
  usuarioId: string,
  ip?: string,
  userAgent?: string,
  transaction?: Transaction
): Promise<string> {

  const rawToken = randomBytes(48)
    .toString('base64url');

  const tokenHash = hashToken(rawToken);
  const id = randomUUID();
  const days = getRefreshTokenDays();

  await sequelize.query(
    `
      INSERT INTO legio.usuario_refresh_token
        (
          id,
          usuario_id,
          token_hash,
          expira_em,
          ip,
          user_agent
        )
      VALUES
        (
          CAST(:id AS uuid),
          :usuarioId,
          :tokenHash,
          CURRENT_TIMESTAMP + (:days * INTERVAL '1 day'),
          CAST(:ip AS inet),
          :userAgent
        )
    `,
    {
      replacements: {
        id,
        usuarioId,
        tokenHash,
        days,
        ip: ip ?? null,
        userAgent: userAgent ?? null
      },
      transaction
    }
  );

  return rawToken;
}

export async function login(
  emailInformado: string,
  senha: string,
  ip?: string,
  userAgent?: string
) {
  const email = emailInformado
    .trim()
    .toLowerCase();

  if (!email || !senha) {
    throw new HttpError(
      400,
      'Informe o e-mail e a senha.'
    );
  }

  const usuarios = await sequelize.query<UsuarioLoginRow>(
    `
      SELECT
        id::text,
        pessoa_id::text,
        email,
        senha_hash,
        status,
        tentativas_falhas,
        bloqueado_ate
      FROM legio.usuario
      WHERE lower(email) = lower(:email)
      LIMIT 1
    `,
    {
      replacements: {
        email
      },
      type: QueryTypes.SELECT
    }
  );

  const usuario = usuarios[0];

  if (!usuario) {
    await registrarAcesso(
      null,
      email,
      false,
      'USUARIO_NAO_ENCONTRADO',
      ip,
      userAgent
    );

    throw new HttpError(
      401,
      'E-mail ou senha inválidos.'
    );
  }

  if (
    usuario.bloqueado_ate &&
    new Date(usuario.bloqueado_ate).getTime() > Date.now()
  ) {
    await registrarAcesso(
      usuario.id,
      email,
      false,
      'BLOQUEADO_TEMPORARIAMENTE',
      ip,
      userAgent
    );

    throw new HttpError(
      423,
      'Usuário temporariamente bloqueado. Tente novamente mais tarde.'
    );
  }

  if (usuario.status !== 'ATIVO') {
    await registrarAcesso(
      usuario.id,
      email,
      false,
      `STATUS_${usuario.status}`,
      ip,
      userAgent
    );

    if (usuario.status === 'PENDENTE_EMAIL') {
      throw new HttpError(
        403,
        'Confirme seu e-mail antes de entrar.'
      );
    }

    throw new HttpError(
      403,
      'Usuário sem acesso ao sistema.'
    );
  }

  const senhaValida = await argon2.verify(
    usuario.senha_hash,
    senha
  );

  if (!senhaValida) {
    await sequelize.query(
      `
        UPDATE legio.usuario
           SET tentativas_falhas =
                 CASE
                   WHEN tentativas_falhas + 1 >= :maxTentativas
                   THEN 0
                   ELSE tentativas_falhas + 1
                 END,
               bloqueado_ate =
                 CASE
                   WHEN tentativas_falhas + 1 >= :maxTentativas
                   THEN CURRENT_TIMESTAMP
                        + (:minutosBloqueio * INTERVAL '1 minute')
                   ELSE bloqueado_ate
                 END
         WHERE id = :usuarioId
      `,
      {
        replacements: {
          usuarioId: usuario.id,
          maxTentativas: MAX_TENTATIVAS,
          minutosBloqueio: MINUTOS_BLOQUEIO
        }
      }
    );

    await registrarAcesso(
      usuario.id,
      email,
      false,
      'SENHA_INVALIDA',
      ip,
      userAgent
    );

    throw new HttpError(
      401,
      'E-mail ou senha inválidos.'
    );
  }

  await sequelize.query(
    `
      UPDATE legio.usuario
         SET tentativas_falhas = 0,
             bloqueado_ate = NULL,
             ultimo_acesso_em = CURRENT_TIMESTAMP
       WHERE id = :usuarioId
    `,
    {
      replacements: {
        usuarioId: usuario.id
      }
    }
  );

  const accessToken = criarAccessToken(
    usuario.id,
    usuario.email
  );

  const refreshToken = await criarRefreshToken(
    usuario.id,
    ip,
    userAgent
  );

  await registrarAcesso(
    usuario.id,
    email,
    true,
    null,
    ip,
    userAgent
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: getAccessTokenSeconds()
  };
}

export async function refresh(
  rawToken: string,
  ip?: string,
  userAgent?: string
) {
  if (!rawToken) {
    throw new HttpError(
      401,
      'Sessão expirada ou inválida.'
    );
  }

  const tokenHash = hashToken(rawToken);

  const sessoes = await sequelize.query<RefreshRow>(
    `
      SELECT
        rt.id::text,
        rt.usuario_id::text,
        u.email
      FROM legio.usuario_refresh_token rt
      JOIN legio.usuario u
        ON u.id = rt.usuario_id
      WHERE rt.token_hash = :tokenHash
        AND rt.revogado_em IS NULL
        AND rt.expira_em > CURRENT_TIMESTAMP
        AND u.status = 'ATIVO'
      LIMIT 1
    `,
    {
      replacements: {
        tokenHash
      },
      type: QueryTypes.SELECT
    }
  );

  const sessao = sessoes[0];

  if (!sessao) {
    throw new HttpError(
      401,
      'Sessão expirada ou inválida.'
    );
  }

  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
        UPDATE legio.usuario_refresh_token
           SET revogado_em = CURRENT_TIMESTAMP
         WHERE id = CAST(:id AS uuid)
           AND revogado_em IS NULL
      `,
      {
        replacements: {
          id: sessao.id
        },
        transaction
      }
    );

    const novoRefreshToken = await criarRefreshToken(
      sessao.usuario_id,
      ip,
      userAgent,
      transaction
    );

    const accessToken = criarAccessToken(
      sessao.usuario_id,
      sessao.email
    );

    return {
      accessToken,
      refreshToken: novoRefreshToken,
      expiresIn: getAccessTokenSeconds()
    };
  });
}

export async function logout(
  rawToken?: string | null
): Promise<void> {

  if (!rawToken) {
    return;
  }

  await sequelize.query(
    `
      UPDATE legio.usuario_refresh_token
         SET revogado_em = CURRENT_TIMESTAMP
       WHERE token_hash = :tokenHash
         AND revogado_em IS NULL
    `,
    {
      replacements: {
        tokenHash: hashToken(rawToken)
      }
    }
  );
}

export async function me(
  usuarioId: string
) {
  const usuarios = await sequelize.query<UsuarioMeRow>(
    `
      SELECT
        u.id::text AS usuario_id,
        u.email AS usuario_email,
        u.status AS usuario_status,
        p.id::text AS pessoa_id,
        p.nome AS pessoa_nome,
        p.nome_preferido AS pessoa_nome_preferido,
        m.id::text AS membro_id
      FROM legio.usuario u
      JOIN legio.pessoa p
        ON p.id = u.pessoa_id
      LEFT JOIN legio.membro m
        ON m.pessoa_id = p.id
      WHERE u.id = :usuarioId
      LIMIT 1
    `,
    {
      replacements: {
        usuarioId
      },
      type: QueryTypes.SELECT
    }
  );

  const usuario = usuarios[0];

  if (!usuario) {
    throw new HttpError(
      404,
      'Usuário não encontrado.'
    );
  }

  const perfisGlobais = await sequelize.query<{ codigo: string }>(
    `
      SELECT pa.codigo
      FROM legio.usuario_perfil_global upg
      JOIN legio.perfil_acesso pa
        ON pa.id = upg.perfil_id
      WHERE upg.usuario_id = :usuarioId
        AND pa.ativo = TRUE
        AND pa.escopo = 'GLOBAL'
      ORDER BY pa.codigo
    `,
    {
      replacements: {
        usuarioId
      },
      type: QueryTypes.SELECT
    }
  );

  const unidadesRaw = await sequelize.query<UnidadePerfilRow>(
    `
      SELECT
        unidade_id::text,
        unidade_nome,
        tipo_unidade,
        perfil_codigo,
        gestao_liberada
      FROM legio.vw_usuario_unidade_perfil
      WHERE usuario_id = :usuarioId
        AND ativo = TRUE
      ORDER BY unidade_nome, perfil_codigo
    `,
    {
      replacements: {
        usuarioId
      },
      type: QueryTypes.SELECT
    }
  );

  const unidadesMap = new Map<
    string,
    {
      id: string;
      nome: string;
      tipo: string;
      gestaoLiberada: boolean;
      perfis: string[];
    }
  >();

  for (const item of unidadesRaw) {
    const atual = unidadesMap.get(item.unidade_id);

    if (atual) {
      atual.perfis.push(item.perfil_codigo);
      continue;
    }

    unidadesMap.set(
      item.unidade_id,
      {
        id: item.unidade_id,
        nome: item.unidade_nome,
        tipo: item.tipo_unidade,
        gestaoLiberada: item.gestao_liberada,
        perfis: [item.perfil_codigo]
      }
    );
  }

  return {
    usuario: {
      id: usuario.usuario_id,
      email: usuario.usuario_email,
      status: usuario.usuario_status
    },
    pessoa: {
      id: usuario.pessoa_id,
      nome: usuario.pessoa_nome,
      nomePreferido: usuario.pessoa_nome_preferido
    },
    membro: usuario.membro_id
      ? {
          id: usuario.membro_id
        }
      : null,
    perfisGlobais: perfisGlobais.map(
      (perfil) => perfil.codigo
    ),
    unidades: Array.from(
      unidadesMap.values()
    )
  };
}
