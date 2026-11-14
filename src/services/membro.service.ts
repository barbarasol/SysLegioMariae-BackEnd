import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { obterEscopoMembros, obterUnidadesPermitidasMembros, garantirPraesidiumPermitido, obterPessoaDoProprioMembro } from './membro-acesso.service.js';

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
  platformOwner: boolean;
  somenteMeuCadastro: boolean;
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
export async function catalogos(usuarioId: string): Promise<CatalogosMembro> {
  const { platformOwner, somenteMeuCadastro, unidadesPermitidas } = await obterEscopoMembros(usuarioId);
  if (somenteMeuCadastro) {
    // Usuário MEMBRO não recebe catálogos de edição de vínculos/cargos.
    return { platformOwner: false, somenteMeuCadastro: true, categorias: [], cargos: [], unidades: [] };
  }
  const unidadesConsulta = unidadesPermitidas.length ? unidadesPermitidas : ['0'];

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
        municipio.nome AS cidade,
        uf.sigla AS "estadoRegiao"
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      LEFT JOIN legio.municipio municipio
        ON municipio.id = ul.municipio_id
      LEFT JOIN legio.uf uf
        ON uf.id = municipio.id_uf
      WHERE ul.ativo = TRUE
        AND tu.codigo = 'PRAESIDIUM'
        AND ul.id::text IN (:unidadesConsulta)
      ORDER BY ul.nome
    `,
    {
      replacements: { unidadesConsulta },
      type: QueryTypes.SELECT
    }
  );

  return {
    platformOwner,
    somenteMeuCadastro: false,
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
  usuarioId: string,
  filtros: FiltrosMembros = {}
): Promise<MembroListado[]> {
  const { platformOwner, somenteMeuCadastro, pessoaId, unidadesPermitidas } = await obterEscopoMembros(usuarioId);
  // Sequelize precisa de pelo menos um elemento para a cláusula IN.
  const unidadesConsulta = unidadesPermitidas.length ? unidadesPermitidas : ['0'];
  const busca = texto(filtros.busca);
  const status = texto(filtros.status)?.toUpperCase() ?? null;
  const unidadeId = texto(filtros.unidadeId);
  const categoria = texto(filtros.categoriaCodigo)?.toUpperCase() ?? null;

  if (status && !STATUS_MEMBRO_PERMITIDOS.includes(status)) {
    throw new HttpError(400, 'Informe um status de membro válido.');
  }
  if (unidadeId && somenteMeuCadastro) {
    throw new HttpError(403, 'O perfil MEMBRO não pode consultar unidades de terceiros.');
  }
  if (unidadeId) {
    garantirPraesidiumPermitido(unidadeId, unidadesPermitidas);
  }

  // PLATFORM_OWNER vê TODOS os membros, mesmo sem membro_unidade.
  // Demais perfis exigem vínculo ativo no Praesidium autorizado.
  // O LEFT JOIN LATERAL impede a perda de membros sem vínculos.
  return sequelize.query<MembroListado>(
    `
      SELECT
        m.id::text,
        p.nome,
        p.nome_preferido AS "nomePreferido",
        p.cpf,
        p.email,
        p.celular,
        m.status,
        cat.codigo AS categoria,
        cat.nome AS "categoriaNome",
        ul.id::text AS "unidadeId",
        ul.nome AS "unidadeNome",
        tu.codigo AS "unidadeTipo",
        cargo.codigo AS cargo,
        cargo.nome AS "cargoNome",
        m.dt_ingresso AS "dtIngresso",
        m.dt_compromisso AS "dtCompromisso",
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
            AND (
              :platformOwner = TRUE
              OR :somenteMeuCadastro = TRUE
              OR mu2.unidade_id::text IN (:unidadesConsulta)
            )
            AND (
              CAST(:unidadeId AS bigint) IS NULL
              OR mu2.unidade_id = CAST(:unidadeId AS bigint)
            )
        )::int AS "totalUnidades"
      FROM legio.membro m
      JOIN legio.pessoa p
        ON p.id = m.pessoa_id
      LEFT JOIN LATERAL (
        SELECT mu.unidade_id, mu.categoria_membro_id
        FROM legio.membro_unidade mu
        WHERE mu.membro_id = m.id
          AND mu.ativo = TRUE
          AND (
            :platformOwner = TRUE
            OR :somenteMeuCadastro = TRUE
            OR mu.unidade_id::text IN (:unidadesConsulta)
          )
          AND (
            CAST(:unidadeId AS bigint) IS NULL
            OR mu.unidade_id = CAST(:unidadeId AS bigint)
          )
        ORDER BY mu.principal DESC, mu.data_inicio DESC NULLS LAST, mu.id DESC
        LIMIT 1
      ) vinculo ON TRUE
      LEFT JOIN legio.unidade_legionaria ul
        ON ul.id = vinculo.unidade_id
       AND ul.ativo = TRUE
      LEFT JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
       AND tu.codigo = 'PRAESIDIUM'
      LEFT JOIN legio.categoria_membro cat
        ON cat.id = vinculo.categoria_membro_id
      LEFT JOIN LATERAL (
        SELECT cl.codigo, cl.nome
        FROM legio.membro_cargo_unidade mcu
        JOIN legio.cargo_legionario cl
          ON cl.id = mcu.cargo_id
        WHERE mcu.membro_id = m.id
          AND mcu.unidade_id = vinculo.unidade_id
          AND mcu.ativo = TRUE
        ORDER BY mcu.data_inicio DESC NULLS LAST
        LIMIT 1
      ) cargo ON TRUE
      WHERE (
        :platformOwner = TRUE
        OR (:somenteMeuCadastro = TRUE AND m.pessoa_id = CAST(:pessoaId AS bigint))
        OR (:somenteMeuCadastro = FALSE AND tu.codigo = 'PRAESIDIUM')
      )
      AND (
        CAST(:unidadeId AS bigint) IS NULL
        OR vinculo.unidade_id = CAST(:unidadeId AS bigint)
      )
      AND (
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
      ORDER BY p.nome
    `,
    {
      replacements: {
        busca, status, categoria, unidadeId, platformOwner,
        somenteMeuCadastro, pessoaId, unidadesConsulta
      },
      type: QueryTypes.SELECT
    }
  );
}

/** Resumo restrito a membros com vínculo ativo em Praesidium autorizado. */
export async function resumo(usuarioId: string): Promise<ResumoMembros> {
  const { platformOwner, somenteMeuCadastro, pessoaId, unidadesPermitidas } = await obterEscopoMembros(usuarioId);
  const unidadesConsulta = unidadesPermitidas.length ? unidadesPermitidas : ['0'];

  const linhas = await sequelize.query<{ status: string; total: string }>(
    `
      SELECT m.status, COUNT(*)::text AS total
      FROM legio.membro m
      WHERE :platformOwner = TRUE
         OR (:somenteMeuCadastro = TRUE AND m.pessoa_id = CAST(:pessoaId AS bigint))
         OR (:somenteMeuCadastro = FALSE AND EXISTS (
           SELECT 1
           FROM legio.membro_unidade mu
           JOIN legio.unidade_legionaria ul
             ON ul.id = mu.unidade_id AND ul.ativo = TRUE
           JOIN legio.tipo_unidade tu
             ON tu.id = ul.tipo_unidade_id AND tu.codigo = 'PRAESIDIUM'
           WHERE mu.membro_id = m.id
             AND mu.ativo = TRUE
             AND mu.unidade_id::text IN (:unidadesConsulta)
         ))
      GROUP BY m.status
    `,
    {
      replacements: { platformOwner, somenteMeuCadastro, pessoaId, unidadesConsulta },
      type: QueryTypes.SELECT
    }
  );

  const resultado: ResumoMembros = {
    total: 0, ativos: 0, inativos: 0, falecidos: 0
  };

  for (const linha of linhas) {
    const quantidade = Number(linha.total);
    resultado.total += quantidade;
    if (linha.status === 'ATIVO') resultado.ativos = quantidade;
    if (linha.status === 'INATIVO') resultado.inativos = quantidade;
    if (linha.status === 'FALECIDO') resultado.falecidos = quantidade;
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

  // A autorização não usa a hierarquia dos conselhos; apenas vínculo direto.
  garantirPraesidiumPermitido(
    unidadeId,
    await obterUnidadesPermitidasMembros(input.solicitanteUsuarioId)
  );

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
    // Revalida dentro da transação antes de qualquer INSERT.
    garantirPraesidiumPermitido(
      unidadeId,
      await obterUnidadesPermitidasMembros(input.solicitanteUsuarioId, transaction)
    );

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


/** Detalhes do próprio membro (nunca permite escolher um ID por parâmetro). */
export type MeuCadastroMembro = {
  id: string;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  rg: string | null;
  dataNascimento: string | null;
  email: string | null;
  celular: string | null;
  telefone: string | null;
  formacaoEscolar: string | null;
  aposentado: boolean;
  status: string;
  categoria: string | null;
  unidadeNome: string | null;
  cargoNome: string | null;
  dtIngresso: string | null;
  dtCompromisso: string | null;
  pretoriano: boolean;
  adjutor: boolean;
  mesc: boolean;
  catequista: boolean;
  coroinha: boolean;
};

export type AtualizarMeuCadastroInput = {
  nome?: string;
  nomePreferido?: string | null;
  rg?: string | null;
  dataNascimento?: string | null;
  email?: string | null;
  celular?: string | null;
  telefone?: string | null;
  formacaoEscolar?: string | null;
  aposentado?: boolean;
};

async function carregarMeuCadastroPorPessoa(
  pessoaId: string,
  transaction?: import('sequelize').Transaction
): Promise<MeuCadastroMembro> {
  const linhas = await sequelize.query<MeuCadastroMembro>(
    `
      SELECT
        COALESCE(m.id::text, '') AS id,
        p.nome,
        p.nome_preferido AS "nomePreferido",
        p.cpf,
        p.rg,
        to_char(p.data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
        p.email,
        p.celular,
        p.telefone,
        COALESCE(m.formacao_escolar, sac.formacao_escolar) AS "formacaoEscolar",
        COALESCE(m.aposentado, sac.aposentado, FALSE) AS aposentado,
        COALESCE(m.status, 'PENDENTE_VINCULO') AS status,
        cat.nome AS categoria,
        COALESCE(ul.nome, ul_acesso.nome) AS "unidadeNome",
        cargo.nome AS "cargoNome",
        to_char(m.dt_ingresso, 'YYYY-MM-DD') AS "dtIngresso",
        to_char(m.dt_compromisso, 'YYYY-MM-DD') AS "dtCompromisso",
        COALESCE(m.pretoriano, FALSE) AS pretoriano,
        COALESCE(m.adjutor, FALSE) AS adjutor,
        COALESCE(m.mesc, FALSE) AS mesc,
        COALESCE(m.catequista, FALSE) AS catequista,
        COALESCE(m.coroinha, FALSE) AS coroinha
      FROM legio.usuario u
      JOIN legio.pessoa p ON p.id = u.pessoa_id
      LEFT JOIN legio.membro m ON m.pessoa_id = p.id
      LEFT JOIN legio.usuario_solicitacao_acesso sac ON sac.usuario_id = u.id
      LEFT JOIN legio.unidade_legionaria ul_acesso
        ON ul_acesso.id = sac.unidade_id AND sac.status = 'APROVADA' 
      LEFT JOIN LATERAL (
        SELECT mu.unidade_id, mu.categoria_membro_id
        FROM legio.membro_unidade mu
        WHERE mu.membro_id = m.id AND mu.ativo = TRUE
        ORDER BY mu.principal DESC, mu.data_inicio DESC NULLS LAST, mu.id DESC
        LIMIT 1
      ) mu ON TRUE
      LEFT JOIN legio.unidade_legionaria ul ON ul.id = mu.unidade_id
      LEFT JOIN legio.categoria_membro cat ON cat.id = mu.categoria_membro_id
      LEFT JOIN LATERAL (
        SELECT cl.nome
        FROM legio.membro_cargo_unidade mcu
        JOIN legio.cargo_legionario cl ON cl.id = mcu.cargo_id
        WHERE mcu.membro_id = m.id
          AND mcu.unidade_id = mu.unidade_id
          AND mcu.ativo = TRUE
        ORDER BY mcu.data_inicio DESC NULLS LAST
        LIMIT 1
      ) cargo ON TRUE
      WHERE p.id = CAST(:pessoaId AS bigint)
      LIMIT 1
    `,
    { replacements: { pessoaId }, type: QueryTypes.SELECT, transaction }
  );
  if (!linhas[0]) {
    throw new HttpError(404, 'Seu usuário ainda não possui um cadastro de membro vinculado.');
  }
  return linhas[0];
}

export async function meuCadastro(usuarioId: string): Promise<MeuCadastroMembro> {
  const pessoaId = await obterPessoaDoProprioMembro(usuarioId);
  return carregarMeuCadastroPorPessoa(pessoaId);
}

const CAMPOS_EDITAVEIS_PROPRIOS = new Set([
  'nome', 'nomePreferido', 'rg', 'dataNascimento', 'email',
  'celular', 'telefone', 'formacaoEscolar', 'aposentado'
]);

function normalizarCampoOpcional(valor: unknown, tamanhoMaximo: number, campo: string): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') throw new HttpError(400, `O campo ${campo} deve ser texto.`);
  const limpo = valor.trim();
  if (limpo.length > tamanhoMaximo) throw new HttpError(400, `O campo ${campo} excede o tamanho permitido.`);
  return limpo || null;
}

/** PATCH exclusivo de dados próprios; evita alteração de cargo, categoria, status e unidade. */
export async function atualizarMeuCadastro(
  usuarioId: string,
  body: unknown
): Promise<MeuCadastroMembro> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Informe os dados a atualizar.');
  }
  const recebido = body as Record<string, unknown>;
  const campos = Object.keys(recebido);
  if (campos.length === 0 || campos.some((campo) => !CAMPOS_EDITAVEIS_PROPRIOS.has(campo))) {
    throw new HttpError(403, 'Somente dados pessoais e de contato autorizados podem ser alterados.');
  }

  // Evita apagar acidentalmente informações omitidas no PATCH.
  const atual = await meuCadastro(usuarioId);
  const nome = campos.includes('nome') ? normalizarCampoOpcional(recebido.nome, 180, 'nome') : atual.nome;
  if (!nome) throw new HttpError(400, 'Informe o nome completo.');
  const nomePreferido = campos.includes('nomePreferido')
    ? normalizarCampoOpcional(recebido.nomePreferido, 180, 'nomePreferido') : atual.nomePreferido;
  const rg = campos.includes('rg') ? normalizarCampoOpcional(recebido.rg, 30, 'rg') : atual.rg;
  const dataNascimento = campos.includes('dataNascimento')
    ? normalizarCampoOpcional(recebido.dataNascimento, 10, 'dataNascimento') : atual.dataNascimento;
  if (dataNascimento) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento);
    const dataUtc = partes
      ? new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])))
      : null;
    if (!partes || !dataUtc || dataUtc.toISOString().slice(0, 10) !== dataNascimento) {
      throw new HttpError(400, 'Data de nascimento inválida. Use uma data real em AAAA-MM-DD.');
    }
  }
  const email = campos.includes('email') ? normalizarCampoOpcional(recebido.email, 254, 'email') : atual.email;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'E-mail inválido.');
  }
  const celular = campos.includes('celular')
    ? normalizarCampoOpcional(recebido.celular, 30, 'celular') : atual.celular;
  const telefone = campos.includes('telefone')
    ? normalizarCampoOpcional(recebido.telefone, 30, 'telefone') : atual.telefone;
  const formacaoEscolar = campos.includes('formacaoEscolar')
    ? normalizarCampoOpcional(recebido.formacaoEscolar, 80, 'formacaoEscolar') : atual.formacaoEscolar;
  if (campos.includes('aposentado') && typeof recebido.aposentado !== 'boolean') {
    throw new HttpError(400, 'O campo aposentado deve ser verdadeiro ou falso.');
  }
  const aposentado = campos.includes('aposentado') ? recebido.aposentado === true : atual.aposentado;

  return sequelize.transaction(async (transaction) => {
    // Revalida autorização DURANTE a transação.
    const pessoaId = await obterPessoaDoProprioMembro(usuarioId, transaction);
    const antes = await carregarMeuCadastroPorPessoa(pessoaId, transaction);
    await sequelize.query(
      `UPDATE legio.pessoa
       SET nome = :nome, nome_preferido = :nomePreferido, rg = :rg,
           data_nascimento = CAST(:dataNascimento AS date),
           email = :email, celular = :celular, telefone = :telefone
       WHERE id = CAST(:pessoaId AS bigint)`,
      { replacements: {
          pessoaId, nome, nomePreferido, rg, dataNascimento, email, celular, telefone
        }, transaction }
    );
    if (antes.id) {
      await sequelize.query(
        `UPDATE legio.membro
         SET formacao_escolar = :formacaoEscolar, aposentado = :aposentado
         WHERE pessoa_id = CAST(:pessoaId AS bigint) AND id = CAST(:membroId AS bigint)`,
        { replacements: { pessoaId, membroId: antes.id, formacaoEscolar, aposentado }, transaction }
      );
    } else {
      // Até existir cadastro institucional, os dados não pertencentes a pessoa
      // ficam em rascunho, vinculados exclusivamente ao próprio usuario.
      await sequelize.query(
        `UPDATE legio.usuario_solicitacao_acesso
         SET formacao_escolar = :formacaoEscolar, aposentado = :aposentado
         WHERE usuario_id = CAST(:usuarioId AS bigint) AND status = 'APROVADA'`,
        { replacements: { usuarioId, formacaoEscolar, aposentado }, transaction }
      );
    }
    return carregarMeuCadastroPorPessoa(pessoaId, transaction);
  });
}


/** Solicitações de MEMBRO já autorizadas, mas ainda sem vínculo legionário ativo. */
export type MembroPendenteValidacao = {
  usuarioId: string;
  pessoaId: string;
  membroId: string | null;
  nome: string;
  nomePreferido: string | null;
  cpf: string | null;
  email: string | null;
  celular: string | null;
  formacaoEscolar: string | null;
  aposentado: boolean;
  unidadeId: string;
  unidadeNome: string;
  autorizadoEm: string | null;
};

/** Nenhuma permissão herdada dos conselhos: somente Praesidia diretos e PLATFORM_OWNER. */
export async function listarMembrosPendentes(
  aprovadorId: string,
  filtroUnidadeId?: string | null
): Promise<MembroPendenteValidacao[]> {
  const escopo = await obterEscopoMembros(aprovadorId);
  if (escopo.somenteMeuCadastro || escopo.unidadesPermitidas.length === 0) {
    throw new HttpError(403, 'Seu perfil não permite validar membros.');
  }
  const unidadeId = String(filtroUnidadeId ?? '').trim();
  if (unidadeId) garantirPraesidiumPermitido(unidadeId, escopo.unidadesPermitidas);
  const unidades = unidadeId ? [unidadeId] : escopo.unidadesPermitidas;

  return sequelize.query<MembroPendenteValidacao>(
    `SELECT
       sac.usuario_id::text AS "usuarioId",
       u.pessoa_id::text AS "pessoaId",
       m.id::text AS "membroId",
       p.nome,
       p.nome_preferido AS "nomePreferido",
       p.cpf, p.email, p.celular,
       COALESCE(m.formacao_escolar, sac.formacao_escolar) AS "formacaoEscolar",
       COALESCE(m.aposentado, sac.aposentado, FALSE) AS aposentado,
       sac.unidade_id::text AS "unidadeId",
       ul.nome AS "unidadeNome",
       sac.analisado_em::text AS "autorizadoEm"
     FROM legio.usuario_solicitacao_acesso sac
     JOIN legio.usuario u ON u.id = sac.usuario_id
     JOIN legio.pessoa p ON p.id = u.pessoa_id
     JOIN legio.unidade_legionaria ul ON ul.id = sac.unidade_id AND ul.ativo = TRUE
     JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id AND tu.codigo = 'PRAESIDIUM'
     LEFT JOIN LATERAL (
       SELECT m0.id, m0.formacao_escolar, m0.aposentado
       FROM legio.membro m0 WHERE m0.pessoa_id = u.pessoa_id
       ORDER BY m0.id DESC LIMIT 1
     ) m ON TRUE
     WHERE sac.status = 'APROVADA'
       AND sac.perfil_codigo = 'MEMBRO'
       AND u.status = 'ATIVO'
       AND sac.unidade_id::text IN (:unidades)
       AND EXISTS (
         SELECT 1 FROM legio.usuario_unidade_perfil uup
         JOIN legio.perfil_acesso pa ON pa.id = uup.perfil_id
         WHERE uup.usuario_id = u.id
           AND uup.unidade_id = sac.unidade_id
           AND uup.ativo = TRUE AND uup.revogado_em IS NULL
           AND pa.codigo = 'MEMBRO' AND pa.escopo = 'UNIDADE' AND pa.ativo = TRUE
       )
       AND NOT EXISTS (
         SELECT 1 FROM legio.membro m_verificacao
         JOIN legio.membro_unidade mu ON mu.membro_id = m_verificacao.id AND mu.ativo = TRUE
         WHERE m_verificacao.pessoa_id = u.pessoa_id AND mu.unidade_id = sac.unidade_id
       )
     ORDER BY sac.analisado_em ASC NULLS LAST, p.nome`,
    { replacements: { unidades }, type: QueryTypes.SELECT }
  );
}

/** Categoria escolhida pelo responsável; só aceita opções Ativo/Auxiliar do catálogo real. */
export type ValidarMembroPendenteInput = {
  categoriaCodigo?: unknown;
};

export async function validarMembroPendente(
  aprovadorId: string,
  usuarioPendenteId: string,
  input: ValidarMembroPendenteInput
): Promise<{ membroId: string; unidadeId: string; categoriaCodigo: string; status: 'ATIVO' }> {
  if (!/^[1-9]\d*$/.test(String(usuarioPendenteId ?? ''))) {
    throw new HttpError(400, 'Identificador do usuário inválido.');
  }
  const categoriaCodigo = typeof input?.categoriaCodigo === 'string'
    ? input.categoriaCodigo.trim().toUpperCase() : '';
  if (!categoriaCodigo || categoriaCodigo.length > 80) {
    throw new HttpError(400, 'Selecione a categoria Ativo ou Auxiliar.');
  }

  return sequelize.transaction(async (transaction) => {
    // A linha da solicitação é bloqueada para impedir aprovação duplicada concorrente.
    const solicitacoes = await sequelize.query<{
      pessoaId: string; unidadeId: string; statusUsuario: string;
      formacaoEscolar: string | null; aposentado: boolean | null;
    }>(
      `SELECT u.pessoa_id::text AS "pessoaId", sac.unidade_id::text AS "unidadeId",
              u.status AS "statusUsuario", sac.formacao_escolar AS "formacaoEscolar",
              sac.aposentado
       FROM legio.usuario_solicitacao_acesso sac
       JOIN legio.usuario u ON u.id = sac.usuario_id
       WHERE sac.usuario_id = CAST(:usuarioId AS bigint)
         AND sac.status = 'APROVADA' AND sac.perfil_codigo = 'MEMBRO'
       FOR UPDATE OF sac`,
      { replacements: { usuarioId: usuarioPendenteId }, type: QueryTypes.SELECT, transaction }
    );
    const solicitacao = solicitacoes[0];
    if (!solicitacao || solicitacao.statusUsuario !== 'ATIVO') {
      throw new HttpError(409, 'Não existe solicitação de membro aprovada e ativa para este usuário.');
    }

    const escopo = await obterEscopoMembros(aprovadorId, transaction);
    if (escopo.somenteMeuCadastro) throw new HttpError(403, 'Sem autorização para validar membros.');
    garantirPraesidiumPermitido(solicitacao.unidadeId, escopo.unidadesPermitidas);

    // A concessão ao membro pode ter sido revogada depois da aprovação inicial.
    const acessos = await sequelize.query<{ permitido: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM legio.usuario_unidade_perfil uup
        JOIN legio.perfil_acesso pa ON pa.id = uup.perfil_id
        JOIN legio.unidade_legionaria ul ON ul.id = uup.unidade_id
        JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
        WHERE uup.usuario_id = CAST(:usuarioId AS bigint)
          AND uup.unidade_id = CAST(:unidadeId AS bigint)
          AND uup.ativo = TRUE AND uup.revogado_em IS NULL
          AND ul.ativo = TRUE AND tu.codigo = 'PRAESIDIUM'
          AND pa.codigo = 'MEMBRO' AND pa.escopo = 'UNIDADE' AND pa.ativo = TRUE
      ) AS permitido`,
      { replacements: { usuarioId: usuarioPendenteId, unidadeId: solicitacao.unidadeId },
        type: QueryTypes.SELECT, transaction }
    );
    if (!acessos[0]?.permitido) {
      throw new HttpError(409, 'O usuário não possui mais autorização MEMBRO ativa neste Praesidium.');
    }

    const categorias = await sequelize.query<{ id: string; codigo: string; nome: string }>(
      `SELECT id::text, codigo, nome FROM legio.categoria_membro
       WHERE UPPER(codigo) = :codigo AND ativo = TRUE LIMIT 1`,
      { replacements: { codigo: categoriaCodigo }, type: QueryTypes.SELECT, transaction }
    );
    const categoria = categorias[0];
    if (!categoria || !/(^|[^A-Z])(ATIV[OA]S?|AUXILIAR(?:ES)?)(?=[^A-Z]|$)/.test(
      `${categoria.codigo} ${categoria.nome}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    )) {
      throw new HttpError(422, 'Escolha uma categoria Ativo ou Auxiliar válida no catálogo de membros.');
    }

    // Impede duplicidade mesmo se houver registros legados de membro para a mesma pessoa.
    const vinculosExistentes = await sequelize.query<{ id: string }>(
      `SELECT mu.id::text AS id FROM legio.membro m_antes
       JOIN legio.membro_unidade mu ON mu.membro_id = m_antes.id
       WHERE m_antes.pessoa_id = CAST(:pessoaId AS bigint)
         AND mu.unidade_id = CAST(:unidadeId AS bigint) AND mu.ativo = TRUE
       LIMIT 1`,
      { replacements: { pessoaId: solicitacao.pessoaId, unidadeId: solicitacao.unidadeId },
        type: QueryTypes.SELECT, transaction }
    );
    if (vinculosExistentes.length) {
      throw new HttpError(409, 'Esta pessoa já possui vínculo legionário ativo neste Praesidium.');
    }

    const membros = await sequelize.query<{ id: string; status: string }>(
      `SELECT id::text, status FROM legio.membro
       WHERE pessoa_id = CAST(:pessoaId AS bigint) ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      { replacements: { pessoaId: solicitacao.pessoaId }, type: QueryTypes.SELECT, transaction }
    );
    let membroId = membros[0]?.id ?? null;
    if (membros[0]?.status === 'FALECIDO') {
      throw new HttpError(409, 'Cadastro de membro marcado como falecido. Necessária análise específica.');
    }

    if (membroId) {
      const vinculos = await sequelize.query<{ id: string }>(
        `SELECT id::text FROM legio.membro_unidade
         WHERE membro_id = CAST(:membroId AS bigint)
           AND unidade_id = CAST(:unidadeId AS bigint) AND ativo = TRUE
         LIMIT 1`,
        { replacements: { membroId, unidadeId: solicitacao.unidadeId },
          type: QueryTypes.SELECT, transaction }
      );
      if (vinculos.length) {
        throw new HttpError(409, 'Este membro já possui vínculo ativo com o Praesidium.');
      }
      await sequelize.query(
        `UPDATE legio.membro SET status = 'ATIVO',
           formacao_escolar = COALESCE(formacao_escolar, :formacaoEscolar),
           aposentado = COALESCE(aposentado, :aposentado, FALSE)
         WHERE id = CAST(:membroId AS bigint)`,
        { replacements: { membroId, formacaoEscolar: solicitacao.formacaoEscolar,
            aposentado: solicitacao.aposentado }, transaction }
      );
    } else {
      const criados = await sequelize.query<{ id: string }>(
        `INSERT INTO legio.membro
         (pessoa_id, dt_recrutamento, dt_ingresso, dt_compromisso,
          formacao_escolar, aposentado, pretoriano, adjutor, mesc, catequista, coroinha,
          status, observacao)
         VALUES (CAST(:pessoaId AS bigint), NULL, NULL, NULL,
                 :formacaoEscolar, COALESCE(:aposentado, FALSE),
                 FALSE, FALSE, FALSE, FALSE, FALSE, 'ATIVO', NULL)
         RETURNING id::text`,
        { replacements: { pessoaId: solicitacao.pessoaId,
            formacaoEscolar: solicitacao.formacaoEscolar, aposentado: solicitacao.aposentado },
          type: QueryTypes.SELECT, transaction }
      );
      membroId = criados[0].id;
    }

    await sequelize.query(
      `INSERT INTO legio.membro_unidade
       (membro_id, unidade_id, categoria_membro_id, principal, ativo, data_inicio)
       VALUES (CAST(:membroId AS bigint), CAST(:unidadeId AS bigint), CAST(:categoriaId AS bigint),
               NOT EXISTS (
                 SELECT 1 FROM legio.membro_unidade
                 WHERE membro_id = CAST(:membroId AS bigint) AND ativo = TRUE
               ), TRUE, CURRENT_DATE)`,
      { replacements: { membroId, unidadeId: solicitacao.unidadeId, categoriaId: categoria.id },
        transaction }
    );
    await sequelize.query(
      `INSERT INTO legio.auditoria_evento
         (usuario_id, unidade_id, acao, entidade, entidade_id, dados_depois)
       VALUES (CAST(:aprovadorId AS bigint), CAST(:unidadeId AS bigint),
               'MEMBRO_VINCULO_VALIDADO', 'legio.membro', CAST(:membroId AS bigint),
               CAST(:detalhes AS jsonb))`,
      { replacements: { aprovadorId, unidadeId: solicitacao.unidadeId, membroId,
          detalhes: JSON.stringify({ usuarioId: usuarioPendenteId,
            pessoaId: solicitacao.pessoaId, categoriaCodigo: categoria.codigo,
            status: 'ATIVO', origem: 'APROVACAO_MEMBRO_PENDENTE' }) },
        transaction }
    );
    return { membroId: membroId!, unidadeId: solicitacao.unidadeId,
      categoriaCodigo: categoria.codigo, status: 'ATIVO' as const };
  });
}
