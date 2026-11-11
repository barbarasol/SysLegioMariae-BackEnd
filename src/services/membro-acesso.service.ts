import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Autorização EXCLUSIVA do módulo Membros.
 * - PLATFORM_OWNER: todos os Praesidia ativos.
 * - OPERADOR / ADMIN_UNIDADE: somente os Praesidia com vínculo DIRETO,
 *   ativo e não revogado em legio.usuario_unidade_perfil.
 * - Nenhuma herança de acesso por Curia, Comitium, Regia ou Senatus.
 *
 * A consulta ao banco é executada por requisição, inclusive no POST;
 * revogar o acesso impede novas operações sem depender do estado Angular.
 */
export async function obterUnidadesPermitidasMembros(
  usuarioId: string,
  transaction?: Transaction
): Promise<string[]> {
  if (!/^[1-9]\d*$/.test(String(usuarioId ?? ''))) {
    throw new HttpError(401, 'Sessão não autenticada.');
  }

  const unidades = await sequelize.query<{ id: string }>(
    `
      SELECT DISTINCT ul.id::text AS id
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      WHERE ul.ativo = TRUE
        AND tu.codigo = 'PRAESIDIUM'
        AND EXISTS (
          SELECT 1
          FROM legio.usuario usuario
          WHERE usuario.id = CAST(:usuarioId AS bigint)
            AND usuario.status = 'ATIVO'
        )
        AND (
          EXISTS (
            SELECT 1
            FROM legio.usuario_perfil_global upg
            JOIN legio.perfil_acesso pa
              ON pa.id = upg.perfil_id
            WHERE upg.usuario_id = CAST(:usuarioId AS bigint)
              AND pa.codigo = 'PLATFORM_OWNER'
              AND pa.escopo = 'GLOBAL'
              AND pa.ativo = TRUE
          )
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
      replacements: { usuarioId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  if (unidades.length === 0) {
    throw new HttpError(
      403,
      'Acesso ao módulo Membros não autorizado. É necessário ter perfil OPERADOR ou ADMIN_UNIDADE diretamente em um Praesidium.'
    );
  }

  return unidades.map((unidade) => unidade.id);
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
