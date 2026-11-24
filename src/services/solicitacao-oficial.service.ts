import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

export type OrigemOficial = 'MEMBRO_EXISTENTE' | 'PESSOA_NOVA';

export type SolicitacaoOficialListada = {
  id: string;
  origem: OrigemOficial;
  status: string;

  membroId: string | null;
  pessoaId: string | null;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  telefone: string | null;
  dataNascimento: string | null;

  unidadeId: string;
  unidadeNome: string;
  unidadeTipo: string;
  cidade: string | null;
  estadoRegiao: string | null;

  cargoId: number;
  cargoCodigo: string;
  cargoNome: string;

  numeroMandato: number | null;
  dataInicio: string;
  dataFim: string | null;

  justificativa: string | null;
  resposta: string | null;

  solicitanteNome: string | null;
  solicitadoEm: Date;
  analisadorNome: string | null;
  analisadoEm: Date | null;
};

export type CriarSolicitacaoInput = {
  origem: OrigemOficial;

  /** Pessoa já cadastrada; pode ainda não possuir vínculo de membro. */
  pessoaId?: string | null;
  membroId?: string | null;

  /** Obrigatorios quando origem = PESSOA_NOVA. */
  pessoaNome?: string | null;
  pessoaNomePreferido?: string | null;
  pessoaCpf?: string | null;
  pessoaDataNascimento?: string | null;
  pessoaEmail?: string | null;
  pessoaCelular?: string | null;
  pessoaTelefone?: string | null;
  pessoaDtOrdenacaoPresbiteral?: string | null;
  pessoaMunicipioId?: string | null;
  pessoaSubdivisaoLocalId?: string | null;
  pessoaCep?: string | null;
  pessoaLogradouro?: string | null;
  pessoaNumeroLogradouro?: string | null;
  pessoaComplemento?: string | null;
  pessoaBairro?: string | null;
  pessoaLocalidade?: string | null;

  dtIngresso?: string | null;
  dtCompromisso?: string | null;
  pretoriano?: boolean;
  adjutor?: boolean;
  mesc?: boolean;
  catequista?: boolean;
  coroinha?: boolean;

  unidadeId: string;
  cargoId: number;
  numeroMandato?: number | null;
  dataInicio: string;
  dataFim?: string | null;

  justificativa?: string | null;

  solicitanteUsuarioId: string;
};

export type FiltrosSolicitacao = {
  status?: string | null;
  unidadeId?: string | null;
  busca?: string | null;
};

const STATUS_VALIDOS = [
  'PENDENTE',
  'APROVADA',
  'REJEITADA',
  'CANCELADA'
];

function texto(valor: unknown): string | null {
  const limpo = String(valor ?? '').trim();
  return limpo === '' ? null : limpo;
}

/** Valida data no formato YYYY-MM-DD. Devolve null quando vazia. */
function data(valor: unknown, campo: string): string | null {
  const bruto = texto(valor);

  if (!bruto) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto)) {
    throw new HttpError(
      400,
      `O campo ${campo} deve estar no formato AAAA-MM-DD.`
    );
  }

  const [ano, mes, dia] = bruto.split('-').map(Number);
  const teste = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    teste.getUTCFullYear() !== ano ||
    teste.getUTCMonth() !== mes - 1 ||
    teste.getUTCDate() !== dia
  ) {
    throw new HttpError(400, `Data invalida em ${campo}.`);
  }

  return bruto;
}

/**
 * Uma linha por solicitacao, com o membro (quando existente) ou os
 * dados civis informados (quando pessoa nova).
 */
