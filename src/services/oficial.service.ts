import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { unidadesPermitidas, exigirUnidadePermitida } from './hierarquia-acesso.service.js';

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
  /** Meses completos desde o inicio do mandato. */
  mesesMandato: number | null;
  /** Fim previsto do mandato: 12 meses apos o inicio. */
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
  tipoUnidade?: string | null;
  cargo?: string | null;
  somenteVigentes?: boolean;
};

/** Meses de um mandato legionario padrao. */
const MESES_MANDATO = 12;

function texto(valor: unknown): string | null {
  const limpo = String(valor ?? '').trim();
  return limpo === '' ? null : limpo;
}

/**
 * Lista de oficiais: quem tem cargo ativo em membro_cargo_unidade.
 *
 * "Oficial" nao e um tipo de pessoa no schema  -  e o vinculo entre
 * um membro, uma unidade e um cargo oficial.
 */
export async function listar(
  usuarioId: string, filtros: FiltrosOficiais = {}
): Promise<OficialListado[]> {

  const busca = texto(filtros.busca);
  const unidadeId = texto(filtros.unidadeId);
  const cargo = texto(filtros.cargo)?.toUpperCase() ?? null;
  const tipoUnidade = texto(filtros.tipoUnidade)?.toUpperCase() ?? null;
  const somenteVigentes = filtros.somenteVigentes === true;

  if (unidadeId && !/^\d+$/.test(unidadeId)) {
    throw new HttpError(400, 'Informe uma unidade valida.');
  }

  const unidades = await unidadesPermitidas(usuarioId);
  const ids = unidades.map(u => u.id);
  if (unidadeId && !ids.includes(unidadeId)) throw new HttpError(403, 'Unidade não autorizada.');
  if (!ids.length) return [];

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
        AND ul.id IN (:ids)
        AND (CAST(:tipoUnidade AS varchar) IS NULL OR tu.codigo = CAST(:tipoUnidade AS varchar))
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
        tipoUnidade,
        ids,
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
 * `mes` filtra por um mes especifico (1-12); quando nulo, devolve
 * os proximos `dias` a contar de hoje.
 */
export async function aniversariantes(
  usuarioId: string, mes: number | null, dias: number,
  filtros: { unidadeId?: string | null; tipoUnidade?: string | null } = {}
): Promise<Aniversariante[]> {

  if (mes !== null && (mes < 1 || mes > 12)) {
    throw new HttpError(400, 'Informe um mes entre 1 e 12.');
  }

  const janela = Number.isFinite(dias) && dias > 0 ? dias : 30;
  const unidades = await unidadesPermitidas(usuarioId);
  const ids = unidades.map(u => u.id);
  const unidadeId = texto(filtros.unidadeId);
  const tipoUnidade = texto(filtros.tipoUnidade)?.toUpperCase() ?? null;
  if (unidadeId && !ids.includes(unidadeId)) throw new HttpError(403, 'Unidade não autorizada.');
  if (!ids.length) return [];

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
          AND ul.id IN (:ids)
          AND (CAST(:unidadeId AS bigint) IS NULL OR ul.id = CAST(:unidadeId AS bigint))
          AND (CAST(:tipoUnidade AS varchar) IS NULL OR tu.codigo = CAST(:tipoUnidade AS varchar))
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
          -- Proxima ocorrencia do aniversario a partir de hoje.
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
        ids, unidadeId, tipoUnidade,
        dias: janela
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function resumo(
  usuarioId: string, mes: number,
  filtros: { unidadeId?: string | null; tipoUnidade?: string | null } = {}
): Promise<ResumoOficiais> {
  const unidades = await unidadesPermitidas(usuarioId);
  const ids = unidades.map(u => u.id);
  const unidadeId = texto(filtros.unidadeId);
  const tipoUnidade = texto(filtros.tipoUnidade)?.toUpperCase() ?? null;
  if (unidadeId && !ids.includes(unidadeId)) throw new HttpError(403, 'Unidade não autorizada.');
  if (!ids.length) return { total: 0, totalCargos: 0, porCargo: [], aniversariantesMes: 0 };

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
      JOIN legio.unidade_legionaria ul ON ul.id = mcu.unidade_id
      JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
      WHERE ul.id IN (:ids)
        AND (CAST(:unidadeId AS bigint) IS NULL OR ul.id = CAST(:unidadeId AS bigint))
        AND (CAST(:tipoUnidade AS varchar) IS NULL OR tu.codigo = CAST(:tipoUnidade AS varchar))
        AND mcu.ativo = TRUE
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
      replacements: { ids, unidadeId, tipoUnidade },
      type: QueryTypes.SELECT
    }
  );

  const aniversariantesMes = await aniversariantes(usuarioId, mes, 30, filtros);

  const total = porCargo.reduce(
    (soma, item) => soma + Number(item.total),
    0
  );

  const linhas = await sequelize.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM legio.membro_cargo_unidade mcu
      JOIN legio.unidade_legionaria ul ON ul.id = mcu.unidade_id
      JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
      WHERE mcu.ativo = TRUE
        AND ul.id IN (:ids)
        AND (CAST(:unidadeId AS bigint) IS NULL OR ul.id = CAST(:unidadeId AS bigint))
        AND (CAST(:tipoUnidade AS varchar) IS NULL OR tu.codigo = CAST(:tipoUnidade AS varchar))
    `,
    {
      replacements: { ids, unidadeId, tipoUnidade },
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

/**
 * Encerra o mandato de um oficial.
 *
 * O "id" recebido e o id do vinculo em membro_cargo_unidade, nao
 * o id do membro. A exclusao e logica: o vinculo vira inativo e
 * recebe data_fim, preservando o historico de quem ocupou o cargo.
 */
export async function encerrar(
  usuarioId: string, vinculoId: string
): Promise<void> {

  if (!/^\d+$/.test(vinculoId)) {
    throw new HttpError(400, 'Informe um oficial valido.');
  }

  const linhas = await sequelize.query<{ id: string; ativo: boolean; unidade_id: string }>(
    `
      SELECT id::text, ativo, unidade_id::text
      FROM legio.membro_cargo_unidade
      WHERE id = CAST(:vinculoId AS bigint)
      LIMIT 1
    `,
    {
      replacements: { vinculoId },
      type: QueryTypes.SELECT
    }
  );

  const vinculo = linhas[0];

  if (!vinculo) {
    throw new HttpError(404, 'Vinculo de cargo nao encontrado.');
  }

  await exigirUnidadePermitida(usuarioId, vinculo.unidade_id, 'EDITAR');

  if (!vinculo.ativo) {
    throw new HttpError(409, 'Este mandato ja esta encerrado.');
  }

  await sequelize.query(
    `
      UPDATE legio.membro_cargo_unidade
         SET ativo = FALSE,
             data_fim = coalesce(data_fim, CURRENT_DATE),
             updated_at = CURRENT_TIMESTAMP
       WHERE id = CAST(:vinculoId AS bigint)
    `,
    {
      replacements: { vinculoId }
    }
  );
}

export type AtualizarOficialInput = {
  nome: string;
  nomePreferido?: string | null;
  email?: string | null;
  celular?: string | null;
  telefone?: string | null;
  dataNascimento?: string | null;
  dtOrdenacaoPresbiteral?: string | null;
  municipioId?: string | null;
  subdivisaoLocalId?: string | null;
  cep?: string | null;
  localidade?: string | null;
  logradouro?: string | null;
  numeroLogradouro?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  unidadeId: string;
  cargo: string;
  numeroMandato?: number | null;
  dataInicio: string;
  dataFim?: string | null;
};

function validarData(valor: unknown, obrigatoria = false): string | null {
  const v = texto(valor);
  if (!v) {
    if (obrigatoria) throw new HttpError(400, 'Informe a data de início.');
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, 'Data inválida.');
  const [a, m, d] = v.split('-').map(Number);
  const data = new Date(Date.UTC(a,m-1,d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m-1 || data.getUTCDate() !== d)
    throw new HttpError(400, 'Data inexistente.');
  return v;
}

/** Leitura com escopo + verificação de permissão administrativa. */
export async function obter(usuarioId: string, vinculoId: string): Promise<OficialListado & { podeEditar: boolean }> {
  if (!/^\d+$/.test(vinculoId)) throw new HttpError(400, 'Oficial inválido.');
  const lista = await listar(usuarioId);
  const oficial = lista.find(o => o.id === vinculoId);
  if (!oficial) throw new HttpError(404, 'Oficial não encontrado no seu escopo.');
  const unidades = await unidadesPermitidas(usuarioId);
  const detalhes = await sequelize.query<{
    dtOrdenacaoPresbiteral: string | null; municipioId: string | null;
    subdivisaoLocalId: string | null; paisId: string | null; ufId: string | null;
    paisNome: string | null; ufNome: string | null; municipioNome: string | null;
    subdivisaoLocalNome: string | null;
    cep: string | null; localidade: string | null; logradouro: string | null;
    numeroLogradouro: string | null; complemento: string | null; bairro: string | null;
  }>(`
    SELECT p.dt_ordenacao_presbiteral::text AS "dtOrdenacaoPresbiteral",
      p.id_municipio::text AS "municipioId",
      p.subdivisao_local_id::text AS "subdivisaoLocalId",
      uf.id::text AS "ufId", pais.id::text AS "paisId",
      uf.nome AS "ufNome", pais.nome AS "paisNome", m.nome AS "municipioNome",
      sl.nome AS "subdivisaoLocalNome",
      p.cep, p.localidade, p.logradouro,
      p.numero_logradouro AS "numeroLogradouro", p.complemento, p.bairro
    FROM legio.pessoa p
    LEFT JOIN legio.municipio m ON m.id = p.id_municipio
    LEFT JOIN legio.uf uf ON uf.id = m.id_uf
    LEFT JOIN legio.pais pais ON pais.id = uf.id_pais
    LEFT JOIN legio.subdivisao_local sl ON sl.id = p.subdivisao_local_id
    WHERE p.id = CAST(:pessoaId AS bigint)
    LIMIT 1
  `, { replacements: { pessoaId: oficial.pessoaId }, type: QueryTypes.SELECT });
  return { ...oficial, ...detalhes[0], podeEditar: unidades.some(u => u.id === oficial.unidadeId && u.podeEditar) };
}

/** Edita o vínculo e os dados pessoais autorizados, sem alterar CPF ou RG. */
export async function atualizar(
  usuarioId: string, vinculoId: string, input: AtualizarOficialInput
): Promise<void> {
  if (!/^\d+$/.test(vinculoId)) throw new HttpError(400, 'Oficial inválido.');
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Dados inválidos.');
  const nome = texto(input.nome);
  const unidadeId = texto(input.unidadeId);
  const cargo = texto(input.cargo)?.toUpperCase() ?? null;
  const inicio = validarData(input.dataInicio, true);
  const fim = validarData(input.dataFim);
  const numero = input.numeroMandato === null || input.numeroMandato === undefined
    ? null : Number(input.numeroMandato);
  const email = texto(input.email)?.toLowerCase() ?? null;
  if (!nome || nome.length > 255) throw new HttpError(400, 'Informe um nome válido.');
  if (!unidadeId || !/^\d+$/.test(unidadeId)) throw new HttpError(400, 'Unidade inválida.');
  if (!cargo) throw new HttpError(400, 'Informe o cargo.');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    throw new HttpError(400, 'E-mail inválido.');
  if (numero !== null && (!Number.isSafeInteger(numero) || numero < 1 || numero > 100))
    throw new HttpError(400, 'Número do mandato inválido.');
  if (fim && inicio && fim < inicio) throw new HttpError(400, 'Data final anterior à inicial.');

  await sequelize.transaction(async transaction => {
    const vinculos = await sequelize.query<{ pessoa_id: string; unidade_id: string }>(`
      SELECT p.id::text AS pessoa_id, mcu.unidade_id::text AS unidade_id
      FROM legio.membro_cargo_unidade mcu
      JOIN legio.membro m ON m.id = mcu.membro_id
      JOIN legio.pessoa p ON p.id = m.pessoa_id
      WHERE mcu.id = CAST(:vinculoId AS bigint) AND mcu.ativo = TRUE
      FOR UPDATE OF mcu
    `, { replacements: { vinculoId }, transaction, type: QueryTypes.SELECT });
    const vinculo = vinculos[0];
    if (!vinculo) throw new HttpError(404, 'Vínculo ativo não encontrado.');
    await exigirUnidadePermitida(usuarioId, vinculo.unidade_id, 'EDITAR', transaction);
    await exigirUnidadePermitida(usuarioId, unidadeId, 'EDITAR', transaction);
    const cargos = await sequelize.query<{ id: number }>(`
      SELECT id FROM legio.cargo_legionario
      WHERE codigo = :cargo AND ativo = TRUE AND eh_oficial = TRUE LIMIT 1
    `, { replacements: { cargo }, transaction, type: QueryTypes.SELECT });
    if (!cargos[0]) throw new HttpError(400, 'Cargo de oficial inválido.');
    const dadosCargo = await sequelize.query<{ codigo: string; nome: string }>(`
      SELECT codigo, nome FROM legio.cargo_legionario WHERE id = :id
    `, { replacements: { id: cargos[0].id }, transaction, type: QueryTypes.SELECT });
    const diretor = !!dadosCargo[0] && (
      /DIRETOR[_\s-]*ESPIRITUAL/i.test(dadosCargo[0].codigo) ||
      /DIRETOR\s+ESPIRITUAL/i.test(dadosCargo[0].nome)
    );
    const ordenacao = validarData(input.dtOrdenacaoPresbiteral);
    if (ordenacao && !diretor) throw new HttpError(422, 'Data de ordenação é exclusiva do Diretor Espiritual.');
    const municipioId = texto(input.municipioId);
    const subdivisaoLocalId = texto(input.subdivisaoLocalId);
    if (municipioId && !/^\d+$/.test(municipioId)) throw new HttpError(400, 'Município inválido.');
    if (subdivisaoLocalId && !/^\d+$/.test(subdivisaoLocalId)) throw new HttpError(400, 'Subdivisão inválida.');
    if (subdivisaoLocalId && !municipioId) throw new HttpError(422, 'Informe o município da subdivisão.');
    if (municipioId) {
      const municipios = await sequelize.query<{ id: string }>(`
        SELECT id::text FROM legio.municipio WHERE id = CAST(:municipioId AS integer)
      `, { replacements: { municipioId }, transaction, type: QueryTypes.SELECT });
      if (!municipios.length) throw new HttpError(422, 'Município não cadastrado.');
    }
    if (subdivisaoLocalId) {
      const subdivisoes = await sequelize.query<{ id: string }>(`
        SELECT id::text FROM legio.subdivisao_local
        WHERE id = CAST(:subdivisaoLocalId AS bigint)
          AND municipio_id = CAST(:municipioId AS integer)
      `, { replacements: { subdivisaoLocalId, municipioId }, transaction, type: QueryTypes.SELECT });
      if (!subdivisoes.length) throw new HttpError(422, 'Subdivisão não pertence ao município.');
    }
    const endereco = {
      municipioId, subdivisaoLocalId,
      cep: texto(input.cep), localidade: texto(input.localidade),
      logradouro: texto(input.logradouro), numeroLogradouro: texto(input.numeroLogradouro),
      complemento: texto(input.complemento), bairro: texto(input.bairro)
    };
    const limites: Record<keyof typeof endereco, number> = {
      municipioId: 20, subdivisaoLocalId: 20, cep: 20, localidade: 120,
      logradouro: 200, numeroLogradouro: 30, complemento: 150, bairro: 120
    };
    for (const chave of Object.keys(endereco) as Array<keyof typeof endereco>) {
      if (endereco[chave] && endereco[chave]!.length > limites[chave])
        throw new HttpError(422, `Campo ${chave} excede ${limites[chave]} caracteres.`);
    }

    await sequelize.query(`
      UPDATE legio.pessoa SET nome = :nome, nome_preferido = :nomePreferido,
        email = :email, celular = :celular, telefone = :telefone,
        data_nascimento = CAST(:nascimento AS date),
        dt_ordenacao_presbiteral = CASE
          WHEN :diretor = TRUE THEN COALESCE(CAST(:ordenacao AS date), dt_ordenacao_presbiteral)
          ELSE dt_ordenacao_presbiteral END,
        id_municipio = CAST(:municipioId AS integer),
        subdivisao_local_id = CAST(:subdivisaoLocalId AS bigint),
        cep = :cep, localidade = :localidade, logradouro = :logradouro,
        numero_logradouro = :numeroLogradouro, complemento = :complemento,
        bairro = :bairro
      WHERE id = CAST(:pessoaId AS bigint)
    `, { replacements: {
      pessoaId: vinculo.pessoa_id, nome,
      nomePreferido: texto(input.nomePreferido), email,
      celular: texto(input.celular), telefone: texto(input.telefone),
      nascimento: validarData(input.dataNascimento), diretor, ordenacao, ...endereco
    }, transaction });
    await sequelize.query(`
      UPDATE legio.membro_cargo_unidade SET
        unidade_id = CAST(:unidadeId AS bigint), cargo_id = :cargoId,
        numero_mandato = :numero, data_inicio = CAST(:inicio AS date),
        data_fim = CAST(:fim AS date), updated_at = CURRENT_TIMESTAMP
      WHERE id = CAST(:vinculoId AS bigint) AND ativo = TRUE
    `, { replacements: {
      vinculoId, unidadeId, cargoId: cargos[0].id,
      numero, inicio, fim
    }, transaction });
  });
}

/** Tipos cadastrados, sem depender de haver oficiais ou unidades subordinadas. */
export async function listarTiposUnidades(): Promise<Array<{ codigo: string; nome: string }>> {
  return sequelize.query<{ codigo: string; nome: string }>(`
    SELECT codigo, nome FROM legio.tipo_unidade
    ORDER BY ordem_hierarquica NULLS LAST, nome
  `, { type: QueryTypes.SELECT });
}
