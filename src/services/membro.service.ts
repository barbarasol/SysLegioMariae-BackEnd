import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

type CategoriaRow = {
  id: number;
  codigo: string;
};

type CargoRow = {
  id: number;
  codigo: string;
};

type UnidadeRow = {
  id: string;
  nome: string;
  tipo: string;
};

export type CatalogosMembro = {
  categorias: Array<{ codigo: string; nome: string }>;
  cargos: Array<{
    codigo: string;
    nome: string;
    ehOficial: boolean;
  }>;
  unidades: Array<{
    id: string;
    nome: string;
    tipo: string;
    cidade: string | null;
    estadoRegiao: string | null;
  }>;
};

/**
 * Categorias, cargos e unidades numa única chamada — alimenta todos
 * os selects do formulário de membro sem três requisições.
 */
export async function catalogos(): Promise<CatalogosMembro> {

  const categorias = await sequelize.query<{
    codigo: string;
    nome: string;
  }>(
    `
      SELECT codigo, nome
      FROM legio.categoria_membro
      WHERE ativo = TRUE
      ORDER BY nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const cargos = await sequelize.query<{
    codigo: string;
    nome: string;
    ehOficial: boolean;
  }>(
    `
      SELECT
        codigo,
        nome,
        eh_oficial AS "ehOficial"
      FROM legio.cargo_legionario
      WHERE ativo = TRUE
      ORDER BY ordem_exibicao NULLS LAST, nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const unidades = await sequelize.query<{
    id: string;
    nome: string;
    tipo: string;
    cidade: string | null;
    estadoRegiao: string | null;
  }>(
    `
      SELECT
        ul.id::text,
        ul.nome,
        tu.codigo   AS tipo,
        ul.cidade,
        ul.estado_regiao AS "estadoRegiao"
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

  return {
    categorias,
    cargos,
    unidades
  };
}

export type MembroListado = {
  id: string;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  status: string;
  categoria: string | null;
  categoriaNome: string | null;
  unidadeId: string | null;
  unidadeNome: string | null;
  unidadeTipo: string | null;
  cargo: string | null;
  cargoNome: string | null;
  dtIngresso: string | null;
  dtCompromisso: string | null;
  pretoriano: boolean;
  adjutor: boolean;
  mesc: boolean;
  catequista: boolean;
  coroinha: boolean;
  totalUnidades: number;
};

export type ResumoMembros = {
  total: number;
  ativos: number;
  inativos: number;
  falecidos: number;
};

export type FiltrosMembros = {
  busca?: string | null;
  status?: string | null;
  unidadeId?: string | null;
  categoriaCodigo?: string | null;
};

const STATUS_MEMBRO_PERMITIDOS = [
  'ATIVO',
  'INATIVO',
  'FALECIDO'
];

/**
 * Lista os membros com os dados da pessoa, o vínculo principal
 * e o cargo ativo — tudo já resolvido para a tabela.
 */
export async function listar(
  filtros: FiltrosMembros = {}
): Promise<MembroListado[]> {

  const busca = texto(filtros.busca);
  const status = texto(filtros.status)?.toUpperCase() ?? null;
  const unidadeId = texto(filtros.unidadeId);
  const categoria = texto(filtros.categoriaCodigo)?.toUpperCase() ?? null;

  if (status && !STATUS_MEMBRO_PERMITIDOS.includes(status)) {
    throw new HttpError(400, 'Informe um status de membro válido.');
  }

  if (unidadeId && !/^\d+$/.test(unidadeId)) {
    throw new HttpError(400, 'Informe uma unidade válida.');
  }

  return sequelize.query<MembroListado>(
    `
      SELECT
        m.id::text,
        p.nome,
        p.nome_preferido              AS "nomePreferido",
        p.cpf,
        p.email,
        p.celular,
        m.status,
        cat.codigo                    AS categoria,
        cat.nome                      AS "categoriaNome",
        ul.id::text                   AS "unidadeId",
        ul.nome                       AS "unidadeNome",
        tu.codigo                     AS "unidadeTipo",
        cargo.codigo                  AS cargo,
        cargo.nome                    AS "cargoNome",
        m.dt_ingresso                 AS "dtIngresso",
        m.dt_compromisso              AS "dtCompromisso",
        m.pretoriano,
        m.adjutor,
        m.mesc,
        m.catequista,
        m.coroinha,
        (
          SELECT count(*)
            FROM legio.membro_unidade mu2
           WHERE mu2.membro_id = m.id
             AND mu2.ativo = TRUE
        )::int                        AS "totalUnidades"
      FROM legio.membro m
      JOIN legio.pessoa p
        ON p.id = m.pessoa_id

      -- Vínculo principal (o mais recente quando houver mais de um)
      LEFT JOIN LATERAL (
        SELECT
          mu.unidade_id,
          mu.categoria_membro_id
        FROM legio.membro_unidade mu
        WHERE mu.membro_id = m.id
          AND mu.ativo = TRUE
        ORDER BY mu.principal DESC, mu.data_inicio DESC NULLS LAST
        LIMIT 1
      ) vinculo ON TRUE

      LEFT JOIN legio.categoria_membro cat
        ON cat.id = vinculo.categoria_membro_id

      LEFT JOIN legio.unidade_legionaria ul
        ON ul.id = vinculo.unidade_id

      LEFT JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id

      -- Cargo ativo na unidade do vínculo
      LEFT JOIN LATERAL (
        SELECT
          cl.codigo,
          cl.nome
        FROM legio.membro_cargo_unidade mcu
        JOIN legio.cargo_legionario cl
          ON cl.id = mcu.cargo_id
        WHERE mcu.membro_id = m.id
          AND mcu.ativo = TRUE
          AND (
                CAST(:unidadeIdFiltro AS bigint) IS NULL
                OR mcu.unidade_id =
                   CAST(:unidadeIdFiltro AS bigint)
              )
        ORDER BY mcu.data_inicio DESC NULLS LAST
        LIMIT 1
      ) cargo ON TRUE

      WHERE (
              CAST(:busca AS varchar) IS NULL
              OR p.nome ILIKE '%' || CAST(:busca AS varchar) || '%'
              OR p.nome_preferido ILIKE '%' || CAST(:busca AS varchar) || '%'
              OR p.cpf ILIKE '%' || CAST(:busca AS varchar) || '%'
              OR p.email ILIKE '%' || CAST(:busca AS varchar) || '%'
            )
        AND (
              CAST(:status AS varchar) IS NULL
              OR m.status = CAST(:status AS varchar)
            )
        AND (
              CAST(:categoria AS varchar) IS NULL
              OR cat.codigo = CAST(:categoria AS varchar)
            )
        AND (
              CAST(:unidadeId AS bigint) IS NULL
              OR vinculo.unidade_id = CAST(:unidadeId AS bigint)
            )
      ORDER BY p.nome
    `,
    {
      replacements: {
        busca,
        status,
        categoria,
        unidadeId,
        unidadeIdFiltro: unidadeId
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function resumo(): Promise<ResumoMembros> {

  const linhas = await sequelize.query<{
    status: string;
    total: string;
  }>(
    `
      SELECT
        status,
        count(*)::text AS total
      FROM legio.membro
      GROUP BY status
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const resultado: ResumoMembros = {
    total: 0,
    ativos: 0,
    inativos: 0,
    falecidos: 0
  };

  for (const linha of linhas) {
    const total = Number(linha.total);

    resultado.total += total;

    if (linha.status === 'ATIVO') {
      resultado.ativos = total;
    }

    if (linha.status === 'INATIVO') {
      resultado.inativos = total;
    }

    if (linha.status === 'FALECIDO') {
      resultado.falecidos = total;
    }
  }

  return resultado;
}

export type CriarMembroInput = {
  // Pessoa
  nome: string;
  nomePreferido?: string | null;
  cpf?: string | null;
  rg?: string | null;
  dataNascimento?: string | null;
  email?: string | null;
  celular?: string | null;
  telefone?: string | null;

  // Membro
  dtRecrutamento?: string | null;
  dtIngresso?: string | null;
  dtCompromisso?: string | null;
  formacaoEscolar?: string | null;
  aposentado?: boolean;
  pretoriano?: boolean;
  adjutor?: boolean;
  mesc?: boolean;
  catequista?: boolean;
  coroinha?: boolean;
  status?: string | null;
  observacao?: string | null;

  // Vínculo com unidade
  unidadeId: string;
  categoriaCodigo: string;
  principal?: boolean;
  dataInicio?: string | null;

  // Cargo (opcional)
  cargoCodigo?: string | null;
  numeroMandato?: number | null;

  // Quem está cadastrando — vem do token, gravado na auditoria
  solicitanteUsuarioId: string;
};

export type MembroCriado = {
  membro: {
    id: string;
    status: string;
  };
  pessoa: {
    id: string;
    nome: string;
  };
  unidade: {
    id: string;
    nome: string;
  };
  categoria: string;
  cargo: string | null;
};

const STATUS_PERMITIDOS = ['ATIVO', 'INATIVO', 'FALECIDO'];

function texto(valor: unknown): string | null {
  const limpo = String(valor ?? '').trim();
  return limpo === '' ? null : limpo;
}

function booleano(valor: unknown): boolean {
  return valor === true || valor === 'true' || valor === 1;
}

async function resolverCategoria(
  codigo: string
): Promise<CategoriaRow> {

  const categorias = await sequelize.query<CategoriaRow>(
    `
      SELECT id, codigo
      FROM legio.categoria_membro
      WHERE codigo = :codigo
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: { codigo },
      type: QueryTypes.SELECT
    }
  );

  const categoria = categorias[0];

  if (!categoria) {
    throw new HttpError(
      400,
      `Categoria de membro não encontrada ou inativa: ${codigo}.`
    );
  }

  return categoria;
}

async function resolverCargo(
  codigo: string | null
): Promise<CargoRow | null> {

  if (!codigo) {
    return null;
  }

  const cargos = await sequelize.query<CargoRow>(
    `
      SELECT id, codigo
      FROM legio.cargo_legionario
      WHERE codigo = :codigo
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: { codigo },
      type: QueryTypes.SELECT
    }
  );

  const cargo = cargos[0];

  if (!cargo) {
    throw new HttpError(
      400,
      `Cargo não encontrado ou inativo: ${codigo}.`
    );
  }

  return cargo;
}

async function validarUnidade(
  unidadeId: string
): Promise<UnidadeRow> {

  if (!/^\d+$/.test(unidadeId)) {
    throw new HttpError(400, 'Informe uma unidade válida.');
  }

  const unidades = await sequelize.query<UnidadeRow>(
    `
      SELECT
        ul.id::text,
        ul.nome,
        tu.codigo AS tipo
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      WHERE ul.id = CAST(:unidadeId AS bigint)
        AND ul.ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: { unidadeId },
      type: QueryTypes.SELECT
    }
  );

  const unidade = unidades[0];

  if (!unidade) {
    throw new HttpError(
      400,
      'Unidade informada não foi encontrada ou está inativa.'
    );
  }

  return unidade;
}

export async function criar(
  input: CriarMembroInput
): Promise<MembroCriado> {

  const nome = String(input.nome ?? '').trim();
  const status = (
    texto(input.status) ?? 'ATIVO'
  ).toUpperCase();

  if (!nome) {
    throw new HttpError(400, 'Informe o nome do membro.');
  }

  if (!STATUS_PERMITIDOS.includes(status)) {
    throw new HttpError(400, 'Status de membro inválido.');
  }

  const unidadeId = String(input.unidadeId ?? '').trim();

  if (!unidadeId) {
    throw new HttpError(400, 'Selecione a unidade do membro.');
  }

  const categoriaCodigo = String(
    input.categoriaCodigo ?? ''
  )
    .trim()
    .toUpperCase();

  if (!categoriaCodigo) {
    throw new HttpError(400, 'Selecione a categoria do membro.');
  }

  const categoria = await resolverCategoria(categoriaCodigo);
  const cargo = await resolverCargo(
    texto(input.cargoCodigo)?.toUpperCase() ?? null
  );
  const unidade = await validarUnidade(unidadeId);

  const cpf = texto(input.cpf);
  const email = texto(input.email);

  // O schema exige CPF único por dígitos.
  if (cpf) {
    const pessoas = await sequelize.query<{ id: string }>(
      `
        SELECT id::text
        FROM legio.pessoa
        WHERE regexp_replace(cpf, '[^0-9]', '', 'g') =
              regexp_replace(:cpf, '[^0-9]', '', 'g')
        LIMIT 1
      `,
      {
        replacements: { cpf },
        type: QueryTypes.SELECT
      }
    );

    if (pessoas.length > 0) {
      throw new HttpError(
        409,
        'Já existe uma pessoa cadastrada com este CPF.'
      );
    }
  }

  return sequelize.transaction(async (transaction) => {

    const pessoas = await sequelize.query<{
      id: string;
      nome: string;
    }>(
      `
        INSERT INTO legio.pessoa
          (
            nome,
            nome_preferido,
            data_nascimento,
            cpf,
            rg,
            email,
            celular,
            telefone,
            ativo
          )
        VALUES
          (
            :nome,
            :nomePreferido,
            CAST(:dataNascimento AS date),
            :cpf,
            :rg,
            :email,
            :celular,
            :telefone,
            TRUE
          )
        RETURNING id::text, nome
      `,
      {
        replacements: {
          nome,
          nomePreferido: texto(input.nomePreferido),
          dataNascimento: texto(input.dataNascimento),
          cpf,
          rg: texto(input.rg),
          email,
          celular: texto(input.celular),
          telefone: texto(input.telefone)
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const pessoa = pessoas[0];

    const membros = await sequelize.query<{
      id: string;
      status: string;
    }>(
      `
        INSERT INTO legio.membro
          (
            pessoa_id,
            dt_recrutamento,
            dt_ingresso,
            dt_compromisso,
            formacao_escolar,
            aposentado,
            pretoriano,
            adjutor,
            mesc,
            catequista,
            coroinha,
            status,
            observacao
          )
        VALUES
          (
            CAST(:pessoaId AS bigint),
            CAST(:dtRecrutamento AS date),
            CAST(:dtIngresso AS date),
            CAST(:dtCompromisso AS date),
            :formacaoEscolar,
            :aposentado,
            :pretoriano,
            :adjutor,
            :mesc,
            :catequista,
            :coroinha,
            :status,
            :observacao
          )
        RETURNING id::text, status
      `,
      {
        replacements: {
          pessoaId: pessoa.id,
          dtRecrutamento: texto(input.dtRecrutamento),
          dtIngresso: texto(input.dtIngresso),
          dtCompromisso: texto(input.dtCompromisso),
          formacaoEscolar: texto(input.formacaoEscolar),
          aposentado: booleano(input.aposentado),
          pretoriano: booleano(input.pretoriano),
          adjutor: booleano(input.adjutor),
          mesc: booleano(input.mesc),
          catequista: booleano(input.catequista),
          coroinha: booleano(input.coroinha),
          status,
          observacao: texto(input.observacao)
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const membro = membros[0];

    // O índice ux_membro_unidade_ativo exige um único vínculo
    // ativo por membro+unidade.
    await sequelize.query(
      `
        INSERT INTO legio.membro_unidade
          (
            membro_id,
            unidade_id,
            categoria_membro_id,
            principal,
            ativo,
            data_inicio
          )
        VALUES
          (
            CAST(:membroId AS bigint),
            CAST(:unidadeId AS bigint),
            :categoriaId,
            :principal,
            TRUE,
            CAST(:dataInicio AS date)
          )
      `,
      {
        replacements: {
          membroId: membro.id,
          unidadeId: unidade.id,
          categoriaId: categoria.id,
          principal: input.principal !== false,
          dataInicio: texto(input.dataInicio)
        },
        transaction
      }
    );

    if (cargo) {
      // data_inicio é NOT NULL em membro_cargo_unidade.
      await sequelize.query(
        `
          INSERT INTO legio.membro_cargo_unidade
            (
              membro_id,
              unidade_id,
              cargo_id,
              numero_mandato,
              data_inicio,
              ativo
            )
          VALUES
            (
              CAST(:membroId AS bigint),
              CAST(:unidadeId AS bigint),
              :cargoId,
              :numeroMandato,
              COALESCE(
                CAST(:dataInicio AS date),
                CURRENT_DATE
              ),
              TRUE
            )
        `,
        {
          replacements: {
            membroId: membro.id,
            unidadeId: unidade.id,
            cargoId: cargo.id,
            numeroMandato: input.numeroMandato ?? null,
            dataInicio: texto(input.dataInicio)
          },
          transaction
        }
      );
    }

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
            CAST(:usuarioId AS bigint),
            CAST(:unidadeId AS bigint),
            'MEMBRO_CRIADO',
            'legio.membro',
            :entidadeId,
            CAST(:dadosDepois AS jsonb)
          )
      `,
      {
        replacements: {
          usuarioId: input.solicitanteUsuarioId,
          unidadeId: unidade.id,
          entidadeId: membro.id,
          dadosDepois: JSON.stringify({
            nome,
            categoria: categoria.codigo,
            cargo: cargo?.codigo ?? null,
            status
          })
        },
        transaction
      }
    );

    return {
      membro: {
        id: membro.id,
        status: membro.status
      },
      pessoa: {
        id: pessoa.id,
        nome: pessoa.nome
      },
      unidade: {
        id: unidade.id,
        nome: unidade.nome
      },
      categoria: categoria.codigo,
      cargo: cargo?.codigo ?? null
    };
  });
}
