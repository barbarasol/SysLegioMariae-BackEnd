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

  /** Obrigatorio quando origem = MEMBRO_EXISTENTE. */
  membroId?: string | null;

  /** Obrigatorios quando origem = PESSOA_NOVA. */
  pessoaNome?: string | null;
  pessoaNomePreferido?: string | null;
  pessoaCpf?: string | null;
  pessoaDataNascimento?: string | null;
  pessoaEmail?: string | null;
  pessoaCelular?: string | null;
  pessoaTelefone?: string | null;

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
          WHEN so.membro_id IS NOT NULL THEN 'MEMBRO_EXISTENTE'
          ELSE 'PESSOA_NOVA'
        END                                AS origem,

        so.status,

        so.membro_id::text                 AS "membroId",
        p.id::text                         AS "pessoaId",

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
        ON p.id = m.pessoa_id

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

/** Busca de membros para vincular como oficial. */
export async function buscarMembros(
  busca: string
): Promise<Array<{
  membroId: string;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  jaEhOficial: boolean;
}>> {

  const termo = texto(busca);

  if (!termo || termo.length < 3) {
    return [];
  }

  return sequelize.query(
    `
      SELECT
        m.id::text                AS "membroId",
        p.nome,
        p.nome_preferido          AS "nomePreferido",
        p.cpf,
        p.email,
        p.celular,
        EXISTS (
          SELECT 1
          FROM legio.membro_cargo_unidade mcu
          WHERE mcu.membro_id = m.id
            AND mcu.ativo = TRUE
        )                         AS "jaEhOficial"

      FROM legio.membro m
      JOIN legio.pessoa p
        ON p.id = m.pessoa_id

      WHERE m.status = 'ATIVO'
        AND (
              p.nome ILIKE '%' || CAST(:termo AS varchar) || '%'
              OR p.cpf ILIKE '%' || CAST(:termo AS varchar) || '%'
              OR p.email ILIKE '%' || CAST(:termo AS varchar) || '%'
            )

      ORDER BY p.nome
      LIMIT 20
    `,
    {
      replacements: { termo },
      type: QueryTypes.SELECT
    }
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
  let pessoaNome: string | null = null;

  if (origem === 'MEMBRO_EXISTENTE') {

    membroId = texto(input.membroId);

    if (!membroId || !/^\d+$/.test(membroId)) {
      throw new HttpError(400, 'Selecione um membro valido.');
    }

    const membros = await sequelize.query<{ id: string }>(
      `
        SELECT id::text
        FROM legio.membro
        WHERE id = CAST(:membroId AS bigint)
        LIMIT 1
      `,
      {
        replacements: { membroId },
        type: QueryTypes.SELECT
      }
    );

    if (membros.length === 0) {
      throw new HttpError(404, 'Membro nao encontrado.');
    }

  } else {

    pessoaNome = texto(input.pessoaNome);

    if (!pessoaNome) {
      throw new HttpError(400, 'Informe o nome da pessoa.');
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

  const inseridas = await sequelize.query<{ id: string }>(
    `
      INSERT INTO legio.solicitacao_oficial
        (
          membro_id,
          pessoa_nome,
          pessoa_nome_preferido,
          pessoa_cpf,
          pessoa_data_nascimento,
          pessoa_email,
          pessoa_celular,
          pessoa_telefone,
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
          :pessoaNome,
          :pessoaNomePreferido,
          :pessoaCpf,
          CAST(:nascimento AS date),
          :pessoaEmail,
          :pessoaCelular,
          :pessoaTelefone,
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
        pessoaNome,
        pessoaNomePreferido: texto(input.pessoaNomePreferido),
        pessoaCpf: texto(input.pessoaCpf),
        pessoaEmail: texto(input.pessoaEmail),
        pessoaCelular: texto(input.pessoaCelular),
        pessoaTelefone: texto(input.pessoaTelefone),
        nascimento,
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
      status: string;
      pessoa_nome: string | null;
      pessoa_nome_preferido: string | null;
      pessoa_cpf: string | null;
      pessoa_data_nascimento: string | null;
      pessoa_email: string | null;
      pessoa_celular: string | null;
      pessoa_telefone: string | null;
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
          status,
          pessoa_nome,
          pessoa_nome_preferido,
          pessoa_cpf,
          pessoa_data_nascimento::text,
          pessoa_email,
          pessoa_celular,
          pessoa_telefone,
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

    // Pessoa nova: cria pessoa e membro agora.
    if (!membroId) {

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
              telefone
            )
          VALUES
            (
              :nome,
              :nomePreferido,
              :cpf,
              CAST(:nascimento AS date),
              :email,
              :celular,
              :telefone
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
            telefone: solicitacao.pessoa_telefone
          },
          type: QueryTypes.SELECT,
          transaction
        }
      );

      const pessoaId = pessoas[0].id;

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
            pessoaId,
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