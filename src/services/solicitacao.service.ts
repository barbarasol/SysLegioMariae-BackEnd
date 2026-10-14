import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

export type SolicitacaoResumo = {
  id: string;
  status: string;
  justificativa: string | null;
  solicitadoEm: Date;
  analisadoEm: Date | null;
  unidadeId: string;
  unidadeNome: string;
  unidadeTipo: string;
  unidadeCidade: string | null;
  unidadeEstado: string | null;
  unidadeSuperior: string | null;
  solicitanteNome: string | null;
  solicitanteEmail: string | null;
};

export type ResumoStatus = {
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
};

const STATUS_PERMITIDOS = [
  'PENDENTE',
  'APROVADA',
  'REJEITADA',
  'CANCELADA'
];

function normalizarStatus(valor: unknown): string | null {
  const texto = String(valor ?? '')
    .trim()
    .toUpperCase();

  return texto === '' ? null : texto;
}

/**
 * Lista as solicitações de unidade, com os dados da unidade
 * e do solicitante já resolvidos para a tela.
 */
export async function listar(
  status: string | null,
  tipo: string | null
): Promise<SolicitacaoResumo[]> {

  const statusNormalizado = normalizarStatus(status);

  if (
    statusNormalizado &&
    !STATUS_PERMITIDOS.includes(statusNormalizado)
  ) {
    throw new HttpError(
      400,
      'Informe um status de solicitação válido.'
    );
  }

  const tipoNormalizado = tipo
    ? String(tipo).trim().toUpperCase()
    : null;

  return sequelize.query<SolicitacaoResumo>(
    `
      SELECT
        su.id::text,
        su.status,
        su.justificativa,
        su.solicitado_em    AS "solicitadoEm",
        su.analisado_em     AS "analisadoEm",
        ul.id::text         AS "unidadeId",
        ul.nome             AS "unidadeNome",
        tu.codigo           AS "unidadeTipo",
        ul.cidade           AS "unidadeCidade",
        ul.estado_regiao    AS "unidadeEstado",
        sup.nome            AS "unidadeSuperior",
        p.nome              AS "solicitanteNome",
        u.email             AS "solicitanteEmail"
      FROM legio.solicitacao_unidade su
      JOIN legio.unidade_legionaria ul
        ON ul.id = su.unidade_id
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      LEFT JOIN legio.unidade_legionaria sup
        ON sup.id = ul.unidade_superior_id
      LEFT JOIN legio.usuario u
        ON u.id = su.solicitante_usuario_id
      LEFT JOIN legio.pessoa p
        ON p.id = u.pessoa_id
      WHERE (
              CAST(:status AS varchar) IS NULL
              OR su.status = CAST(:status AS varchar)
            )
        AND (
              CAST(:tipo AS varchar) IS NULL
              OR tu.codigo = CAST(:tipo AS varchar)
            )
      ORDER BY
        CASE su.status
          WHEN 'PENDENTE' THEN 1
          ELSE 2
        END,
        su.solicitado_em DESC
    `,
    {
      replacements: {
        status: statusNormalizado,
        tipo: tipoNormalizado
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function resumo(): Promise<ResumoStatus> {

  const linhas = await sequelize.query<{
    status: string;
    total: string;
  }>(
    `
      SELECT
        status,
        count(*)::text AS total
      FROM legio.solicitacao_unidade
      GROUP BY status
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const resumo: ResumoStatus = {
    pendentes: 0,
    aprovadas: 0,
    rejeitadas: 0
  };

  for (const linha of linhas) {
    const total = Number(linha.total);

    if (linha.status === 'PENDENTE') {
      resumo.pendentes = total;
    }

    if (linha.status === 'APROVADA') {
      resumo.aprovadas = total;
    }

    if (linha.status === 'REJEITADA') {
      resumo.rejeitadas = total;
    }
  }

  return resumo;
}

type StatusAprovacaoUnidade =
  | 'PENDENTE'
  | 'APROVADA'
  | 'REJEITADA'
  | 'BLOQUEADA';

/**
 * Atualiza a solicitação e o status_aprovacao da unidade na mesma
 * transação — as duas tabelas têm CHECKs com listas diferentes:
 *   solicitacao_unidade.status       -> PENDENTE/APROVADA/REJEITADA/CANCELADA
 *   unidade_legionaria.status_aprovacao -> PENDENTE/APROVADA/REJEITADA/BLOQUEADA
 */
async function analisar(
  solicitacaoId: string,
  analistaId: string,
  resposta: string | null,
  statusSolicitacao: 'APROVADA' | 'REJEITADA',
  statusUnidade: StatusAprovacaoUnidade
): Promise<SolicitacaoResumo> {

  if (!/^\d+$/.test(solicitacaoId)) {
    throw new HttpError(400, 'Solicitação inválida.');
  }

  return sequelize.transaction(async (transaction) => {

    const atuais = await sequelize.query<{
      id: string;
      status: string;
      unidade_id: string;
    }>(
      `
        SELECT
          id::text,
          status,
          unidade_id::text
        FROM legio.solicitacao_unidade
        WHERE id = CAST(:solicitacaoId AS bigint)
        FOR UPDATE
      `,
      {
        replacements: {
          solicitacaoId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const atual = atuais[0];

    if (!atual) {
      throw new HttpError(404, 'Solicitação não encontrada.');
    }

    if (atual.status !== 'PENDENTE') {
      throw new HttpError(
        409,
        `Esta solicitação já foi analisada (${atual.status}).`
      );
    }

    await sequelize.query(
      `
        UPDATE legio.solicitacao_unidade
           SET status = :statusSolicitacao,
               resposta = :resposta,
               analisado_por_usuario_id =
                 CAST(:analistaId AS bigint),
               analisado_em = CURRENT_TIMESTAMP
         WHERE id = CAST(:solicitacaoId AS bigint)
      `,
      {
        replacements: {
          solicitacaoId,
          statusSolicitacao,
          resposta,
          analistaId
        },
        transaction
      }
    );

    await sequelize.query(
      `
        UPDATE legio.unidade_legionaria
           SET status_aprovacao = :statusUnidade,
               aprovado_por_usuario_id =
                 CAST(:analistaId AS bigint),
               aprovado_em = CURRENT_TIMESTAMP,
               motivo_status = :resposta
         WHERE id = CAST(:unidadeId AS bigint)
      `,
      {
        replacements: {
          unidadeId: atual.unidade_id,
          statusUnidade,
          analistaId,
          resposta
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
            CAST(:analistaId AS bigint),
            :acao,
            'legio.solicitacao_unidade',
            :entidadeId,
            CAST(:dadosDepois AS jsonb)
          )
      `,
      {
        replacements: {
          analistaId,
          acao: `SOLICITACAO_${statusSolicitacao}`,
          entidadeId: solicitacaoId,
          dadosDepois: JSON.stringify({
            status: statusSolicitacao,
            unidadeStatus: statusUnidade
          })
        },
        transaction
      }
    );

    const resultado = await sequelize.query<SolicitacaoResumo>(
      `
        SELECT
          su.id::text,
          su.status,
          su.justificativa,
          su.solicitado_em    AS "solicitadoEm",
          su.analisado_em     AS "analisadoEm",
          ul.id::text         AS "unidadeId",
          ul.nome             AS "unidadeNome",
          tu.codigo           AS "unidadeTipo",
          ul.cidade           AS "unidadeCidade",
          ul.estado_regiao    AS "unidadeEstado",
          sup.nome            AS "unidadeSuperior",
          p.nome              AS "solicitanteNome",
          u.email             AS "solicitanteEmail"
        FROM legio.solicitacao_unidade su
        JOIN legio.unidade_legionaria ul
          ON ul.id = su.unidade_id
        JOIN legio.tipo_unidade tu
          ON tu.id = ul.tipo_unidade_id
        LEFT JOIN legio.unidade_legionaria sup
          ON sup.id = ul.unidade_superior_id
        LEFT JOIN legio.usuario u
          ON u.id = su.solicitante_usuario_id
        LEFT JOIN legio.pessoa p
          ON p.id = u.pessoa_id
        WHERE su.id = CAST(:solicitacaoId AS bigint)
      `,
      {
        replacements: {
          solicitacaoId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    return resultado[0];
  });
}

export async function aprovar(
  solicitacaoId: string,
  analistaId: string,
  resposta?: unknown
): Promise<SolicitacaoResumo> {

  const texto = String(resposta ?? '').trim();

  return analisar(
    solicitacaoId,
    analistaId,
    texto === '' ? null : texto,
    'APROVADA',
    'APROVADA'
  );
}

export async function rejeitar(
  solicitacaoId: string,
  analistaId: string,
  resposta?: unknown
): Promise<SolicitacaoResumo> {

  const texto = String(resposta ?? '').trim();

  return analisar(
    solicitacaoId,
    analistaId,
    texto === '' ? null : texto,
    'REJEITADA',
    'REJEITADA'
  );
}