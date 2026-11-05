import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

export type OficialListado = {
  id: string;
  membroId: string;
  pessoaId: string;

  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  rg: string | null;
  email: string | null;
  celular: string | null;
  telefone: string | null;

  dataNascimento: string | null;
  diaAniversario: number | null;
  mesAniversario: number | null;
  idade: number | null;

  cargo: string;
  cargoNome: string;
  ordemCargo: number | null;

  unidadeId: string;
  unidadeNome: string;
  unidadeTipo: string;
  cidade: string | null;
  estadoRegiao: string | null;

  numeroMandato: number | null;
  dataInicio: string;
  dataFim: string | null;
  /** Meses completos desde o início do mandato. */
  mesesMandato: number | null;
  /** Fim previsto do mandato: 12 meses após o início. */
  fimPrevisto: string | null;
  mandatoVigente: boolean;

  status: string;
};

export type Aniversariante = {
  oficialId: string;
  nome: string;
  nomePreferido: string | null;
  celular: string | null;
  telefone: string | null;
  email: string | null;
  cargoNome: string;
  unidadeNome: string;
  unidadeTipo: string;
  dataNascimento: string;
  dia: number;
  mes: number;
  idadeCompleta: number;
  diasAte: number;
};

export type ResumoOficiais = {
  total: number;
  totalCargos: number;
  porCargo: Array<{ cargo: string; cargoNome: string; total: number }>;
  aniversariantesMes: number;
};

export type FiltrosOficiais = {
  busca?: string | null;
  unidadeId?: string | null;
  cargo?: string | null;
  somenteVigentes?: boolean;
};

/** Meses de um mandato legionário padrão. */
const MESES_MANDATO = 12;

function texto(valor: unknown): string | null {
  const limpo = String(valor ?? '').trim();
  return limpo === '' ? null : limpo;
}

/**
 * Lista de oficiais: quem tem cargo ativo em membro_cargo_unidade.
 *
 * "Oficial" não é um tipo de pessoa no schema — é o vínculo entre
 * um membro, uma unidade e um cargo oficial.
 */
