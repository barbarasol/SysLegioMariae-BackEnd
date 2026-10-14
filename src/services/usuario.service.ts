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
  perfilCodigo?: string | null;
};

export type AtualizarUsuarioInput = {
  nome: string;
  email: string;
  nomePreferido?: string | null;
  cpf?: string | null;
  celular?: string | null;
  status?: string | null;
  perfilCodigo: string;
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
};

const PERFIL_PADRAO = 'PLATFORM_ADMIN';
const STATUS_INICIAL = 'ATIVO';
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
    String(input.perfilCodigo ?? '')
      .trim()
      .toUpperCase();

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

  if (!perfilCodigo) {
    throw new HttpError(
      400,
      'Informe o perfil de acesso.'
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
        codigo

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
        await resolverPerfil(
          perfilCodigo,
          transaction
        );

      await protegerUltimoOwner(
        atual,
        status,
        perfil.codigo,
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
                perfisGlobais: [
                  perfil.codigo
                ]
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

  const perfilCodigo =
    (
      normalizarTextoOpcional(
        input.perfilCodigo
      ) ??
      PERFIL_PADRAO
    ).toUpperCase();

  const perfil =
    await resolverPerfil(
      perfilCodigo
    );

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
                STATUS_INICIAL
            },
            type:
              QueryTypes.SELECT,
            transaction
          }
        );

      const usuario =
        usuariosInseridos[0];

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
          ON CONFLICT
            DO NOTHING
        `,
        {
          replacements: {
            usuarioId:
              usuario.id,
            perfilId:
              perfil.id
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
            dados_depois
          )
          VALUES
          (
            :usuarioId,
            'USUARIO_CRIADO',
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
                perfil:
                  perfil.codigo,
                status:
                  STATUS_INICIAL
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

        perfisGlobais: [
          perfil.codigo
        ]
      };
    }
  );
}