export async function listar(
  filtros: FiltrosSolicitacao = {}
): Promise<SolicitacaoOficialListada[]> {

  const status = texto(filtros.status);
  const unidadeId = texto(filtros.unidadeId);
  const busca = texto(filtros.busca);

  if (status && !STATUS_VALIDOS.includes(status.toUpperCase())) {
    throw new HttpError(400, 'Status invalido.');
  }

  return sequelize.query<SolicitacaoOficialListada>(
    `
      SELECT
        so.id::text                        AS id,

        CASE
          WHEN so.pessoa_id IS NOT NULL OR so.membro_id IS NOT NULL THEN 'MEMBRO_EXISTENTE'
          ELSE 'PESSOA_NOVA'
        END                                AS origem,

        so.status,

        so.membro_id::text                 AS "membroId",
        coalesce(p.id, so.pessoa_id)::text AS "pessoaId",

        coalesce(p.nome, so.pessoa_nome)   AS nome,
        coalesce(
          p.nome_preferido,
          so.pessoa_nome_preferido
        )                                  AS "nomePreferido",
        coalesce(p.cpf, so.pessoa_cpf)     AS cpf,
        coalesce(p.email, so.pessoa_email) AS email,
        coalesce(p.celular, so.pessoa_celular)   AS celular,
        coalesce(p.telefone, so.pessoa_telefone) AS telefone,
        coalesce(
          p.data_nascimento,
          so.pessoa_data_nascimento
        )::text                            AS "dataNascimento",

        ul.id::text                        AS "unidadeId",
        ul.nome                            AS "unidadeNome",
        tu.codigo                          AS "unidadeTipo",
        ul.cidade,
        ul.estado_regiao                   AS "estadoRegiao",

        cl.id                              AS "cargoId",
        cl.codigo                          AS "cargoCodigo",
        cl.nome                            AS "cargoNome",

        so.numero_mandato                  AS "numeroMandato",
        so.data_inicio::text               AS "dataInicio",
        so.data_fim::text                  AS "dataFim",

        so.justificativa,
        so.resposta,

        solicitante.nome                   AS "solicitanteNome",
        so.solicitado_em                   AS "solicitadoEm",
        analisador.nome                    AS "analisadorNome",
        so.analisado_em                    AS "analisadoEm"

      FROM legio.solicitacao_oficial so

      LEFT JOIN legio.membro m
        ON m.id = so.membro_id

      LEFT JOIN legio.pessoa p
        ON p.id = coalesce(so.pessoa_id, m.pessoa_id)

      JOIN legio.unidade_legionaria ul
        ON ul.id = so.unidade_id

      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id

      JOIN legio.cargo_legionario cl
        ON cl.id = so.cargo_id

      LEFT JOIN legio.usuario us
        ON us.id = so.solicitante_usuario_id

      LEFT JOIN legio.pessoa solicitante
        ON solicitante.id = us.pessoa_id

      LEFT JOIN legio.usuario ua
        ON ua.id = so.analisado_por_usuario_id

      LEFT JOIN legio.pessoa analisador
        ON analisador.id = ua.pessoa_id

      WHERE (
              CAST(:status AS varchar) IS NULL
              OR so.status = CAST(:status AS varchar)
            )
        AND (
              CAST(:unidadeId AS bigint) IS NULL
              OR so.unidade_id = CAST(:unidadeId AS bigint)
            )
        AND (
              CAST(:busca AS varchar) IS NULL
              OR coalesce(p.nome, so.pessoa_nome) ILIKE
                 '%' || CAST(:busca AS varchar) || '%'
              OR coalesce(p.cpf, so.pessoa_cpf) ILIKE
                 '%' || CAST(:busca AS varchar) || '%'
              OR ul.nome ILIKE
                 '%' || CAST(:busca AS varchar) || '%'
            )

      ORDER BY
        CASE so.status WHEN 'PENDENTE' THEN 0 ELSE 1 END,
        so.solicitado_em DESC
    `,
    {
      replacements: {
        status: status ? status.toUpperCase() : null,
        unidadeId,
        busca
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function resumo(): Promise<{
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
  canceladas: number;
}> {

  const linhas = await sequelize.query<{
    status: string;
    total: string;
  }>(
    `
      SELECT status, count(*)::text AS total
      FROM legio.solicitacao_oficial
      GROUP BY status
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const contagem: Record<string, number> = {
    PENDENTE: 0,
    APROVADA: 0,
    REJEITADA: 0,
    CANCELADA: 0
  };

  for (const linha of linhas) {
    contagem[linha.status] = Number(linha.total);
  }

  return {
    pendentes: contagem.PENDENTE,
    aprovadas: contagem.APROVADA,
    rejeitadas: contagem.REJEITADA,
    canceladas: contagem.CANCELADA
  };
}

/** Busca pessoas cadastradas, independentemente do vínculo em legio.membro. */
export async function buscarMembros(busca: string): Promise<Array<{
  pessoaId: string;
  membroId: string | null;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  telefone: string | null;
  dataNascimento: string | null;
  dtOrdenacaoPresbiteral: string | null;
  municipioId: string | null;
  ufId: string | null;
  paisId: string | null;
  subdivisaoLocalId: string | null;
  cep: string | null;
  logradouro: string | null;
  numeroLogradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  localidade: string | null;
  jaEhMembro: boolean;
  jaEhOficial: boolean;
}>> {
  const termo = texto(busca);
  if (!termo || termo.length < 3) return [];

  return sequelize.query(
    `
      SELECT
        p.id::text AS "pessoaId",
        m.id::text AS "membroId",
        p.nome,
        p.nome_preferido AS "nomePreferido",
        p.cpf, p.email, p.celular, p.telefone,
        p.data_nascimento::text AS "dataNascimento",
        p.dt_ordenacao_presbiteral::text AS "dtOrdenacaoPresbiteral",
        p.id_municipio::text AS "municipioId",
        uf.id::text AS "ufId",
        pais.id::text AS "paisId",
        p.subdivisao_local_id::text AS "subdivisaoLocalId",
        p.cep, p.logradouro,
        p.numero_logradouro AS "numeroLogradouro",
        p.complemento, p.bairro, p.localidade,
        (m.id IS NOT NULL) AS "jaEhMembro",
        EXISTS (
          SELECT 1 FROM legio.membro_cargo_unidade mcu
          WHERE mcu.membro_id = m.id AND mcu.ativo = TRUE
        ) AS "jaEhOficial"
      FROM legio.pessoa p
      LEFT JOIN legio.municipio municipio ON municipio.id = p.id_municipio
      LEFT JOIN legio.uf uf ON uf.id = municipio.id_uf
      LEFT JOIN legio.pais pais ON pais.id = uf.id_pais
      LEFT JOIN LATERAL (
        SELECT m1.id FROM legio.membro m1
        WHERE m1.pessoa_id = p.id
        ORDER BY (m1.status = 'ATIVO') DESC, m1.id
        LIMIT 1
      ) m ON TRUE
      WHERE p.nome ILIKE '%' || CAST(:termo AS varchar) || '%'
         OR p.nome_preferido ILIKE '%' || CAST(:termo AS varchar) || '%'
         OR p.cpf ILIKE '%' || CAST(:termo AS varchar) || '%'
         OR p.email ILIKE '%' || CAST(:termo AS varchar) || '%'
      ORDER BY p.nome, p.id
      LIMIT 30
    `,
    { replacements: { termo }, type: QueryTypes.SELECT }
  );
}

/** Catalogos para o formulario. */
export async function catalogos(): Promise<{
  unidades: Array<{ id: string; nome: string; tipo: string; cidade: string | null }>;
  cargos: Array<{ id: number; codigo: string; nome: string }>;
}> {

  const unidades = await sequelize.query<{
    id: string;
    nome: string;
    tipo: string;
    cidade: string | null;
  }>(
    `
      SELECT
        ul.id::text AS id,
        ul.nome,
        tu.codigo   AS tipo,
        ul.cidade
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      WHERE ul.ativo = TRUE
      ORDER BY tu.ordem_hierarquica NULLS LAST, ul.nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const cargos = await sequelize.query<{
    id: number;
    codigo: string;
    nome: string;
  }>(
    `
      SELECT id, codigo, nome
      FROM legio.cargo_legionario
      WHERE eh_oficial = TRUE
        AND ativo = TRUE
      ORDER BY ordem_exibicao NULLS LAST, nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  return { unidades, cargos };
}

/**
 * Cria a solicitacao. Nada e gravado em pessoa/membro/oficial
 * aqui: tudo nasce na aprovacao.
 */
export async function criar(
  input: CriarSolicitacaoInput
): Promise<SolicitacaoOficialListada> {

  const origem = input.origem;

  if (origem !== 'MEMBRO_EXISTENTE' && origem !== 'PESSOA_NOVA') {
    throw new HttpError(
      400,
      'Informe se o oficial e um membro existente ou uma pessoa nova.'
    );
  }

  const unidadeId = texto(input.unidadeId);

  if (!unidadeId || !/^\d+$/.test(unidadeId)) {
    throw new HttpError(400, 'Informe uma unidade valida.');
  }

  const cargoId = Number(input.cargoId);

  if (!Number.isInteger(cargoId) || cargoId <= 0) {
    throw new HttpError(400, 'Informe um cargo valido.');
  }

  const dataInicio = data(input.dataInicio, 'data de inicio');
  const dataFim = data(input.dataFim, 'data de fim');
  const nascimento = data(
    input.pessoaDataNascimento,
    'data de nascimento'
  );
  const dtIngresso = data(input.dtIngresso, 'data de ingresso');
  const dtCompromisso = data(
    input.dtCompromisso,
    'data do compromisso'
  );

  if (!dataInicio) {
    throw new HttpError(400, 'Informe a data de inicio do mandato.');
  }

  const numeroMandato =
    input.numeroMandato === null || input.numeroMandato === undefined
      ? null
      : Number(input.numeroMandato);

  if (
    numeroMandato !== null &&
    (!Number.isInteger(numeroMandato) || numeroMandato <= 0)
  ) {
    throw new HttpError(
      400,
      'O numero do mandato deve ser maior que zero.'
    );
  }

  let membroId: string | null = null;
  let pessoaId: string | null = null;
  let pessoaNome: string | null = null;

  // Na origem MEMBRO_EXISTENTE, o cadastro de pessoa pode existir sem
  // legio.membro. Use os dados do banco como fotografia da solicitação,
  // sem confiar em dados pessoais enviados novamente pelo navegador.
  type PessoaExistente = {
    id: string;
    membroId: string | null;
    nome: string;
    nomePreferido: string | null;
    cpf: string | null;
    nascimento: string | null;
    email: string | null;
    celular: string | null;
    telefone: string | null;
    ordenacao: string | null;
    municipioId: string | null;
    subdivisaoLocalId: string | null;
    cep: string | null;
    logradouro: string | null;
    numeroLogradouro: string | null;
    complemento: string | null;
    bairro: string | null;
    localidade: string | null;
  };
  let pessoaExistente: PessoaExistente | null = null;

  if (origem === 'MEMBRO_EXISTENTE') {
    pessoaId = texto(input.pessoaId);
    if (!pessoaId || !/^\d+$/.test(pessoaId)) {
      throw new HttpError(400, 'Selecione uma pessoa cadastrada valida.');
    }
    const pessoas = await sequelize.query<PessoaExistente>(
      `SELECT p.id::text AS id,
              (SELECT m.id::text FROM legio.membro m
               WHERE m.pessoa_id = p.id
               ORDER BY (m.status = 'ATIVO') DESC, m.id LIMIT 1) AS "membroId",
              p.nome,
              p.nome_preferido AS "nomePreferido",
              p.cpf,
              p.data_nascimento::text AS nascimento,
              p.email, p.celular, p.telefone,
              p.dt_ordenacao_presbiteral::text AS ordenacao,
              p.id_municipio::text AS "municipioId",
              p.subdivisao_local_id::text AS "subdivisaoLocalId",
              p.cep, p.logradouro,
              p.numero_logradouro AS "numeroLogradouro",
              p.complemento, p.bairro, p.localidade
         FROM legio.pessoa p
        WHERE p.id = CAST(:pessoaId AS bigint) LIMIT 1`,
      { replacements: { pessoaId }, type: QueryTypes.SELECT }
    );
    if (pessoas.length === 0) throw new HttpError(404, 'Pessoa nao encontrada.');
    pessoaExistente = pessoas[0];
    membroId = pessoaExistente.membroId;
    pessoaNome = texto(pessoaExistente.nome)?.toLocaleUpperCase('pt-BR') ?? null;
    if (!pessoaNome) throw new HttpError(422, 'A pessoa cadastrada está sem nome. Corrija o cadastro antes de solicitar.');
  } else {
    pessoaNome = texto(input.pessoaNome)?.toLocaleUpperCase('pt-BR') ?? null;
    if (!pessoaNome) throw new HttpError(400, 'Informe o nome da pessoa.');
    // CPF já cadastrado deve ser reaproveitado pelo fluxo de pessoa existente.
    const cpfInformado = texto(input.pessoaCpf)?.replace(/\D/g, '') ?? '';
    if (cpfInformado) {
      const duplicadas = await sequelize.query<{ id: string }>(
        `SELECT id::text FROM legio.pessoa
          WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = :cpf
          LIMIT 1`,
        { replacements: { cpf: cpfInformado }, type: QueryTypes.SELECT }
      );
      if (duplicadas.length) {
        throw new HttpError(409, 'Pessoa ja cadastrada com este CPF. Utilize Pessoa ja cadastrada para evitar duplicidade.');
      }
    }
  }

  const unidadeExiste = await sequelize.query(
    `
      SELECT 1
      FROM legio.unidade_legionaria
      WHERE id = CAST(:unidadeId AS bigint)
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: { unidadeId },
      type: QueryTypes.SELECT
    }
  );

  if (unidadeExiste.length === 0) {
    throw new HttpError(404, 'Unidade nao encontrada ou inativa.');
  }

  const cargoExiste = await sequelize.query(
    `
      SELECT 1
      FROM legio.cargo_legionario
      WHERE id = :cargoId
        AND eh_oficial = TRUE
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: { cargoId },
      type: QueryTypes.SELECT
    }
  );

  if (cargoExiste.length === 0) {
    throw new HttpError(
      400,
      'O cargo informado nao e um cargo de oficial ativo.'
    );
  }

  const cargoDados = await sequelize.query<{ codigo: string; nome: string }>(
    `SELECT codigo, nome FROM legio.cargo_legionario WHERE id = :cargoId LIMIT 1`,
    { replacements: { cargoId }, type: QueryTypes.SELECT }
  );
  const cargo = cargoDados[0];
  const diretorEspiritual = Boolean(cargo && (
    /DIRETOR[_\s-]*ESPIRITUAL/i.test(cargo.codigo) ||
    /DIRETOR\s+ESPIRITUAL/i.test(cargo.nome)
  ));
  const dataOrdenacao = data(input.pessoaDtOrdenacaoPresbiteral, 'data de ordenacao presbiteral');
  if (dataOrdenacao && !diretorEspiritual) {
    throw new HttpError(422, 'Data de ordenacao presbiteral e exclusiva do Diretor Espiritual.');
  }
  if (input.pessoaSubdivisaoLocalId && !(texto(input.pessoaMunicipioId) || pessoaExistente?.municipioId)) {
    throw new HttpError(422, 'Informe o municipio para a subdivisao local.');
  }
  for (const [campo, valor] of [
    ['municipio', input.pessoaMunicipioId], ['subdivisao local', input.pessoaSubdivisaoLocalId]
  ] as const) {
    if (valor && !/^\d+$/.test(valor)) throw new HttpError(422, `Identificador invalido: ${campo}.`);
  }

  const inseridas = await sequelize.query<{ id: string }>(
    `
      INSERT INTO legio.solicitacao_oficial
        (
          membro_id,
          pessoa_id,
          pessoa_nome,
          pessoa_nome_preferido,
          pessoa_cpf,
          pessoa_data_nascimento,
          pessoa_email,
          pessoa_celular,
          pessoa_telefone,
          pessoa_dt_ordenacao_presbiteral,
          pessoa_id_municipio,
          pessoa_subdivisao_local_id,
          pessoa_cep,
          pessoa_logradouro,
          pessoa_numero_logradouro,
          pessoa_complemento,
          pessoa_bairro,
          pessoa_localidade,
          unidade_id,
          cargo_id,
          numero_mandato,
          data_inicio,
          data_fim,
          dt_ingresso,
          dt_compromisso,
          pretoriano,
          adjutor,
          mesc,
          catequista,
          coroinha,
          justificativa,
          solicitante_usuario_id
        )
      VALUES
        (
          CAST(:membroId AS bigint),
          CAST(:pessoaId AS bigint),
          :pessoaNome,
          :pessoaNomePreferido,
          :pessoaCpf,
          CAST(:nascimento AS date),
          :pessoaEmail,
          :pessoaCelular,
          :pessoaTelefone,
          CAST(:pessoaDtOrdenacaoPresbiteral AS date),
          CAST(:pessoaMunicipioId AS integer),
          CAST(:pessoaSubdivisaoLocalId AS bigint),
          :pessoaCep,
          :pessoaLogradouro,
          :pessoaNumeroLogradouro,
          :pessoaComplemento,
          :pessoaBairro,
          :pessoaLocalidade,
          CAST(:unidadeId AS bigint),
          :cargoId,
          :numeroMandato,
          CAST(:dataInicio AS date),
          CAST(:dataFim AS date),
          CAST(:dtIngresso AS date),
          CAST(:dtCompromisso AS date),
          :pretoriano,
          :adjutor,
          :mesc,
          :catequista,
          :coroinha,
          :justificativa,
          CAST(:solicitante AS bigint)
        )
      RETURNING id::text
    `,
    {
      replacements: {
        membroId,
        pessoaId,
        pessoaNome,
        pessoaNomePreferido: (pessoaExistente ? texto(pessoaExistente.nomePreferido) : texto(input.pessoaNomePreferido))?.toLocaleUpperCase('pt-BR') ?? null,
        pessoaCpf: pessoaExistente ? texto(pessoaExistente.cpf) : texto(input.pessoaCpf),
        pessoaEmail: pessoaExistente ? texto(pessoaExistente.email) : texto(input.pessoaEmail),
        pessoaCelular: pessoaExistente ? texto(pessoaExistente.celular) : texto(input.pessoaCelular),
        pessoaTelefone: pessoaExistente ? texto(pessoaExistente.telefone) : texto(input.pessoaTelefone),
        pessoaDtOrdenacaoPresbiteral: dataOrdenacao ?? (diretorEspiritual ? pessoaExistente?.ordenacao ?? null : null),
        pessoaMunicipioId: texto(input.pessoaMunicipioId) ?? (pessoaExistente ? texto(pessoaExistente.municipioId) : null),
        pessoaSubdivisaoLocalId: texto(input.pessoaSubdivisaoLocalId) ?? (pessoaExistente ? texto(pessoaExistente.subdivisaoLocalId) : null),
        pessoaCep: texto(input.pessoaCep) ?? (pessoaExistente ? texto(pessoaExistente.cep) : null),
        pessoaLogradouro: texto(input.pessoaLogradouro) ?? (pessoaExistente ? texto(pessoaExistente.logradouro) : null),
        pessoaNumeroLogradouro: texto(input.pessoaNumeroLogradouro) ?? (pessoaExistente ? texto(pessoaExistente.numeroLogradouro) : null),
        pessoaComplemento: texto(input.pessoaComplemento) ?? (pessoaExistente ? texto(pessoaExistente.complemento) : null),
        pessoaBairro: texto(input.pessoaBairro) ?? (pessoaExistente ? texto(pessoaExistente.bairro) : null),
        pessoaLocalidade: texto(input.pessoaLocalidade) ?? (pessoaExistente ? texto(pessoaExistente.localidade) : null),
        nascimento: pessoaExistente?.nascimento ?? nascimento,
        unidadeId,
        cargoId,
        numeroMandato,
        dataInicio,
        dataFim,
        dtIngresso,
        dtCompromisso,
        pretoriano: input.pretoriano === true,
        adjutor: input.adjutor === true,
        mesc: input.mesc === true,
        catequista: input.catequista === true,
        coroinha: input.coroinha === true,
        justificativa: texto(input.justificativa),
        solicitante: input.solicitanteUsuarioId
      },
      type: QueryTypes.SELECT
    }
  );

  const todas = await listar({});
  const criada = todas.find((s) => s.id === inseridas[0].id);

  if (!criada) {
    throw new HttpError(
      500,
      'Solicitacao criada, mas nao pode ser lida de volta.'
    );
  }

  return criada;
}

/**
 * Aprova a solicitacao e cria o oficial de fato.
 *
 * Quando a origem e PESSOA_NOVA, cria pessoa + membro antes do
 * vinculo. Tudo numa transacao: se qualquer passo falhar, nada
 * fica pela metade.
 */
export async function aprovar(
  id: string,
  analisadoPor: string,
  resposta?: string | null
): Promise<SolicitacaoOficialListada> {

  if (!/^\d+$/.test(id)) {
    throw new HttpError(400, 'Solicitacao invalida.');
  }

  await sequelize.transaction(async (transaction) => {

    const linhas = await sequelize.query<{
      id: string;
      membro_id: string | null;
      pessoa_id: string | null;
      status: string;
      pessoa_nome: string | null;
      pessoa_nome_preferido: string | null;
      pessoa_cpf: string | null;
      pessoa_data_nascimento: string | null;
      pessoa_email: string | null;
      pessoa_celular: string | null;
      pessoa_telefone: string | null;
      pessoa_dt_ordenacao_presbiteral: string | null;
      pessoa_id_municipio: string | null;
      pessoa_subdivisao_local_id: string | null;
      pessoa_cep: string | null;
      pessoa_logradouro: string | null;
      pessoa_numero_logradouro: string | null;
      pessoa_complemento: string | null;
      pessoa_bairro: string | null;
      pessoa_localidade: string | null;
      unidade_id: string;
      cargo_id: number;
      numero_mandato: number | null;
      data_inicio: string;
      data_fim: string | null;
      dt_ingresso: string | null;
      dt_compromisso: string | null;
      pretoriano: boolean;
      adjutor: boolean;
      mesc: boolean;
      catequista: boolean;
      coroinha: boolean;
    }>(
      `
        SELECT
          id::text,
          membro_id::text,
          pessoa_id::text,
          status,
          pessoa_nome,
          pessoa_nome_preferido,
          pessoa_cpf,
          pessoa_data_nascimento::text,
          pessoa_email,
          pessoa_celular,
          pessoa_telefone,
          pessoa_dt_ordenacao_presbiteral::text,
          pessoa_id_municipio::text,
          pessoa_subdivisao_local_id::text,
          pessoa_cep,
          pessoa_logradouro,
          pessoa_numero_logradouro,
          pessoa_complemento,
          pessoa_bairro,
          pessoa_localidade,
          unidade_id::text,
          cargo_id,
          numero_mandato,
          data_inicio::text,
          data_fim::text,
          dt_ingresso::text,
          dt_compromisso::text,
          pretoriano,
          adjutor,
          mesc,
          catequista,
          coroinha
        FROM legio.solicitacao_oficial
        WHERE id = CAST(:id AS bigint)
        FOR UPDATE
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const solicitacao = linhas[0];

    if (!solicitacao) {
      throw new HttpError(404, 'Solicitacao nao encontrada.');
    }

    if (solicitacao.status !== 'PENDENTE') {
      throw new HttpError(
        409,
        'Esta solicitacao ja foi analisada.'
      );
    }

    let membroId = solicitacao.membro_id;
    let pessoaIdExistente = solicitacao.pessoa_id;

    // Busca membro sob trava de pessoa para impedir duplicação concorrente.
    if (pessoaIdExistente) {
      const pessoasBloqueadas = await sequelize.query<{ id: string }>(
        `SELECT id::text FROM legio.pessoa
         WHERE id = CAST(:pessoaId AS bigint) FOR UPDATE`,
        { replacements: { pessoaId: pessoaIdExistente }, type: QueryTypes.SELECT, transaction }
      );
      if (!pessoasBloqueadas.length) throw new HttpError(404, 'Pessoa da solicitacao nao encontrada.');
      const membrosExistentes = await sequelize.query<{ id: string; status: string }>(
        `SELECT id::text, status FROM legio.membro
         WHERE pessoa_id = CAST(:pessoaId AS bigint)
         ORDER BY (status = 'ATIVO') DESC, id LIMIT 1`,
        { replacements: { pessoaId: pessoaIdExistente }, type: QueryTypes.SELECT, transaction }
      );
      if (membrosExistentes.length) {
        if (membrosExistentes[0].status !== 'ATIVO') {
          throw new HttpError(409, 'Pessoa vinculada a membro inativo. Regularize o cadastro antes de aprovar.');
        }
        membroId = membrosExistentes[0].id;
      }
    }

    // Só cria nova pessoa quando a solicitação realmente é de pessoa nova.
    if (!membroId && !pessoaIdExistente) {
      const cpfNovo = solicitacao.pessoa_cpf?.replace(/\D/g, '') ?? '';
      if (cpfNovo) {
        const existentes = await sequelize.query<{ id: string }>(
          `SELECT id::text FROM legio.pessoa
            WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = :cpf
            LIMIT 1`,
          { replacements: { cpf: cpfNovo }, type: QueryTypes.SELECT, transaction }
        );
        if (existentes.length) {
          throw new HttpError(409, 'Ja existe pessoa com este CPF. Regularize a solicitacao para reutilizar o cadastro existente.');
        }
      }

      const pessoas = await sequelize.query<{ id: string }>(
        `
          INSERT INTO legio.pessoa
            (
              nome,
              nome_preferido,
              cpf,
              data_nascimento,
              email,
              celular,
              telefone,
              dt_ordenacao_presbiteral, id_municipio, subdivisao_local_id,
              cep, logradouro, numero_logradouro, complemento, bairro, localidade
            )
          VALUES
            (
              :nome,
              :nomePreferido,
              :cpf,
              CAST(:nascimento AS date),
              :email,
              :celular,
              :telefone,
              CAST(:ordenacao AS date), CAST(:municipio AS integer), CAST(:subdivisao AS bigint),
              :cep, :logradouro, :numero, :complemento, :bairro, :localidade
            )
          RETURNING id::text
        `,
        {
          replacements: {
            nome: solicitacao.pessoa_nome,
            nomePreferido: solicitacao.pessoa_nome_preferido,
            cpf: solicitacao.pessoa_cpf,
            nascimento: solicitacao.pessoa_data_nascimento,
            email: solicitacao.pessoa_email,
            celular: solicitacao.pessoa_celular,
            telefone: solicitacao.pessoa_telefone,
            ordenacao: solicitacao.pessoa_dt_ordenacao_presbiteral,
            municipio: solicitacao.pessoa_id_municipio,
            subdivisao: solicitacao.pessoa_subdivisao_local_id,
            cep: solicitacao.pessoa_cep,
            logradouro: solicitacao.pessoa_logradouro,
            numero: solicitacao.pessoa_numero_logradouro,
            complemento: solicitacao.pessoa_complemento,
            bairro: solicitacao.pessoa_bairro,
            localidade: solicitacao.pessoa_localidade,
          },
          type: QueryTypes.SELECT,
          transaction
        }
      );

      pessoaIdExistente = pessoas[0].id;
    }

    // Pessoa previamente cadastrada: o endereço proposto só é aplicado
    // depois da aprovação. NULL na solicitação não apaga valores existentes.
    if (solicitacao.pessoa_id && pessoaIdExistente) {
      await sequelize.query(
        `UPDATE legio.pessoa SET
           id_municipio = COALESCE(CAST(:municipio AS integer), id_municipio),
           subdivisao_local_id = COALESCE(CAST(:subdivisao AS bigint), subdivisao_local_id),
           cep = COALESCE(:cep, cep),
           logradouro = COALESCE(:logradouro, logradouro),
           numero_logradouro = COALESCE(:numero, numero_logradouro),
           complemento = COALESCE(:complemento, complemento),
           bairro = COALESCE(:bairro, bairro),
           localidade = COALESCE(:localidade, localidade)
         WHERE id = CAST(:pessoaId AS bigint)`,
        {
          replacements: {
            pessoaId: pessoaIdExistente,
            municipio: texto(solicitacao.pessoa_id_municipio),
            subdivisao: texto(solicitacao.pessoa_subdivisao_local_id),
            cep: texto(solicitacao.pessoa_cep),
            logradouro: texto(solicitacao.pessoa_logradouro),
            numero: texto(solicitacao.pessoa_numero_logradouro),
            complemento: texto(solicitacao.pessoa_complemento),
            bairro: texto(solicitacao.pessoa_bairro),
            localidade: texto(solicitacao.pessoa_localidade)
          },
          transaction
        }
      );
    }

    if (!membroId) {
      if (!pessoaIdExistente) throw new HttpError(500, 'Pessoa nao identificada na aprovacao.');
      const membros = await sequelize.query<{ id: string }>(
        `
          INSERT INTO legio.membro
            (
              pessoa_id,
              dt_ingresso,
              dt_compromisso,
              pretoriano,
              adjutor,
              mesc,
              catequista,
              coroinha,
              status
            )
          VALUES
            (
              CAST(:pessoaId AS bigint),
              CAST(:dtIngresso AS date),
              CAST(:dtCompromisso AS date),
              :pretoriano,
              :adjutor,
              :mesc,
              :catequista,
              :coroinha,
              'ATIVO'
            )
          RETURNING id::text
        `,
        {
          replacements: {
            pessoaId: pessoaIdExistente,
            dtIngresso: solicitacao.dt_ingresso,
            dtCompromisso: solicitacao.dt_compromisso,
            pretoriano: solicitacao.pretoriano,
            adjutor: solicitacao.adjutor,
            mesc: solicitacao.mesc,
            catequista: solicitacao.catequista,
            coroinha: solicitacao.coroinha
          },
          type: QueryTypes.SELECT,
          transaction
        }
      );

      membroId = membros[0].id;
    }

    // Para um membro existente, a ordenacao pertence a pessoa e nao ao mandato.
    // A atualizacao ocorre somente quando uma data foi informada na proposta.
    if (membroId && solicitacao.pessoa_dt_ordenacao_presbiteral) {
      const diretor = await sequelize.query<{ codigo: string; nome: string }>(
        `SELECT codigo, nome FROM legio.cargo_legionario WHERE id = :cargoId`,
        { replacements: { cargoId: solicitacao.cargo_id }, type: QueryTypes.SELECT, transaction }
      );
      if (!diretor[0] || !(/DIRETOR[_\s-]*ESPIRITUAL/i.test(diretor[0].codigo) || /DIRETOR\s+ESPIRITUAL/i.test(diretor[0].nome))) {
        throw new HttpError(422, 'Ordenacao presbiteral exclusiva do Diretor Espiritual.');
      }
      await sequelize.query(`UPDATE legio.pessoa SET dt_ordenacao_presbiteral = CAST(:data AS date)
        WHERE id = (SELECT pessoa_id FROM legio.membro WHERE id = CAST(:membroId AS bigint))`,
        { replacements: { data: solicitacao.pessoa_dt_ordenacao_presbiteral, membroId }, transaction });
    }

    // Vinculo de oficial.
    await sequelize.query(
      `
        INSERT INTO legio.membro_cargo_unidade
          (
            membro_id,
            unidade_id,
            cargo_id,
            numero_mandato,
            data_inicio,
            data_fim,
            ativo
          )
        VALUES
          (
            CAST(:membroId AS bigint),
            CAST(:unidadeId AS bigint),
            :cargoId,
            :numeroMandato,
            CAST(:dataInicio AS date),
            CAST(:dataFim AS date),
            TRUE
          )
      `,
      {
        replacements: {
          membroId,
          unidadeId: solicitacao.unidade_id,
          cargoId: solicitacao.cargo_id,
          numeroMandato: solicitacao.numero_mandato,
          dataInicio: solicitacao.data_inicio,
          dataFim: solicitacao.data_fim
        },
        transaction
      }
    );

    await sequelize.query(
      `
        UPDATE legio.solicitacao_oficial
           SET status = 'APROVADA',
               resposta = :resposta,
               analisado_por_usuario_id =
                 CAST(:analisadoPor AS bigint),
               analisado_em = CURRENT_TIMESTAMP,
               membro_id = CAST(:membroId AS bigint),
               pessoa_id = (SELECT pessoa_id FROM legio.membro WHERE id = CAST(:membroId AS bigint)),
               updated_at = CURRENT_TIMESTAMP
         WHERE id = CAST(:id AS bigint)
      `,
      {
        replacements: {
          resposta: texto(resposta),
          analisadoPor,
          membroId,
          id
        },
        transaction
      }
    );

    await sequelize.query(
      `
        INSERT INTO legio.auditoria_evento
          (
            usuario_id,
            unidade_id,
            acao,
            entidade,
            entidade_id,
            dados_depois
          )
        VALUES
          (
            CAST(:analisadoPor AS bigint),
            CAST(:unidadeId AS bigint),
            'SOLICITACAO_OFICIAL_APROVADA',
            'legio.solicitacao_oficial',
            :id,
            CAST(:dados AS jsonb)
          )
      `,
      {
        replacements: {
          analisadoPor,
          unidadeId: solicitacao.unidade_id,
          id,
          dados: JSON.stringify({
            solicitacaoId: id,
            membroId,
            cargoId: solicitacao.cargo_id
          })
        },
        transaction
      }
    );
  });

  const todas = await listar({});
  const atualizada = todas.find((s) => s.id === id);

  if (!atualizada) {
    throw new HttpError(404, 'Solicitacao nao encontrada.');
  }

  return atualizada;
}

export async function rejeitar(
  id: string,
  analisadoPor: string,
  resposta?: string | null
): Promise<SolicitacaoOficialListada> {

  if (!/^\d+$/.test(id)) {
    throw new HttpError(400, 'Solicitacao invalida.');
  }

  await sequelize.transaction(async (transaction) => {

    const linhas = await sequelize.query<{
      id: string;
      status: string;
      unidade_id: string;
    }>(
      `
        SELECT id::text, status, unidade_id::text
        FROM legio.solicitacao_oficial
        WHERE id = CAST(:id AS bigint)
        FOR UPDATE
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const solicitacao = linhas[0];

    if (!solicitacao) {
      throw new HttpError(404, 'Solicitacao nao encontrada.');
    }

    if (solicitacao.status !== 'PENDENTE') {
      throw new HttpError(409, 'Esta solicitacao ja foi analisada.');
    }

    await sequelize.query(
      `
        UPDATE legio.solicitacao_oficial
           SET status = 'REJEITADA',
               resposta = :resposta,
               analisado_por_usuario_id =
                 CAST(:analisadoPor AS bigint),
               analisado_em = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = CAST(:id AS bigint)
      `,
      {
        replacements: {
          resposta: texto(resposta),
          analisadoPor,
          id
        },
        transaction
      }
    );

    await sequelize.query(
      `
        INSERT INTO legio.auditoria_evento
          (
            usuario_id,
            unidade_id,
            acao,
            entidade,
            entidade_id,
            dados_depois
          )
        VALUES
          (
            CAST(:analisadoPor AS bigint),
            CAST(:unidadeId AS bigint),
            'SOLICITACAO_OFICIAL_REJEITADA',
            'legio.solicitacao_oficial',
            :id,
            CAST(:dados AS jsonb)
          )
      `,
      {
        replacements: {
          analisadoPor,
          unidadeId: solicitacao.unidade_id,
          id,
          dados: JSON.stringify({ solicitacaoId: id })
        },
        transaction
      }
    );
  });

  const todas = await listar({});
  const atualizada = todas.find((s) => s.id === id);

  if (!atualizada) {
    throw new HttpError(404, 'Solicitacao nao encontrada.');
  }

  return atualizada;
}