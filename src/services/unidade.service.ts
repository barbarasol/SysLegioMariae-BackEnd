import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

type TipoUnidadeRow = {
  id: number;
  codigo: string;
};

type UnidadeCriadaRow = {
  id: string;
  nome: string;
  cidade: string | null;
  estado_regiao: string | null;
  status_aprovacao: string;
};

export type CriarUnidadeInput = {
  tipoCodigo: string;
  nome: string;
  nomeReduzido?: string | null;
  cidade?: string | null;
  estadoRegiao?: string | null;
  paisCodigo?: string | null;
  dataConstituicao?: string | null;
  unidadeSuperiorId?: string | null;
  observacao?: string | null;
  solicitanteUsuarioId: string;
};

export type UnidadeCriada = {
  id: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  estadoRegiao: string | null;
  statusAprovacao: string;
};

/**
 * A trigger legio.fn_validar_hierarquia_unidade exige
 * unidade_superior_id para todo tipo que não seja CONCILIUM.
 */
const TIPO_SEM_SUPERIOR = 'CONCILIUM';

const TIPOS_PERMITIDOS = [
  'CONCILIUM',
  'SENATUS',
  'REGIA',
  'COMITIUM',
  'CURIA',
  'PRAESIDIUM',
  'PATRICIOS',
  'VELITE'
];

function normalizarTextoOpcional(
  valor: unknown
): string | null {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : texto;
}

function normalizarTipo(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase();
}

async function resolverTipo(
  codigo: string
): Promise<TipoUnidadeRow> {

  const tipos = await sequelize.query<TipoUnidadeRow>(
    `
      SELECT id, codigo
      FROM legio.tipo_unidade
      WHERE codigo = :codigo
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: {
        codigo
      },
      type: QueryTypes.SELECT
    }
  );

  const tipo = tipos[0];

  if (!tipo) {
    throw new HttpError(
      400,
      `Tipo de unidade não encontrado ou inativo: ${codigo}.`
    );
  }

  return tipo;
}

async function validarSuperior(
  tipoCodigo: string,
  unidadeSuperiorId: string | null
): Promise<void> {

  if (tipoCodigo === TIPO_SEM_SUPERIOR) {
    return;
  }

  if (!unidadeSuperiorId) {
    throw new HttpError(
      400,
      `Unidades do tipo ${tipoCodigo} precisam de uma unidade superior.`
    );
  }

  const superiores = await sequelize.query<{ id: string }>(
    `
      SELECT id::text
      FROM legio.unidade_legionaria
      WHERE id = CAST(:unidadeSuperiorId AS bigint)
      LIMIT 1
    `,
    {
      replacements: {
        unidadeSuperiorId
      },
      type: QueryTypes.SELECT
    }
  );

  if (superiores.length === 0) {
    throw new HttpError(
      400,
      'Unidade superior informada não foi encontrada.'
    );
  }
}

export type UnidadeResumo = {
  id: string;
  nome: string;
  nomeReduzido: string | null;
  tipo: string;
  cidade: string | null;
  estadoRegiao: string | null;
  unidadeSuperiorId: string | null;
  statusAprovacao: string;
};

/**
 * Alimenta o select de "unidade superior" do formulário.
 * O tipo é validado contra a mesma lista aceita em criar(),
 * para não virar filtro livre sobre a coluna.
 */
export async function listar(
  tipoCodigo: string | null
): Promise<UnidadeResumo[]> {

  const tipoNormalizado = tipoCodigo
    ? normalizarTipo(tipoCodigo)
    : null;

  if (
    tipoNormalizado &&
    !TIPOS_PERMITIDOS.includes(tipoNormalizado)
  ) {
    throw new HttpError(
      400,
      'Informe um tipo de unidade válido.'
    );
  }

  return sequelize.query<UnidadeResumo>(
    `
      SELECT
        ul.id::text,
        ul.nome,
        ul.nome_reduzido,
        tu.codigo AS tipo,
        ul.cidade,
        ul.estado_regiao,
        ul.unidade_superior_id::text,
        ul.status_aprovacao
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      WHERE ul.ativo = TRUE
        AND (
          CAST(:tipoCodigo AS varchar) IS NULL
          OR tu.codigo = CAST(:tipoCodigo AS varchar)
        )
      ORDER BY tu.ordem_hierarquica NULLS LAST, ul.nome
    `,
    {
      replacements: {
        tipoCodigo: tipoNormalizado
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function criar(
  input: CriarUnidadeInput
): Promise<UnidadeCriada> {

  const tipoCodigo = normalizarTipo(input.tipoCodigo);
  const nome = String(input.nome ?? '').trim();

  if (!TIPOS_PERMITIDOS.includes(tipoCodigo)) {
    throw new HttpError(
      400,
      'Informe um tipo de unidade válido.'
    );
  }

  if (!nome) {
    throw new HttpError(
      400,
      'Informe o nome da unidade.'
    );
  }

  const nomeReduzido = normalizarTextoOpcional(
    input.nomeReduzido
  );

  const cidade = normalizarTextoOpcional(input.cidade);
  const estadoRegiao = normalizarTextoOpcional(
    input.estadoRegiao
  );

  const paisCodigo =
    normalizarTextoOpcional(input.paisCodigo) ?? 'BR';

  const dataConstituicao = normalizarTextoOpcional(
    input.dataConstituicao
  );

  const observacao = normalizarTextoOpcional(
    input.observacao
  );

  const unidadeSuperiorId = normalizarTextoOpcional(
    input.unidadeSuperiorId
  );

  const tipo = await resolverTipo(tipoCodigo);

  await validarSuperior(tipoCodigo, unidadeSuperiorId);

  return sequelize.transaction(async (transaction) => {

    const inseridas = await sequelize.query<UnidadeCriadaRow>(
      `
        INSERT INTO legio.unidade_legionaria
          (
            tipo_unidade_id,
            unidade_superior_id,
            nome,
            nome_reduzido,
            cidade,
            estado_regiao,
            pais_codigo,
            data_constituicao,
            observacao,
            status_aprovacao,
            ativo
          )
        VALUES
          (
            :tipoUnidadeId,
            CAST(:unidadeSuperiorId AS bigint),
            :nome,
            :nomeReduzido,
            :cidade,
            :estadoRegiao,
            :paisCodigo,
            CAST(:dataConstituicao AS date),
            :observacao,
            'PENDENTE',
            TRUE
          )
        RETURNING
          id::text,
          nome,
          cidade,
          estado_regiao,
          status_aprovacao
      `,
      {
        replacements: {
          tipoUnidadeId: tipo.id,
          unidadeSuperiorId,
          nome,
          nomeReduzido,
          cidade,
          estadoRegiao,
          paisCodigo,
          dataConstituicao,
          observacao
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const unidade = inseridas[0];

    await sequelize.query(
      `
        INSERT INTO legio.solicitacao_unidade
          (
            unidade_id,
            solicitante_usuario_id,
            status,
            justificativa
          )
        VALUES
          (
            CAST(:unidadeId AS bigint),
            CAST(:solicitanteId AS bigint),
            'PENDENTE',
            :justificativa
          )
      `,
      {
        replacements: {
          unidadeId: unidade.id,
          solicitanteId: input.solicitanteUsuarioId,
          justificativa: observacao
        },
        transaction
      }
    );

    return {
      id: unidade.id,
      nome: unidade.nome,
      tipo: tipo.codigo,
      cidade: unidade.cidade,
      estadoRegiao: unidade.estado_regiao,
      statusAprovacao: unidade.status_aprovacao
    };
  });
}