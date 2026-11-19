import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

export type UnidadePermitida = {
  id: string;
  nome: string;
  tipo: string;
  tipoNome: string;
  podeEditar: boolean;
};

/** Escopo confirmado no banco em toda requisição; nunca usar IDs de origem do cliente. */
export async function unidadesPermitidas(
  usuarioId: string, transaction?: Transaction
): Promise<UnidadePermitida[]> {
  if (!/^\d+$/.test(usuarioId)) throw new HttpError(401, 'Sessão não autenticada.');
  return sequelize.query<UnidadePermitida>(`
    WITH RECURSIVE
    owner AS (
      SELECT EXISTS (
        SELECT 1 FROM legio.usuario u
        JOIN legio.usuario_perfil_global upg ON upg.usuario_id = u.id
        JOIN legio.perfil_acesso pa ON pa.id = upg.perfil_id
        WHERE u.id = CAST(:usuarioId AS bigint) AND u.status = 'ATIVO'
          AND pa.ativo = TRUE AND pa.escopo = 'GLOBAL'
          AND pa.codigo = 'PLATFORM_OWNER'
      ) AS autorizado
    ),
    sementes AS (
      SELECT DISTINCT up.unidade_id AS id,
        pa.codigo IN ('ADMIN_UNIDADE', 'OPERADOR') AS editar
      FROM legio.usuario u
      JOIN legio.usuario_unidade_perfil up ON up.usuario_id = u.id
      JOIN legio.perfil_acesso pa ON pa.id = up.perfil_id
      JOIN legio.unidade_legionaria ul ON ul.id = up.unidade_id
      WHERE u.id = CAST(:usuarioId AS bigint) AND u.status = 'ATIVO'
        AND up.ativo = TRUE AND pa.ativo = TRUE AND pa.escopo = 'UNIDADE'
        AND ul.ativo = TRUE
    ),
    arvore (id, editar) AS (
      SELECT id, editar FROM sementes
      UNION
      SELECT filho.id, arvore.editar
      FROM legio.unidade_legionaria filho
      JOIN arvore ON filho.unidade_superior_id = arvore.id
      WHERE filho.ativo = TRUE
    )
    SELECT ul.id::text AS id, ul.nome, tu.codigo AS tipo,
      tu.nome AS "tipoNome",
      (owner.autorizado OR COALESCE(bool_or(arvore.editar), FALSE)) AS "podeEditar"
    FROM legio.unidade_legionaria ul
    JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
    CROSS JOIN owner
    LEFT JOIN arvore ON arvore.id = ul.id
    WHERE ul.ativo = TRUE
      AND (owner.autorizado OR arvore.id IS NOT NULL)
    GROUP BY ul.id, ul.nome, tu.codigo, tu.nome, owner.autorizado
    ORDER BY ul.nome
  `, { replacements: { usuarioId }, type: QueryTypes.SELECT, transaction });
}

export async function exigirUnidadePermitida(
  usuarioId: string, unidadeId: string, modo: 'LER' | 'EDITAR',
  transaction?: Transaction
): Promise<void> {
  if (!/^\d+$/.test(unidadeId)) throw new HttpError(400, 'Unidade inválida.');
  const unidades = await unidadesPermitidas(usuarioId, transaction);
  const unidade = unidades.find(u => u.id === unidadeId);
  if (!unidade || (modo === 'EDITAR' && !unidade.podeEditar)) {
    throw new HttpError(403, 'Sem permissão para esta unidade ou operação.');
  }
}