export async function listar(
  filtros: FiltrosOficiais = {}
): Promise<OficialListado[]> {

  const busca = texto(filtros.busca);
  const unidadeId = texto(filtros.unidadeId);
  const cargo = texto(filtros.cargo)?.toUpperCase() ?? null;
  const somenteVigentes = filtros.somenteVigentes === true;

  if (unidadeId && !/^\d+$/.test(unidadeId)) {
    throw new HttpError(400, 'Informe uma unidade válida.');
  }

  return sequelize.query<OficialListado>(
    `
      SELECT
        mcu.id::text                          AS id,
        m.id::text                            AS "membroId",
        p.id::text                            AS "pessoaId",

        p.nome,
        p.nome_preferido                      AS "nomePreferido",
        p.cpf,
        p.rg,
        p.email,
        p.celular,
        p.telefone,

        p.data_nascimento::text               AS "dataNascimento",
        EXTRACT(DAY FROM p.data_nascimento)::int   AS "diaAniversario",
        EXTRACT(MONTH FROM p.data_nascimento)::int AS "mesAniversario",
        CASE
          WHEN p.data_nascimento IS NULL THEN NULL
          ELSE DATE_PART(
                 'year',
                 AGE(CURRENT_DATE, p.data_nascimento)
               )::int
        END                                   AS idade,

        cl.codigo                             AS cargo,
        cl.nome                               AS "cargoNome",
        cl.ordem_exibicao                     AS "ordemCargo",

        ul.id::text                           AS "unidadeId",
        ul.nome                               AS "unidadeNome",
        tu.codigo                             AS "unidadeTipo",
        ul.cidade,
        ul.estado_regiao                      AS "estadoRegiao",

        mcu.numero_mandato                    AS "numeroMandato",
        mcu.data_inicio::text                 AS "dataInicio",
        mcu.data_fim::text                    AS "dataFim",

        GREATEST(
          0,
          DATE_PART(
            'year',
            AGE(CURRENT_DATE, mcu.data_inicio)
          ) * 12
          + DATE_PART(
              'month',
              AGE(CURRENT_DATE, mcu.data_inicio)
            )
        )::int                                AS "mesesMandato",

        (mcu.data_inicio + (:mesesMandato * INTERVAL '1 month'))::date::text
                                              AS "fimPrevisto",

        (
          mcu.data_fim IS NULL
          OR mcu.data_fim >= CURRENT_DATE
        )                                     AS "mandatoVigente",

        m.status
      FROM legio.membro_cargo_unidade mcu
      JOIN legio.cargo_legionario cl
        ON cl.id = mcu.cargo_id
      JOIN legio.membro m
        ON m.id = mcu.membro_id
      JOIN legio.pessoa p
        ON p.id = m.pessoa_id
      JOIN legio.unidade_legionaria ul
        ON ul.id = mcu.unidade_id
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id

      WHERE mcu.ativo = TRUE
        AND cl.eh_oficial = TRUE
        AND cl.ativo = TRUE
        AND (
              CAST(:somenteVigentes AS boolean) = FALSE
              OR mcu.data_fim IS NULL
              OR mcu.data_fim >= CURRENT_DATE
            )
        AND (
              CAST(:busca AS varchar) IS NULL
              OR p.nome ILIKE '%' || CAST(:busca AS varchar) || '%'
              OR p.nome_preferido ILIKE '%' || CAST(:busca AS varchar) || '%'
              OR p.cpf ILIKE '%' || CAST(:busca AS varchar) || '%'
              OR p.celular ILIKE '%' || CAST(:busca AS varchar) || '%'
            )
        AND (
              CAST(:unidadeId AS bigint) IS NULL
              OR ul.id = CAST(:unidadeId AS bigint)
            )
        AND (
              CAST(:cargo AS varchar) IS NULL
              OR cl.codigo = CAST(:cargo AS varchar)
            )
      ORDER BY
        cl.ordem_exibicao NULLS LAST,
        p.nome,
        ul.nome
    `,
    {
      replacements: {
        busca,
        unidadeId,
        cargo,
        somenteVigentes,
        mesesMandato: MESES_MANDATO
      },
      type: QueryTypes.SELECT
    }
  );
}

/**
 * Aniversariantes oficiais.
 *
 * `mes` filtra por um mês específico (1-12); quando nulo, devolve
 * os próximos `dias` a contar de hoje.
 */
