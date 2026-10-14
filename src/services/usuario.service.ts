import argon2 from 'argon2';
import {
  QueryTypes,
  Transaction
} from 'sequelize';

import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

type PessoaExistenteRow = {
  id: string;
};

type UsuarioExistenteRow = {
  id: string;
};

type UsuarioBaseRow = {
  id: string;
  pessoa_id: string;
  nome: string;
  nome_preferido: string | null;
  cpf: string | null;
  celular: string | null;
  email: string;
  status: string;
  perfis_globais: string[];
};

export type CriarUsuarioInput = {
  nome: string;
  email: string;
  senha: string;
  nomePreferido?: string | null;
  cpf?: string | null;
  celular?: string | null;
};

export type AtualizarUsuarioInput = {
  nome: string;
  email: string;
  nomePreferido?: string | null;
  cpf?: string | null;
  celular?: string | null;
  status?: string | null;
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

export type FiltrosListarUsuarios = {
  nome?: string;
  cpf?: string;
  celular?: string;
  email?: string;
  ordenarPor?: 'nome' | 'cpf' | 'celular' | 'email';
  direcao?: 'asc' | 'desc';
};

export type UsuarioLista = {
  id: string;
  pessoaId: string;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  celular: string | null;
  email: string;
  status: string;
  perfisGlobais: string[];
};

export type PerfilAcessoGlobal = {
  id: string;
  codigo: string;
  nome?: string;
  descricao?: string | null;
};

export type PerfilAcessoUnidade = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
};

export type UnidadeDisponivel = {
  id: string;
  nome: string;
  nomeReduzido: string | null;
  tipoCodigo: string;
  tipoNome: string;
  statusAprovacao: string;
};

export type AcessoUnidade = {
  usuarioId: string;
  unidadeId: string;
  unidadeNome: string;
  unidadeNomeReduzido: string | null;
  unidadeTipoCodigo: string;
  unidadeTipoNome: string;
  unidadeStatusAprovacao: string;
  perfilId: string;
  perfilCodigo: string;
  perfilNome: string;
  concedidoEm: string | null;
};

export type SalvarAcessoUnidadeInput = {
  unidadeId: string;
  perfilCodigo: string;
  observacao?: string | null;
};

const STATUS_CADASTRO_INICIAL = 'PENDENTE_EMAIL';
const SENHA_MINIMA = 6;

const STATUS_VALIDOS = [
  'PENDENTE_EMAIL',
  'ATIVO',
  'BLOQUEADO',
  'INATIVO'
] as const;

function normalizarEmail(
  valor: unknown
): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase();
}

function normalizarTextoOpcional(
  valor: unknown
): string | null {
  const texto =
    String(valor ?? '').trim();

  return texto === ''
    ? null
    : texto;
}

