import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

export type ControleVersao = {
  id: string;
  ultima_versao: string;
  implementacao: string | null;
  usu_inc_id: string;
  usu_alt_id: string | null;
  usu_inc_nome: string;
  usu_alt_nome: string | null;
  /** Instante ISO 8601 em UTC, com Z explícito. */
  created_at: string;
  update_at: string;
};

function validarVersao(entrada: unknown): string {
  if (typeof entrada !== 'string') {
    throw new HttpError(400, 'Informe a versão como texto.');
  }
  const ultimaVersao = entrada.trim();
  if (!ultimaVersao || ultimaVersao.length > 50 || !/^[A-Za-z0-9][A-Za-z0-9._+\-]{0,49}$/.test(ultimaVersao)) {
    throw new HttpError(400, 'Versão inválida (até 50 caracteres, letras, números, pontos e hífens).');
  }
  return ultimaVersao;
}

function validarId(id: unknown): string {
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id)) {
    throw new HttpError(400, 'Identificador de versão inválido.');
  }
  return id;
}

type DadosVersao = {
  ultimaVersao: string;
  implementacao: string | null;
  informouImplementacao: boolean;
};

function validarBody(body: unknown): DadosVersao {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Informe o objeto com ultima_versao e implementacao.');
  }
  const obj = body as Record<string, unknown>;
  if (Object.keys(obj).some((key) => key !== 'ultima_versao' && key !== 'implementacao')) {
    throw new HttpError(400, 'Somente ultima_versao e implementacao podem ser informados.');
  }
  const informouImplementacao = Object.prototype.hasOwnProperty.call(obj, 'implementacao');
  if (informouImplementacao && obj.implementacao !== null && typeof obj.implementacao !== 'string') {
    throw new HttpError(400, 'Implementação deve ser um texto.');
  }
  // TEXT é opcional. Campo vazio é gravado como NULL.
  const implementacao = typeof obj.implementacao === 'string'
    ? (obj.implementacao.trim() || null)
    : null;
  return {
    ultimaVersao: validarVersao(obj.ultima_versao),
    implementacao,
    informouImplementacao
  };
}

/**
 * Usar UTC explícito no contrato JSON, independente do TimeZone da sessão PostgreSQL.
 * Não convertemos datas DATE (sem hora), somente TIMESTAMPTZ.
 */
const COLUNAS = `
  cv.id::text AS id,
  cv.ultima_versao,
  cv.implementacao,
  cv.usu_inc_id::text AS usu_inc_id,
  cv.usu_alt_id::text AS usu_alt_id,
  COALESCE(NULLIF(BTRIM(p_inc.nome), ''), 'Usuário sem nome') AS usu_inc_nome,
  CASE WHEN cv.usu_alt_id IS NULL THEN NULL
       ELSE COALESCE(NULLIF(BTRIM(p_alt.nome), ''), 'Usuário sem nome')
  END AS usu_alt_nome,
  TO_CHAR(cv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
  TO_CHAR(cv.update_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS update_at
`;

const TABELAS = `
  FROM legio.controle_versao cv
  JOIN legio.usuario u_inc ON u_inc.id = cv.usu_inc_id
  JOIN legio.pessoa p_inc ON p_inc.id = u_inc.pessoa_id
  LEFT JOIN legio.usuario u_alt ON u_alt.id = cv.usu_alt_id
  LEFT JOIN legio.pessoa p_alt ON p_alt.id = u_alt.pessoa_id
`;

async function obterPorId(id: string, transaction: Transaction): Promise<ControleVersao> {
  const [item] = await sequelize.query<ControleVersao>(`
    SELECT ${COLUNAS} ${TABELAS}
    WHERE cv.id = CAST(:id AS bigint)
  `, { replacements: { id }, transaction, type: QueryTypes.SELECT });
  if (!item) throw new HttpError(404, 'Versão não encontrada.');
  return item;
}

export async function versaoAtual(): Promise<{ ultima_versao: string | null }> {
  const linhas = await sequelize.query<{ ultima_versao: string }>(`
    SELECT ultima_versao FROM legio.controle_versao
    ORDER BY created_at DESC, id DESC LIMIT 1
  `, { type: QueryTypes.SELECT });
  return { ultima_versao: linhas[0]?.ultima_versao ?? null };
}

export async function listar(): Promise<ControleVersao[]> {
  return sequelize.query<ControleVersao>(`
    SELECT ${COLUNAS} ${TABELAS}
    ORDER BY cv.created_at DESC, cv.id DESC
  `, { type: QueryTypes.SELECT });
}

export async function criar(usuarioId: string, body: unknown): Promise<ControleVersao> {
  const { ultimaVersao, implementacao } = validarBody(body);
  return sequelize.transaction(async (transaction) => {
    const [inserido] = await sequelize.query<{ id: string }>(`
      INSERT INTO legio.controle_versao (ultima_versao, implementacao, usu_inc_id)
      VALUES (:ultimaVersao, :implementacao, CAST(:usuarioId AS bigint))
      RETURNING id::text AS id
    `, { replacements: { ultimaVersao, implementacao, usuarioId }, transaction, type: QueryTypes.SELECT });
    return obterPorId(inserido.id, transaction);
  });
}

export async function atualizar(usuarioId: string, idBruto: unknown, body: unknown): Promise<ControleVersao> {
  const id = validarId(idBruto);
  const { ultimaVersao, implementacao, informouImplementacao } = validarBody(body);
  return sequelize.transaction(async (transaction) => {
    const [alterado] = await sequelize.query<{ id: string }>(`
      UPDATE legio.controle_versao SET
        ultima_versao = :ultimaVersao,
        implementacao = CASE
          WHEN :informouImplementacao THEN :implementacao
          ELSE implementacao
        END,
        usu_alt_id = CAST(:usuarioId AS bigint),
        update_at = clock_timestamp()
      WHERE id = CAST(:id AS bigint)
      RETURNING id::text AS id
    `, { replacements: { id, ultimaVersao, implementacao, informouImplementacao, usuarioId }, transaction, type: QueryTypes.SELECT });
    if (!alterado) throw new HttpError(404, 'Versão não encontrada.');
    return obterPorId(alterado.id, transaction);
  });
}

export async function excluir(idBruto: unknown): Promise<void> {
  const id = validarId(idBruto);
  const [excluida] = await sequelize.query<{ id: string }>(`
    DELETE FROM legio.controle_versao WHERE id = CAST(:id AS bigint)
    RETURNING id::text AS id
  `, { replacements: { id }, type: QueryTypes.SELECT });
  if (!excluida) throw new HttpError(404, 'Versão não encontrada.');
}
