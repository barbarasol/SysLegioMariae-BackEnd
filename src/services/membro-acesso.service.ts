import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Autorização EXCLUSIVA do módulo Membros.
 * - PLATFORM_OWNER: todos os Praesidia ativos.
 * - OPERADOR / ADMIN_UNIDADE: somente os Praesidia com vínculo DIRETO,
 *   ativo e não revogado em legio.usuario_unidade_perfil.
 * - MEMBRO: apenas seu próprio cadastro, localizado por usuario.pessoa_id.
 * - Nenhuma herança de acesso por Curia, Comitium, Regia ou Senatus.
 *
 * A consulta ao banco é executada por requisição, inclusive no POST;
 * revogar o acesso impede novas operações sem depender do estado Angular.
 */
export type EscopoMembros = {
  platformOwner: boolean;
  somenteMeuCadastro: boolean;
  possuiPerfilMembro: boolean;
  pessoaId: string | null;
  unidadesPermitidas: string[];
};

/** Escopo efetivo do módulo Membros. Não é baseado na hierarquia. */
export async function obterEscopoMembros(
  usuarioId: string,
  transaction?: Transaction
): Promise<EscopoMembros> {
  if (!/^[1-9]\d*$/.test(String(usuarioId ?? ''))) {
    throw new HttpError(401, 'Sessão não autenticada.');
  }

  const usuarios = await sequelize.query<{
    platformOwner: boolean;
    possuiPerfilMembro: boolean;
    pessoaId: string | null;
  }>(
    `
      SELECT
        u.pessoa_id::text AS "pessoaId",
        EXISTS (
          SELECT 1 FROM legio.usuario_perfil_global upg
          JOIN legio.perfil_acesso pa ON pa.id = upg.perfil_id
          WHERE upg.usuario_id = u.id
            AND pa.codigo = 'PLATFORM_OWNER'
            AND pa.escopo = 'GLOBAL'
            AND pa.ativo = TRUE
        ) AS "platformOwner",
        EXISTS (
          SELECT 1 FROM legio.usuario_unidade_perfil uup
          JOIN legio.perfil_acesso pa ON pa.id = uup.perfil_id
          JOIN legio.unidade_legionaria ul
            ON ul.id = uup.unidade_id AND ul.ativo = TRUE
          JOIN legio.tipo_unidade tu
            ON tu.id = ul.tipo_unidade_id AND tu.codigo = 'PRAESIDIUM'
          WHERE uup.usuario_id = u.id
            AND uup.ativo = TRUE
            AND uup.revogado_em IS NULL
            AND pa.escopo = 'UNIDADE'
            AND pa.ativo = TRUE
            AND pa.codigo = 'MEMBRO'
        ) AS "possuiPerfilMembro"
      FROM legio.usuario u
      WHERE u.id = CAST(:usuarioId AS bigint)
        AND u.status = 'ATIVO'
      LIMIT 1
    `,
    { replacements: { usuarioId }, type: QueryTypes.SELECT, transaction }
  );
  if (usuarios.length === 0) {
    throw new HttpError(403, 'Usuário inativo ou sem autorização para acessar membros.');
  }
  const { platformOwner, possuiPerfilMembro, pessoaId } = usuarios[0];

  const unidades = await sequelize.query<{ id: string }>(
    `
      SELECT DISTINCT ul.id::text AS id
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      WHERE ul.ativo = TRUE
        AND tu.codigo = 'PRAESIDIUM'
        AND (
          :platformOwner = TRUE
          OR EXISTS (
            SELECT 1
            FROM legio.usuario_unidade_perfil uup
            JOIN legio.perfil_acesso pa
              ON pa.id = uup.perfil_id
            WHERE uup.usuario_id = CAST(:usuarioId AS bigint)
              AND uup.unidade_id = ul.id
              AND uup.ativo = TRUE
              AND uup.revogado_em IS NULL
              AND pa.escopo = 'UNIDADE'
              AND pa.ativo = TRUE
              AND pa.codigo IN ('OPERADOR', 'ADMIN_UNIDADE')
          )
        )
      ORDER BY id
    `,
    {
      replacements: { usuarioId, platformOwner },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  // Um perfil MEMBRO dá acesso exclusivamente à própria pessoa,
  // mesmo que ela ainda não tenha vínculo legio.membro_unidade.
  const somenteMeuCadastro = !platformOwner && unidades.length === 0 && possuiPerfilMembro;
  if (!platformOwner && unidades.length === 0 && !somenteMeuCadastro) {
    throw new HttpError(
      403,
      'Acesso ao módulo Membros não autorizado. É necessário ter perfil OPERADOR ou ADMIN_UNIDADE diretamente em um Praesidium.'
    );
  }

  return {
    platformOwner,
    somenteMeuCadastro,
    possuiPerfilMembro,
    pessoaId,
    unidadesPermitidas: unidades.map((unidade) => unidade.id)
  };
}

/** Compatibilidade: usado pelo cadastro, que exige unidade válida. */
export async function obterUnidadesPermitidasMembros(
  usuarioId: string,
  transaction?: Transaction
): Promise<string[]> {
  const escopo = await obterEscopoMembros(usuarioId, transaction);
  // O perfil MEMBRO nunca adquire permissão para incluir outros membros.
  if (escopo.somenteMeuCadastro) {
    throw new HttpError(403, 'O perfil MEMBRO permite somente a edição dos próprios dados.');
  }
  return escopo.unidadesPermitidas;
}

/** Proíbe inclusive alteração manual de unidadeId via Postman. */
export function garantirPraesidiumPermitido(
  unidadeId: string,
  unidadesPermitidas: readonly string[]
): void {
  if (!/^[1-9]\d*$/.test(String(unidadeId ?? ''))) {
    throw new HttpError(400, 'Informe uma unidade válida.');
  }

  if (!unidadesPermitidas.includes(String(unidadeId))) {
    throw new HttpError(
      403,
      'Você não possui permissão para cadastrar ou consultar membros deste Praesidium.'
    );
  }
}

/** Exige o perfil MEMBRO ativo para o acesso a /me. */
export async function obterPessoaDoProprioMembro(
  usuarioId: string,
  transaction?: Transaction
): Promise<string> {
  const escopo = await obterEscopoMembros(usuarioId, transaction);
  if (!escopo.possuiPerfilMembro || !escopo.pessoaId) {
    throw new HttpError(403, 'Acesso ao cadastro pessoal não autorizado.');
  }
  return escopo.pessoaId;
}
