import argon2 from 'argon2';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

type PerfilGlobalRow = {
  escopo: string;
};

type PessoaExistenteRow = {
  id: string;
};

type UsuarioExistenteRow = {
  id: string;
};

export type CriarUsuarioInput = {
  nome: string;
  email: string;
  senha: string;
  nomePreferido?: string | null;
  cpf?: string | null;
  celular?: string | null;
  perfilCodigo?: string | null;
};

export type UsuarioCriado = {
  usuario: {
    id: string;
    email: string;
    status: string;
  };
  pessoa: {
    id: string;
    nome: string;
    nomePreferido: string | null;
  };
  perfisGlobais: string[];
};

const PERFIL_PADRAO = 'PLATFORM_ADMIN';
const STATUS_INICIAL = 'ATIVO';
const SENHA_MINIMA = 6;

function normalizarEmail(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

function normalizarTextoOpcional(
  valor: unknown
): string | null {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : texto;
}

function validarPayload(input: CriarUsuarioInput) {
  const nome = String(input.nome ?? '').trim();
  const email = normalizarEmail(input.email);
  const senha = String(input.senha ?? '');

  if (!nome) {
    throw new HttpError(400, 'Informe o nome completo.');
  }

  if (!email) {
    throw new HttpError(400, 'Informe o e-mail.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Informe um e-mail válido.');
  }

  if (senha.length < SENHA_MINIMA) {
    throw new HttpError(
      400,
      `A senha deve possuir pelo menos ${SENHA_MINIMA} caracteres.`
    );
  }

  return {
    nome,
    email,
    senha
  };
}

async function resolverPerfil(
  perfilCodigo: string
): Promise<{ id: number; codigo: string }> {

  const perfis = await sequelize.query<{
    id: number;
    codigo: string;
  }>(
    `
      SELECT
        id,
        codigo
      FROM legio.perfil_acesso
      WHERE codigo = :codigo
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: {
        codigo: perfilCodigo
      },
      type: QueryTypes.SELECT
    }
  );

  const perfil = perfis[0];

  if (!perfil) {
    throw new HttpError(
      400,
      `Perfil de acesso não encontrado ou inativo: ${perfilCodigo}.`
    );
  }

  return perfil;
}

async function garantirPerfilGlobal(
  perfilId: number
): Promise<void> {

  const perfis = await sequelize.query<PerfilGlobalRow>(
    `
      SELECT escopo
      FROM legio.perfil_acesso
      WHERE id = :perfilId
      LIMIT 1
    `,
    {
      replacements: {
        perfilId
      },
      type: QueryTypes.SELECT
    }
  );

  if (perfis[0]?.escopo !== 'GLOBAL') {
    throw new HttpError(
      400,
      'Somente perfis de escopo GLOBAL podem ser concedidos por esta rota.'
    );
  }
}

export async function criar(
  input: CriarUsuarioInput
): Promise<UsuarioCriado> {

  const {
    nome,
    email,
    senha
  } = validarPayload(input);

  const nomePreferido = normalizarTextoOpcional(
    input.nomePreferido
  );

  const cpf = normalizarTextoOpcional(input.cpf);
  const celular = normalizarTextoOpcional(input.celular);

  const perfilCodigo =
    normalizarTextoOpcional(input.perfilCodigo) ??
    PERFIL_PADRAO;

  const perfil = await resolverPerfil(perfilCodigo);

  await garantirPerfilGlobal(perfil.id);

  const usuariosExistentes =
    await sequelize.query<UsuarioExistenteRow>(
      `
        SELECT id::text
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

  if (usuariosExistentes.length > 0) {
    throw new HttpError(
      409,
      'Já existe um usuário cadastrado com este e-mail.'
    );
  }

  if (cpf) {
    const pessoasComCpf = await sequelize.query<PessoaExistenteRow>(
      `
        SELECT id::text
        FROM legio.pessoa
        WHERE regexp_replace(cpf, '[^0-9]', '', 'g') =
              regexp_replace(:cpf, '[^0-9]', '', 'g')
        LIMIT 1
      `,
      {
        replacements: {
          cpf
        },
        type: QueryTypes.SELECT
      }
    );

    if (pessoasComCpf.length > 0) {
      throw new HttpError(
        409,
        'Já existe uma pessoa cadastrada com este CPF.'
      );
    }
  }

  const senhaHash = await argon2.hash(senha, {
    type: argon2.argon2id
  });

  return sequelize.transaction(async (transaction) => {

    const pessoasInseridas = await sequelize.query<{
      id: string;
      nome: string;
      nome_preferido: string | null;
    }>(
      `
        INSERT INTO legio.pessoa
          (
            nome,
            nome_preferido,
            email,
            celular,
            cpf,
            ativo
          )
        VALUES
          (
            :nome,
            :nomePreferido,
            :email,
            :celular,
            :cpf,
            TRUE
          )
        RETURNING
          id::text,
          nome,
          nome_preferido
      `,
      {
        replacements: {
          nome,
          nomePreferido,
          email,
          celular,
          cpf
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const pessoa = pessoasInseridas[0];

    const usuariosInseridos = await sequelize.query<{
      id: string;
      email: string;
      status: string;
    }>(
      `
        INSERT INTO legio.usuario
          (
            pessoa_id,
            email,
            senha_hash,
            status
          )
        VALUES
          (
            :pessoaId,
            :email,
            :senhaHash,
            :status
          )
        RETURNING
          id::text,
          email,
          status
      `,
      {
        replacements: {
          pessoaId: pessoa.id,
          email,
          senhaHash,
          status: STATUS_INICIAL
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const usuario = usuariosInseridos[0];

    await sequelize.query(
      `
        INSERT INTO legio.usuario_perfil_global
          (
            usuario_id,
            perfil_id
          )
        VALUES
          (
            :usuarioId,
            :perfilId
          )
        ON CONFLICT DO NOTHING
      `,
      {
        replacements: {
          usuarioId: usuario.id,
          perfilId: perfil.id
        },
        transaction
      }
    );

    await sequelize.query(
      `
        INSERT INTO legio.auditoria_evento
          (
            usuario_id,
            acao,
            entidade,
            entidade_id,
            dados_depois
          )
        VALUES
          (
            :usuarioId,
            'USUARIO_CRIADO',
            'legio.usuario',
            :entidadeId,
            CAST(:dadosDepois AS jsonb)
          )
      `,
      {
        replacements: {
          usuarioId: usuario.id,
          entidadeId: usuario.id,
          dadosDepois: JSON.stringify({
            email,
            perfil: perfil.codigo,
            status: STATUS_INICIAL
          })
        },
        transaction
      }
    );

    return {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        status: usuario.status
      },
      pessoa: {
        id: pessoa.id,
        nome: pessoa.nome,
        nomePreferido: pessoa.nome_preferido
      },
      perfisGlobais: [perfil.codigo]
    };
  });
}