function validarPayload(
  input: CriarUsuarioInput
) {
  const nome =
    String(input.nome ?? '').trim();

  const email =
    normalizarEmail(input.email);

  const senha =
    String(input.senha ?? '');

  if (!nome) {
    throw new HttpError(
      400,
      'Informe o nome completo.'
    );
  }

  if (!email) {
    throw new HttpError(
      400,
      'Informe o e-mail.'
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new HttpError(
      400,
      'Informe um e-mail válido.'
    );
  }

  if (
    senha.length < SENHA_MINIMA
  ) {
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

function validarAtualizacao(
  input: AtualizarUsuarioInput
) {
  const nome =
    String(input.nome ?? '').trim();

  const email =
    normalizarEmail(input.email);

  const status =
    String(input.status ?? 'ATIVO')
      .trim()
      .toUpperCase();

  const perfilCodigo =
    normalizarTextoOpcional(
      input.perfilCodigo
    )?.toUpperCase() ?? null;

  if (!nome) {
    throw new HttpError(
      400,
      'Informe o nome completo.'
    );
  }

  if (!email) {
    throw new HttpError(
      400,
      'Informe o e-mail.'
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new HttpError(
      400,
      'Informe um e-mail válido.'
    );
  }

  if (
    !STATUS_VALIDOS.includes(
      status as typeof STATUS_VALIDOS[number]
    )
  ) {
    throw new HttpError(
      400,
      'Status de usuário inválido.'
    );
  }

  return {
    nome,
    email,
    status,
    perfilCodigo
  };
}

async function resolverPerfil(
  perfilCodigo: string,
  transaction?: Transaction
): Promise<{
  id: string;
  codigo: string;
}> {

  const perfis =
    await sequelize.query<{
      id: string;
      codigo: string;
    }>(
      `
        SELECT
          id::text,
          codigo
        FROM legio.perfil_acesso
        WHERE upper(codigo) = upper(:codigo)
          AND ativo = TRUE
          AND escopo = 'GLOBAL'
        LIMIT 1
      `,
      {
        replacements: {
          codigo: perfilCodigo
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  const perfil =
    perfis[0];

  if (!perfil) {
    throw new HttpError(
      400,
      `Perfil global não encontrado ou inativo: ${perfilCodigo}.`
    );
  }

  return perfil;
}


async function resolverPerfilUnidade(
  perfilCodigo: string,
  transaction?: Transaction
): Promise<{
  id: string;
  codigo: string;
  nome: string;
}> {

  const codigo =
    String(perfilCodigo ?? '')
      .trim()
      .toUpperCase();

  if (!codigo) {
    throw new HttpError(
      400,
      'Informe o perfil da unidade.'
    );
  }

  const perfis =
    await sequelize.query<{
      id: string;
      codigo: string;
      nome: string;
    }>(
      `
        SELECT
          id::text,
          codigo,
          nome
        FROM legio.perfil_acesso
        WHERE upper(codigo) = upper(:codigo)
          AND ativo = TRUE
          AND escopo = 'UNIDADE'
        LIMIT 1
      `,
      {
        replacements: {
          codigo
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  const perfil =
    perfis[0];

  if (!perfil) {
    throw new HttpError(
      400,
      `Perfil de unidade não encontrado ou inativo: ${codigo}.`
    );
  }

  return perfil;
}

async function buscarUnidade(
  unidadeId: string,
  transaction?: Transaction
): Promise<{
  id: string;
  nome: string;
  status_aprovacao: string;
  ativo: boolean;
}> {

  if (
    !unidadeId ||
    !/^\d+$/.test(
      String(unidadeId)
    )
  ) {
    throw new HttpError(
      400,
      'Identificador da unidade inválido.'
    );
  }

  const unidades =
    await sequelize.query<{
      id: string;
      nome: string;
      status_aprovacao: string;
      ativo: boolean;
    }>(
      `
        SELECT
          id::text,
          nome,
          status_aprovacao,
          ativo
        FROM legio.unidade_legionaria
        WHERE id = :unidadeId
        LIMIT 1
      `,
      {
        replacements: {
          unidadeId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  const unidade =
    unidades[0];

  if (!unidade) {
    throw new HttpError(
      404,
      'Unidade legionária não encontrada.'
    );
  }

  return unidade;
}

async function garantirUnidadePodeReceberAcesso(
  unidadeId: string,
  transaction?: Transaction
): Promise<void> {

  const unidade =
    await buscarUnidade(
      unidadeId,
      transaction
    );

  if (
    !unidade.ativo ||
    unidade.status_aprovacao !==
      'APROVADA'
  ) {
    throw new HttpError(
      409,
      'Somente unidades ativas e aprovadas podem receber novos acessos.'
    );
  }
}

async function garantirMembroNaUnidade(
  usuarioId: string,
  unidadeId: string,
  transaction?: Transaction
): Promise<void> {

  const vinculos =
    await sequelize.query<{
      id: string;
    }>(
      `
        SELECT
          mu.id::text
        FROM legio.usuario u
        INNER JOIN legio.membro m
          ON m.pessoa_id = u.pessoa_id
        INNER JOIN legio.membro_unidade mu
          ON mu.membro_id = m.id
        WHERE u.id = :usuarioId
          AND m.status = 'ATIVO'
          AND mu.unidade_id = :unidadeId
          AND mu.ativo = TRUE
        LIMIT 1
      `,
      {
        replacements: {
          usuarioId,
          unidadeId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  if (
    vinculos.length === 0
  ) {
    throw new HttpError(
      409,
      'O perfil MEMBRO só pode ser concedido quando a pessoa possuir vínculo ativo como membro desta unidade.'
    );
  }
}

async function buscarAcessoUnidadeAtivo(
  usuarioId: string,
  unidadeId: string,
  perfilCodigo: string,
  transaction?: Transaction
): Promise<AcessoUnidade | null> {

  const acessos =
    await sequelize.query<{
      usuario_id: string;
      unidade_id: string;
      unidade_nome: string;
      unidade_nome_reduzido: string | null;
      unidade_tipo_codigo: string;
      unidade_tipo_nome: string;
      unidade_status_aprovacao: string;
      perfil_id: string;
      perfil_codigo: string;
      perfil_nome: string;
      concedido_em: string | null;
    }>(
      `
        SELECT
          uup.usuario_id::text,
          uup.unidade_id::text,
          ul.nome AS unidade_nome,
          ul.nome_reduzido AS unidade_nome_reduzido,
          tu.codigo AS unidade_tipo_codigo,
          tu.nome AS unidade_tipo_nome,
          ul.status_aprovacao AS unidade_status_aprovacao,
          pa.id::text AS perfil_id,
          pa.codigo AS perfil_codigo,
          pa.nome AS perfil_nome,
          uup.concedido_em::text
        FROM legio.usuario_unidade_perfil uup
        INNER JOIN legio.unidade_legionaria ul
          ON ul.id = uup.unidade_id
        INNER JOIN legio.tipo_unidade tu
          ON tu.id = ul.tipo_unidade_id
        INNER JOIN legio.perfil_acesso pa
          ON pa.id = uup.perfil_id
        WHERE uup.usuario_id = :usuarioId
          AND uup.unidade_id = :unidadeId
          AND upper(pa.codigo) = upper(:perfilCodigo)
          AND pa.escopo = 'UNIDADE'
          AND uup.ativo = TRUE
        LIMIT 1
      `,
      {
        replacements: {
          usuarioId,
          unidadeId,
          perfilCodigo
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  const acesso =
    acessos[0];

  if (!acesso) {
    return null;
  }

  return {
    usuarioId:
      acesso.usuario_id,
    unidadeId:
      acesso.unidade_id,
    unidadeNome:
      acesso.unidade_nome,
    unidadeNomeReduzido:
      acesso.unidade_nome_reduzido,
    unidadeTipoCodigo:
      acesso.unidade_tipo_codigo,
    unidadeTipoNome:
      acesso.unidade_tipo_nome,
    unidadeStatusAprovacao:
      acesso.unidade_status_aprovacao,
    perfilId:
      acesso.perfil_id,
    perfilCodigo:
      acesso.perfil_codigo,
    perfilNome:
      acesso.perfil_nome,
    concedidoEm:
      acesso.concedido_em
  };
}

async function registrarAuditoriaAcessoUnidade(
  concedidoPorUsuarioId: string,
  unidadeId: string,
  usuarioAlvoId: string,
  acao: string,
  dadosAntes: unknown,
  dadosDepois: unknown,
  transaction?: Transaction
): Promise<void> {

  await sequelize.query(
    `
      INSERT INTO legio.auditoria_evento
      (
        usuario_id,
        unidade_id,
        acao,
        entidade,
        entidade_id,
        dados_antes,
        dados_depois
      )
      VALUES
      (
        :concedidoPorUsuarioId,
        :unidadeId,
        :acao,
        'legio.usuario_unidade_perfil',
        :entidadeId,
        CAST(:dadosAntes AS jsonb),
        CAST(:dadosDepois AS jsonb)
      )
    `,
    {
      replacements: {
        concedidoPorUsuarioId,
        unidadeId,
        acao,
        entidadeId:
          `${usuarioAlvoId}:${unidadeId}`,
        dadosAntes:
          JSON.stringify(
            dadosAntes ?? null
          ),
        dadosDepois:
          JSON.stringify(
            dadosDepois ?? null
          )
      },
      transaction
    }
  );
}

async function buscarUsuario(
  usuarioId: string,
  transaction?: Transaction
): Promise<UsuarioBaseRow> {

  const usuarios =
    await sequelize.query<UsuarioBaseRow>(
      `
        SELECT
          u.id::text,
          p.id::text AS pessoa_id,
          p.nome,
          p.nome_preferido,
          p.cpf,
          p.celular,
          u.email,
          u.status,

          COALESCE(
            ARRAY(
              SELECT pa.codigo
              FROM legio.usuario_perfil_global upg
              INNER JOIN legio.perfil_acesso pa
                ON pa.id = upg.perfil_id
              WHERE upg.usuario_id = u.id
                AND pa.escopo = 'GLOBAL'
              ORDER BY pa.codigo
            ),
            ARRAY[]::text[]
          ) AS perfis_globais

        FROM legio.usuario u

        INNER JOIN legio.pessoa p
          ON p.id = u.pessoa_id

        WHERE u.id = :usuarioId

        LIMIT 1
      `,
      {
        replacements: {
          usuarioId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  const usuario =
    usuarios[0];

  if (!usuario) {
    throw new HttpError(
      404,
      'Usuário não encontrado.'
    );
  }

  return usuario;
}

async function garantirOutroOwnerAtivo(
  usuarioId: string,
  transaction?: Transaction
): Promise<void> {

  const outrosOwners =
    await sequelize.query<{
      total: string;
    }>(
      `
        SELECT
          COUNT(DISTINCT u.id)::text
            AS total

        FROM legio.usuario_perfil_global upg

        INNER JOIN legio.perfil_acesso pa
          ON pa.id = upg.perfil_id

        INNER JOIN legio.usuario u
          ON u.id = upg.usuario_id

        WHERE pa.codigo = 'PLATFORM_OWNER'
          AND u.status = 'ATIVO'
          AND u.id <> :usuarioId
      `,
      {
        replacements: {
          usuarioId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

  if (
    Number(
      outrosOwners[0]?.total ?? 0
    ) === 0
  ) {
    throw new HttpError(
      409,
      'Não é possível remover ou inativar o último PLATFORM_OWNER ativo da plataforma.'
    );
  }
}

async function protegerUltimoOwner(
  atual: UsuarioBaseRow,
  novoStatus: string,
  novoPerfilCodigo: string,
  transaction?: Transaction
): Promise<void> {

  const ehOwner =
    atual.perfis_globais.includes(
      'PLATFORM_OWNER'
    );

  if (!ehOwner) {
    return;
  }

  const removendoPerfilOwner =
    novoPerfilCodigo !==
      'PLATFORM_OWNER';

  const desativandoUsuario =
    novoStatus !== 'ATIVO';

  if (
    removendoPerfilOwner ||
    desativandoUsuario
  ) {
    await garantirOutroOwnerAtivo(
      atual.id,
      transaction
    );
  }
}

function mapearUsuario(
  usuario: UsuarioBaseRow
): UsuarioLista {

  return {
    id: usuario.id,
    pessoaId: usuario.pessoa_id,
    nome: usuario.nome,
    nomePreferido:
      usuario.nome_preferido,
    cpf: usuario.cpf,
    celular: usuario.celular,
    email: usuario.email,
    status: usuario.status,
    perfisGlobais:
      usuario.perfis_globais ?? []
  };
}

export async function listarPerfisGlobais():
Promise<PerfilAcessoGlobal[]> {

  return sequelize.query<PerfilAcessoGlobal>(
    `
      SELECT
        id::text,
        codigo,
        nome,
        descricao

      FROM legio.perfil_acesso

      WHERE escopo = 'GLOBAL'
        AND ativo = TRUE

      ORDER BY
        CASE
          WHEN codigo = 'PLATFORM_OWNER'
            THEN 1
          WHEN codigo = 'PLATFORM_ADMIN'
            THEN 2
          ELSE 3
        END,
        codigo
    `,
    {
      type: QueryTypes.SELECT
    }
  );
}


export async function listarPerfisUnidade():
Promise<PerfilAcessoUnidade[]> {

  return sequelize.query<PerfilAcessoUnidade>(
    `
      SELECT
        id::text,
        codigo,
        nome,
        descricao
      FROM legio.perfil_acesso
      WHERE escopo = 'UNIDADE'
        AND ativo = TRUE
      ORDER BY
        CASE
          WHEN codigo = 'ADMIN_UNIDADE'
            THEN 1
          WHEN codigo = 'OPERADOR'
            THEN 2
          WHEN codigo = 'CONSULTA'
            THEN 3
          WHEN codigo = 'MEMBRO'
            THEN 4
          ELSE 5
        END,
        codigo
    `,
    {
      type:
        QueryTypes.SELECT
    }
  );
}

export async function listarUnidadesDisponiveis():
Promise<UnidadeDisponivel[]> {

  const unidades =
    await sequelize.query<{
      id: string;
      nome: string;
      nome_reduzido: string | null;
      tipo_codigo: string;
      tipo_nome: string;
      status_aprovacao: string;
    }>(
      `
        SELECT
          ul.id::text,
          ul.nome,
          ul.nome_reduzido,
          tu.codigo AS tipo_codigo,
          tu.nome AS tipo_nome,
          ul.status_aprovacao
        FROM legio.unidade_legionaria ul
        INNER JOIN legio.tipo_unidade tu
          ON tu.id = ul.tipo_unidade_id
        WHERE ul.ativo = TRUE
        ORDER BY
          tu.ordem_hierarquica NULLS LAST,
          tu.nome,
          ul.nome
      `,
      {
        type:
          QueryTypes.SELECT
      }
    );

  return unidades.map(
    (unidade) => ({
      id:
        unidade.id,
      nome:
        unidade.nome,
      nomeReduzido:
        unidade.nome_reduzido,
      tipoCodigo:
        unidade.tipo_codigo,
      tipoNome:
        unidade.tipo_nome,
      statusAprovacao:
        unidade.status_aprovacao
    })
  );
}

export async function listarAcessosUnidade(
  usuarioId: string
): Promise<AcessoUnidade[]> {

  await buscarUsuario(
    usuarioId
  );

  const acessos =
    await sequelize.query<{
      usuario_id: string;
      unidade_id: string;
      unidade_nome: string;
      unidade_nome_reduzido: string | null;
      unidade_tipo_codigo: string;
      unidade_tipo_nome: string;
      unidade_status_aprovacao: string;
      perfil_id: string;
      perfil_codigo: string;
      perfil_nome: string;
      concedido_em: string | null;
    }>(
      `
        SELECT
          uup.usuario_id::text,
          uup.unidade_id::text,
          ul.nome AS unidade_nome,
          ul.nome_reduzido AS unidade_nome_reduzido,
          tu.codigo AS unidade_tipo_codigo,
          tu.nome AS unidade_tipo_nome,
          ul.status_aprovacao AS unidade_status_aprovacao,
          pa.id::text AS perfil_id,
          pa.codigo AS perfil_codigo,
          pa.nome AS perfil_nome,
          uup.concedido_em::text
        FROM legio.usuario_unidade_perfil uup
        INNER JOIN legio.unidade_legionaria ul
          ON ul.id = uup.unidade_id
        INNER JOIN legio.tipo_unidade tu
          ON tu.id = ul.tipo_unidade_id
        INNER JOIN legio.perfil_acesso pa
          ON pa.id = uup.perfil_id
        WHERE uup.usuario_id = :usuarioId
          AND uup.ativo = TRUE
          AND pa.escopo = 'UNIDADE'
        ORDER BY
          ul.nome,
          pa.codigo
      `,
      {
        replacements: {
          usuarioId
        },
        type:
          QueryTypes.SELECT
      }
    );

  return acessos.map(
    (acesso) => ({
      usuarioId:
        acesso.usuario_id,
      unidadeId:
        acesso.unidade_id,
      unidadeNome:
        acesso.unidade_nome,
      unidadeNomeReduzido:
        acesso.unidade_nome_reduzido,
      unidadeTipoCodigo:
        acesso.unidade_tipo_codigo,
      unidadeTipoNome:
        acesso.unidade_tipo_nome,
      unidadeStatusAprovacao:
        acesso.unidade_status_aprovacao,
      perfilId:
        acesso.perfil_id,
      perfilCodigo:
        acesso.perfil_codigo,
      perfilNome:
        acesso.perfil_nome,
      concedidoEm:
        acesso.concedido_em
    })
  );
}

export async function adicionarAcessoUnidade(
  usuarioId: string,
  input: SalvarAcessoUnidadeInput,
  concedidoPorUsuarioId: string
): Promise<AcessoUnidade> {

  const unidadeId =
    String(
      input.unidadeId ?? ''
    ).trim();

  const perfilCodigo =
    String(
      input.perfilCodigo ?? ''
    )
      .trim()
      .toUpperCase();

  const observacao =
    normalizarTextoOpcional(
      input.observacao
    );

  return sequelize.transaction(
    async (transaction) => {

      await buscarUsuario(
        usuarioId,
        transaction
      );

      await garantirUnidadePodeReceberAcesso(
        unidadeId,
        transaction
      );

      const perfil =
        await resolverPerfilUnidade(
          perfilCodigo,
          transaction
        );

      if (
        perfil.codigo === 'MEMBRO'
      ) {
        await garantirMembroNaUnidade(
          usuarioId,
          unidadeId,
          transaction
        );
      }

      const antes =
        await buscarAcessoUnidadeAtivo(
          usuarioId,
          unidadeId,
          perfil.codigo,
          transaction
        );

      await sequelize.query(
        `
          INSERT INTO
            legio.usuario_unidade_perfil
          (
            usuario_id,
            unidade_id,
            perfil_id,
            ativo,
            concedido_por,
            concedido_em,
            revogado_em,
            observacao
          )
          VALUES
          (
            :usuarioId,
            :unidadeId,
            :perfilId,
            TRUE,
            :concedidoPorUsuarioId,
            CURRENT_TIMESTAMP,
            NULL,
            :observacao
          )
          ON CONFLICT
            (usuario_id, unidade_id, perfil_id)
          DO UPDATE
          SET
            ativo = TRUE,
            concedido_por =
              EXCLUDED.concedido_por,
            concedido_em =
              CURRENT_TIMESTAMP,
            revogado_em = NULL,
            observacao =
              EXCLUDED.observacao
        `,
        {
          replacements: {
            usuarioId,
            unidadeId,
            perfilId:
              perfil.id,
            concedidoPorUsuarioId,
            observacao
          },
          transaction
        }
      );

      const depois =
        await buscarAcessoUnidadeAtivo(
          usuarioId,
          unidadeId,
          perfil.codigo,
          transaction
        );

      if (!depois) {
        throw new HttpError(
          500,
          'Não foi possível carregar o acesso criado.'
        );
      }

      await registrarAuditoriaAcessoUnidade(
        concedidoPorUsuarioId,
        unidadeId,
        usuarioId,
        antes
          ? 'USUARIO_ACESSO_UNIDADE_REATIVADO'
          : 'USUARIO_ACESSO_UNIDADE_INCLUIDO',
        antes,
        depois,
        transaction
      );

      return depois;
    }
  );
}

export async function alterarAcessoUnidade(
  usuarioId: string,
  unidadeIdAtual: string,
  perfilCodigoAtual: string,
  input: SalvarAcessoUnidadeInput,
  concedidoPorUsuarioId: string
): Promise<AcessoUnidade> {

  const novaUnidadeId =
    String(
      input.unidadeId ?? ''
    ).trim();

  const novoPerfilCodigo =
    String(
      input.perfilCodigo ?? ''
    )
      .trim()
      .toUpperCase();

  const observacao =
    normalizarTextoOpcional(
      input.observacao
    );

  return sequelize.transaction(
    async (transaction) => {

      await buscarUsuario(
        usuarioId,
        transaction
      );

      const antes =
        await buscarAcessoUnidadeAtivo(
          usuarioId,
          unidadeIdAtual,
          perfilCodigoAtual,
          transaction
        );

      if (!antes) {
        throw new HttpError(
          404,
          'Acesso da unidade não encontrado ou já revogado.'
        );
      }

      await garantirUnidadePodeReceberAcesso(
        novaUnidadeId,
        transaction
      );

      const novoPerfil =
        await resolverPerfilUnidade(
          novoPerfilCodigo,
          transaction
        );

      if (
        novoPerfil.codigo === 'MEMBRO'
      ) {
        await garantirMembroNaUnidade(
          usuarioId,
          novaUnidadeId,
          transaction
        );
      }

      await sequelize.query(
        `
          UPDATE legio.usuario_unidade_perfil
          SET
            ativo = FALSE,
            revogado_em =
              CURRENT_TIMESTAMP
          WHERE usuario_id =
                :usuarioId
            AND unidade_id =
                :unidadeIdAtual
            AND perfil_id =
                :perfilIdAtual
            AND ativo = TRUE
        `,
        {
          replacements: {
            usuarioId,
            unidadeIdAtual,
            perfilIdAtual:
              antes.perfilId
          },
          transaction
        }
      );

      await sequelize.query(
        `
          INSERT INTO
            legio.usuario_unidade_perfil
          (
            usuario_id,
            unidade_id,
            perfil_id,
            ativo,
            concedido_por,
            concedido_em,
            revogado_em,
            observacao
          )
          VALUES
          (
            :usuarioId,
            :novaUnidadeId,
            :novoPerfilId,
            TRUE,
            :concedidoPorUsuarioId,
            CURRENT_TIMESTAMP,
            NULL,
            :observacao
          )
          ON CONFLICT
            (usuario_id, unidade_id, perfil_id)
          DO UPDATE
          SET
            ativo = TRUE,
            concedido_por =
              EXCLUDED.concedido_por,
            concedido_em =
              CURRENT_TIMESTAMP,
            revogado_em = NULL,
            observacao =
              EXCLUDED.observacao
        `,
        {
          replacements: {
            usuarioId,
            novaUnidadeId,
            novoPerfilId:
              novoPerfil.id,
            concedidoPorUsuarioId,
            observacao
          },
          transaction
        }
      );

      const depois =
        await buscarAcessoUnidadeAtivo(
          usuarioId,
          novaUnidadeId,
          novoPerfil.codigo,
          transaction
        );

      if (!depois) {
        throw new HttpError(
          500,
          'Não foi possível carregar o acesso atualizado.'
        );
      }

      await registrarAuditoriaAcessoUnidade(
        concedidoPorUsuarioId,
        novaUnidadeId,
        usuarioId,
        'USUARIO_ACESSO_UNIDADE_ALTERADO',
        antes,
        depois,
        transaction
      );

      return depois;
    }
  );
}

export async function removerAcessoUnidade(
  usuarioId: string,
  unidadeId: string,
  perfilCodigo: string,
  revogadoPorUsuarioId: string
): Promise<void> {

  await sequelize.transaction(
    async (transaction) => {

      await buscarUsuario(
        usuarioId,
        transaction
      );

      const antes =
        await buscarAcessoUnidadeAtivo(
          usuarioId,
          unidadeId,
          perfilCodigo,
          transaction
        );

      if (!antes) {
        throw new HttpError(
          404,
          'Acesso da unidade não encontrado ou já revogado.'
        );
      }

      await sequelize.query(
        `
          UPDATE legio.usuario_unidade_perfil
          SET
            ativo = FALSE,
            revogado_em =
              CURRENT_TIMESTAMP
          WHERE usuario_id =
                :usuarioId
            AND unidade_id =
                :unidadeId
            AND perfil_id =
                :perfilId
            AND ativo = TRUE
        `,
        {
          replacements: {
            usuarioId,
            unidadeId,
            perfilId:
              antes.perfilId
          },
          transaction
        }
      );

      await registrarAuditoriaAcessoUnidade(
        revogadoPorUsuarioId,
        unidadeId,
        usuarioId,
        'USUARIO_ACESSO_UNIDADE_REVOGADO',
        antes,
        null,
        transaction
      );
    }
  );
}

export async function listar(
  filtros: FiltrosListarUsuarios = {}
): Promise<UsuarioLista[]> {

  const nome =
    String(filtros.nome ?? '').trim();

  const cpf =
    String(filtros.cpf ?? '')
      .replace(/\D/g, '');

  const celular =
    String(filtros.celular ?? '')
      .replace(/\D/g, '');

  const email =
    String(filtros.email ?? '')
      .trim()
      .toLowerCase();

  const colunasOrdenacao = {
    nome: 'p.nome',
    cpf: 'p.cpf',
    celular: 'p.celular',
    email: 'u.email'
  } as const;

  const ordenarPor =
    filtros.ordenarPor &&
    filtros.ordenarPor in
      colunasOrdenacao
      ? filtros.ordenarPor
      : 'nome';

  const direcao =
    filtros.direcao === 'desc'
      ? 'DESC'
      : 'ASC';

  const colunaOrdenacao =
    colunasOrdenacao[ordenarPor];

  const usuarios =
    await sequelize.query<UsuarioBaseRow>(
      `
        SELECT
          u.id::text,
          p.id::text AS pessoa_id,
          p.nome,
          p.nome_preferido,
          p.cpf,
          p.celular,
          u.email,
          u.status,

          COALESCE(
            ARRAY(
              SELECT pa.codigo
              FROM legio.usuario_perfil_global upg
              INNER JOIN legio.perfil_acesso pa
                ON pa.id = upg.perfil_id
              WHERE upg.usuario_id = u.id
                AND pa.escopo = 'GLOBAL'
              ORDER BY pa.codigo
            ),
            ARRAY[]::text[]
          ) AS perfis_globais

        FROM legio.usuario u

        INNER JOIN legio.pessoa p
          ON p.id = u.pessoa_id

        WHERE
          u.status <> 'INATIVO'

          AND
          (
            :nome = ''
            OR p.nome ILIKE
              '%' || :nome || '%'
          )

          AND
          (
            :cpf = ''
            OR regexp_replace(
                 COALESCE(p.cpf, ''),
                 '[^0-9]',
                 '',
                 'g'
               )
               LIKE
               '%' || :cpf || '%'
          )

          AND
          (
            :celular = ''
            OR regexp_replace(
                 COALESCE(
                   p.celular,
                   ''
                 ),
                 '[^0-9]',
                 '',
                 'g'
               )
               LIKE
               '%' || :celular || '%'
          )

          AND
          (
            :email = ''
            OR lower(u.email)
               LIKE
               '%' || :email || '%'
          )

        ORDER BY
          ${colunaOrdenacao}
          ${direcao},
          u.id
      `,
      {
        replacements: {
          nome,
          cpf,
          celular,
          email
        },
        type: QueryTypes.SELECT
      }
    );

  return usuarios.map(
    mapearUsuario
  );
}

export async function atualizar(
  usuarioId: string,
  input: AtualizarUsuarioInput
): Promise<UsuarioLista> {

  const {
    nome,
    email,
    status,
    perfilCodigo
  } = validarAtualizacao(input);

  const nomePreferido =
    normalizarTextoOpcional(
      input.nomePreferido
    );

  const cpf =
    normalizarTextoOpcional(
      input.cpf
    );

  const celular =
    normalizarTextoOpcional(
      input.celular
    );

  return sequelize.transaction(
    async (transaction) => {

      const atual =
        await buscarUsuario(
          usuarioId,
          transaction
        );

      const perfil =
        perfilCodigo
          ? await resolverPerfil(
              perfilCodigo,
              transaction
            )
          : null;

      await protegerUltimoOwner(
        atual,
        status,
        perfil?.codigo ?? '',
        transaction
      );

      const emailDuplicado =
        await sequelize.query<UsuarioExistenteRow>(
          `
            SELECT id::text
            FROM legio.usuario
            WHERE lower(email) =
                  lower(:email)
              AND id <> :usuarioId
            LIMIT 1
          `,
          {
            replacements: {
              email,
              usuarioId
            },
            type:
              QueryTypes.SELECT,
            transaction
          }
        );

      if (
        emailDuplicado.length > 0
      ) {
        throw new HttpError(
          409,
          'Já existe outro usuário cadastrado com este e-mail.'
        );
      }

      if (cpf) {
        const cpfDuplicado =
          await sequelize.query<PessoaExistenteRow>(
            `
              SELECT id::text
              FROM legio.pessoa

              WHERE
                regexp_replace(
                  COALESCE(cpf, ''),
                  '[^0-9]',
                  '',
                  'g'
                )
                =
                regexp_replace(
                  :cpf,
                  '[^0-9]',
                  '',
                  'g'
                )

                AND
                id <> :pessoaId

              LIMIT 1
            `,
            {
              replacements: {
                cpf,
                pessoaId:
                  atual.pessoa_id
              },
              type:
                QueryTypes.SELECT,
              transaction
            }
          );

        if (
          cpfDuplicado.length > 0
        ) {
          throw new HttpError(
            409,
            'Já existe outra pessoa cadastrada com este CPF.'
          );
        }
      }

      await sequelize.query(
        `
          UPDATE legio.pessoa

          SET
            nome = :nome,
            nome_preferido =
              :nomePreferido,
            email = :email,
            celular = :celular,
            cpf = :cpf

          WHERE id = :pessoaId
        `,
        {
          replacements: {
            nome,
            nomePreferido,
            email,
            celular,
            cpf,
            pessoaId:
              atual.pessoa_id
          },
          transaction
        }
      );

      await sequelize.query(
        `
          UPDATE legio.usuario

          SET
            email = :email,
            status = :status

          WHERE id = :usuarioId
        `,
        {
          replacements: {
            email,
            status,
            usuarioId
          },
          transaction
        }
      );

      /*
       * Altera somente o perfil GLOBAL.
       * Perfis vinculados a unidades permanecem
       * em usuario_unidade_perfil e não são tocados.
       */
      await sequelize.query(
        `
          DELETE FROM
            legio.usuario_perfil_global

          WHERE usuario_id =
                :usuarioId
        `,
        {
          replacements: {
            usuarioId
          },
          transaction
        }
      );

      /*
       * Perfil GLOBAL é opcional.
       *
       * Usuário recém-cadastrado pode permanecer sem
       * qualquer perfil global até a definição administrativa.
       */
      if (perfil) {
        await sequelize.query(
          `
            INSERT INTO
              legio.usuario_perfil_global
            (
              usuario_id,
              perfil_id
            )
            VALUES
            (
              :usuarioId,
              :perfilId
            )
          `,
          {
            replacements: {
              usuarioId,
              perfilId:
                perfil.id
            },
            transaction
          }
        );
      }

      if (
        status !== 'ATIVO'
      ) {
        await sequelize.query(
          `
            UPDATE
              legio.usuario_refresh_token

            SET revogado_em =
              CURRENT_TIMESTAMP

            WHERE usuario_id =
                  :usuarioId
              AND revogado_em
                  IS NULL
          `,
          {
            replacements: {
              usuarioId
            },
            transaction
          }
        );
      }

      await sequelize.query(
        `
          INSERT INTO
            legio.auditoria_evento
          (
            usuario_id,
            acao,
            entidade,
            entidade_id,
            dados_antes,
            dados_depois
          )
          VALUES
          (
            :usuarioId,
            'USUARIO_ATUALIZADO',
            'legio.usuario',
            :usuarioId,
            CAST(
              :dadosAntes AS jsonb
            ),
            CAST(
              :dadosDepois AS jsonb
            )
          )
        `,
        {
          replacements: {
            usuarioId,

            dadosAntes:
              JSON.stringify(
                mapearUsuario(
                  atual
                )
              ),

            dadosDepois:
              JSON.stringify({
                nome,
                nomePreferido,
                cpf,
                celular,
                email,
                status,
                perfisGlobais:
                  perfil
                    ? [perfil.codigo]
                    : []
              })
          },
          transaction
        }
      );

      const atualizado =
        await buscarUsuario(
          usuarioId,
          transaction
        );

      return mapearUsuario(
        atualizado
      );
    }
  );
}

export async function excluir(
  usuarioId: string
): Promise<void> {

  await sequelize.transaction(
    async (transaction) => {

      const atual =
        await buscarUsuario(
          usuarioId,
          transaction
        );

      await protegerUltimoOwner(
        atual,
        'INATIVO',
        atual.perfis_globais[0] ?? '',
        transaction
      );

      await sequelize.query(
        `
          UPDATE legio.usuario

          SET status = 'INATIVO'

          WHERE id = :usuarioId
        `,
        {
          replacements: {
            usuarioId
          },
          transaction
        }
      );

      await sequelize.query(
        `
          UPDATE
            legio.usuario_refresh_token

          SET revogado_em =
            CURRENT_TIMESTAMP

          WHERE usuario_id =
                :usuarioId
            AND revogado_em
                IS NULL
        `,
        {
          replacements: {
            usuarioId
          },
          transaction
        }
      );

      await sequelize.query(
        `
          INSERT INTO
            legio.auditoria_evento
          (
            usuario_id,
            acao,
            entidade,
            entidade_id,
            dados_antes,
            dados_depois
          )
          VALUES
          (
            :usuarioId,
            'USUARIO_INATIVADO',
            'legio.usuario',
            :usuarioId,
            CAST(
              :dadosAntes AS jsonb
            ),
            CAST(
              :dadosDepois AS jsonb
            )
          )
        `,
        {
          replacements: {
            usuarioId,

            dadosAntes:
              JSON.stringify(
                mapearUsuario(
                  atual
                )
              ),

            dadosDepois:
              JSON.stringify({
                status:
                  'INATIVO'
              })
          },
          transaction
        }
      );
    }
  );
}

export async function criar(
  input: CriarUsuarioInput
): Promise<UsuarioCriado> {

  const {
    nome,
    email,
    senha
  } = validarPayload(input);

  const nomePreferido =
    normalizarTextoOpcional(
      input.nomePreferido
    );

  const cpf =
    normalizarTextoOpcional(
      input.cpf
    );

  const celular =
    normalizarTextoOpcional(
      input.celular
    );

  /*
   * Regra:
   * criar conta NÃO cria membro
   * e NÃO atribui perfil.
   *
   * A pessoa existe como identidade civil do usuário.
   * O registro em legio.membro só será criado
   * caso essa pessoa seja efetivamente legionária.
   */
  const usuariosExistentes =
    await sequelize.query<UsuarioExistenteRow>(
      `
        SELECT id::text
        FROM legio.usuario
        WHERE lower(email) =
              lower(:email)
        LIMIT 1
      `,
      {
        replacements: {
          email
        },
        type:
          QueryTypes.SELECT
      }
    );

  if (
    usuariosExistentes.length > 0
  ) {
    throw new HttpError(
      409,
      'Já existe um usuário cadastrado com este e-mail.'
    );
  }

  if (cpf) {
    const pessoasComCpf =
      await sequelize.query<PessoaExistenteRow>(
        `
          SELECT id::text
          FROM legio.pessoa
          WHERE
            regexp_replace(
              COALESCE(cpf, ''),
              '[^0-9]',
              '',
              'g'
            )
            =
            regexp_replace(
              :cpf,
              '[^0-9]',
              '',
              'g'
            )
          LIMIT 1
        `,
        {
          replacements: {
            cpf
          },
          type:
            QueryTypes.SELECT
        }
      );

    if (
      pessoasComCpf.length > 0
    ) {
      throw new HttpError(
        409,
        'Já existe uma pessoa cadastrada com este CPF.'
      );
    }
  }

  const senhaHash =
    await argon2.hash(
      senha,
      {
        type:
          argon2.argon2id
      }
    );

  return sequelize.transaction(
    async (transaction) => {

      const pessoasInseridas =
        await sequelize.query<{
          id: string;
          nome: string;
          nome_preferido:
            string | null;
        }>(
          `
            INSERT INTO
              legio.pessoa
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
            type:
              QueryTypes.SELECT,
            transaction
          }
        );

      const pessoa =
        pessoasInseridas[0];

      const usuariosInseridos =
        await sequelize.query<{
          id: string;
          email: string;
          status: string;
        }>(
          `
            INSERT INTO
              legio.usuario
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
              pessoaId:
                pessoa.id,
              email,
              senhaHash,
              status:
                STATUS_CADASTRO_INICIAL
            },
            type:
              QueryTypes.SELECT,
            transaction
          }
        );

      const usuario =
        usuariosInseridos[0];

      /*
       * NÃO inserir:
       * - legio.membro
       * - legio.usuario_perfil_global
       * - legio.usuario_unidade_perfil
       *
       * As permissões serão atribuídas posteriormente.
       */

      await sequelize.query(
        `
          INSERT INTO
            legio.auditoria_evento
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
            'USUARIO_CRIADO_SEM_PERFIL',
            'legio.usuario',
            :entidadeId,
            CAST(
              :dadosDepois AS jsonb
            )
          )
        `,
        {
          replacements: {
            usuarioId:
              usuario.id,

            entidadeId:
              usuario.id,

            dadosDepois:
              JSON.stringify({
                email,
                status:
                  STATUS_CADASTRO_INICIAL,
                perfisGlobais: []
              })
          },
          transaction
        }
      );

      return {
        usuario: {
          id:
            usuario.id,
          email:
            usuario.email,
          status:
            usuario.status
        },

        pessoa: {
          id:
            pessoa.id,
          nome:
            pessoa.nome,
          nomePreferido:
            pessoa.nome_preferido
        },

        perfisGlobais: []
      };
    }
  );
}