export async function aniversariantes(
  mes: number | null,
  dias: number
): Promise<Aniversariante[]> {

  if (mes !== null && (mes < 1 || mes > 12)) {
    throw new HttpError(400, 'Informe um mês entre 1 e 12.');
  }

  const janela = Number.isFinite(dias) && dias > 0 ? dias : 30;

  return sequelize.query<Aniversariante>(
    `
      WITH base AS (
        SELECT
          mcu.id::text      AS "oficialId",
          p.nome,
          p.nome_preferido  AS "nomePreferido",
          p.celular,
          p.telefone,
          p.email,
          cl.nome           AS "cargoNome",
          ul.nome           AS "unidadeNome",
          tu.codigo         AS "unidadeTipo",
          p.data_nascimento AS nascimento,
          EXTRACT(DAY FROM p.data_nascimento)::int   AS dia,
          EXTRACT(MONTH FROM p.data_nascimento)::int AS mes
        FROM legio.membro_cargo_unidade mcu
        JOIN legio.cargo_legionario cl
          ON cl.id = mcu.cargo_id
        JOIN legio.membro m
          ON m.id = mcu.membro_id
        JOIN legio.pessoa p
          ON p.id = m.pessoa_id
        JOIN legio.unidade_legionaria ul
          ON ul.id = mcu.unidade_id
        JOIN legio.tipo_unidade tu
          ON tu.id = ul.tipo_unidade_id
        WHERE mcu.ativo = TRUE
          AND cl.eh_oficial = TRUE
          AND cl.ativo = TRUE
          AND p.data_nascimento IS NOT NULL
          AND (
                mcu.data_fim IS NULL
                OR mcu.data_fim >= CURRENT_DATE
              )
      ),
      com_data AS (
        SELECT
          base.*,
          -- Próxima ocorrência do aniversário a partir de hoje.
          make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int,
            base.mes,
            base.dia
          ) AS proxima
        FROM base
      ),
      ajustada AS (
        SELECT
          com_data.*,
          CASE
            WHEN com_data.proxima < CURRENT_DATE
            THEN com_data.proxima + INTERVAL '1 year'
            ELSE com_data.proxima
          END::date AS proxima_data
        FROM com_data
      )
      SELECT
        "oficialId",
        nome,
        "nomePreferido",
        celular,
        telefone,
        email,
        "cargoNome",
        "unidadeNome",
        "unidadeTipo",
        nascimento::text        AS "dataNascimento",
        dia,
        mes,
        (
          EXTRACT(YEAR FROM AGE(CURRENT_DATE, nascimento))::int
          + CASE
              WHEN proxima_data > CURRENT_DATE THEN 1
              ELSE 0
            END
        )                       AS "idadeCompleta",
        (proxima_data - CURRENT_DATE)::int AS "diasAte"
      FROM ajustada
      WHERE (
              CAST(:mes AS int) IS NULL
              AND (proxima_data - CURRENT_DATE) <= CAST(:dias AS int)
            )
         OR (
              CAST(:mes AS int) IS NOT NULL
              AND mes = CAST(:mes AS int)
            )
      ORDER BY
        CASE
          WHEN CAST(:mes AS int) IS NULL THEN proxima_data
          ELSE make_date(
            2000,
            mes,
            dia
          )
        END,
        nome
    `,
    {
      replacements: {
        mes,
        dias: janela
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function resumo(
  mes: number
): Promise<ResumoOficiais> {

  const porCargo = await sequelize.query<{
    cargo: string;
    cargoNome: string;
    total: string;
  }>(
    `
      SELECT
        cl.codigo           AS cargo,
        cl.nome             AS "cargoNome",
        count(*)::text      AS total
      FROM legio.membro_cargo_unidade mcu
      JOIN legio.cargo_legionario cl
        ON cl.id = mcu.cargo_id
      WHERE mcu.ativo = TRUE
        AND cl.eh_oficial = TRUE
        AND cl.ativo = TRUE
        AND (
              mcu.data_fim IS NULL
              OR mcu.data_fim >= CURRENT_DATE
            )
      GROUP BY cl.codigo, cl.nome, cl.ordem_exibicao
      ORDER BY cl.ordem_exibicao NULLS LAST
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const aniversariantesMes = await aniversariantes(mes, 30);

  const total = porCargo.reduce(
    (soma, item) => soma + Number(item.total),
    0
  );

  const linhas = await sequelize.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM legio.membro_cargo_unidade
      WHERE ativo = TRUE
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  return {
    total,
    totalCargos: Number(linhas[0]?.total ?? 0),
    porCargo: porCargo.map((item) => ({
      cargo: item.cargo,
      cargoNome: item.cargoNome,
      total: Number(item.total)
    })),
    aniversariantesMes: aniversariantesMes.length
  };
}

/** Cargos oficiais, para o filtro da tela. */
export async function listarCargos(): Promise<
  Array<{ codigo: string; nome: string }>
> {
  return sequelize.query<{ codigo: string; nome: string }>(
    `
      SELECT codigo, nome
      FROM legio.cargo_legionario
      WHERE ativo = TRUE
        AND eh_oficial = TRUE
      ORDER BY ordem_exibicao NULLS LAST, nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );
}