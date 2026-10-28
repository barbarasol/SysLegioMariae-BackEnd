import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

type TipoUnidadeRow = {
  id: number;
  codigo: string;
  nome: string;
  ordem_hierarquica: number | null;
};

type DiaReuniaoRow = {
  id: string;
  nome: string;
  status: string;
};

type FusoHorarioRow = {
  nome: string;
  abreviacao: string | null;
  offset_utc: string | null;
  horario_verao: boolean;
};

type PaisRow = {
  id: string;
  nome: string;
  sigla: string | null;
  sigla3: string | null;
};

type UfRow = {
  id: string;
  id_pais: string;
  nome: string;
  sigla: string | null;
  codigo_iso: string | null;
  pais_sigla: string | null;
};

type LocalizacaoRow = {
  municipio_id: string;
  municipio_nome: string;
  uf_id: string;
  uf_nome: string;
  uf_sigla: string | null;
  pais_id: string;
  pais_nome: string;
  pais_sigla: string | null;
};

type SubdivisaoLocalRow = {
  id: string;
  municipio_id: string;
  nome: string;
  tipo: string | null;
  codigo: string | null;
  ativo: boolean;
};

type IgrejaRow = {
  id: string;
  nome: string;
  padre: string | null;
  status: string;
  codigo_postal_id: string | null;
  subdivisao_local_id: string | null;
  codigo_postal?: string | null;
  logradouro?: string | null;
  numero_logradouro?: string | null;
  complemento?: string | null;
  bairro?: string | null;
};

type CodigoPostalRow = {
  id: string;
  pais_id: string;
  uf_id: string | null;
  municipio_id: string | null;
  subdivisao_local_id: string | null;
  codigo_postal: string;
  tipo_logradouro: string | null;
  logradouro: string | null;
  bairro: string | null;
  localidade: string | null;
  fonte: string | null;
  municipio_nome: string | null;
  uf_nome: string | null;
  uf_sigla: string | null;
  subdivisao_local_nome: string | null;
  subdivisao_local_tipo: string | null;
  subdivisao_local_codigo: string | null;
  pais_nome: string;
  pais_sigla: string | null;
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
  email?: string | null;
  celular?: string | null;
  telefone?: string | null;
  site?: string | null;
  municipioId: string;
  igrejaId: string;
  dataConstituicao?: string | null;
  diaReuniaoId?: string | null;
  horarioInicioReuniao?: string | null;
  horarioFimReuniao?: string | null;
  fusoHorario?: string | null;
  unidadeSuperiorId?: string | null;
  observacao?: string | null;
  solicitanteUsuarioId: string;
};

export type CriarIgrejaInput = {
  nome: string;
  padre?: string | null;
  municipioId: string;
  subdivisaoLocalId?: string | null;
  codigoPostalId?: string | null;
  codigoPostal?: string | null;
  tipoLogradouro?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  localidade?: string | null;
  numeroLogradouro?: string | null;
  complemento?: string | null;
  celular?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  email?: string | null;
  site?: string | null;
  usuarioId: string;
};

export type CriarUfInput = {
  paisId: unknown;
  nome: unknown;
  sigla?: unknown;
  codigoIso?: unknown;
};

export type CriarMunicipioInput = {
  ufId: unknown;
  nome: unknown;
};

export type CriarSubdivisaoLocalInput = {
  municipioId: unknown;
  nome: unknown;
  tipo?: unknown;
  codigo?: unknown;
  usuarioId: string;
};

export type CriarCodigoPostalInput = {
  paisId: unknown;
  municipioId: unknown;
  subdivisaoLocalId?: unknown;
  codigoPostal: unknown;
  tipoLogradouro?: unknown;
  logradouro?: unknown;
  bairro?: unknown;
  localidade?: unknown;
  usuarioId: string;
};

export type UnidadeCriada = {
  id: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  estadoRegiao: string | null;
  statusAprovacao: string;
};

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

export type UnidadeEstrutura = {
  id: string;
  nome: string;
  nomeReduzido: string | null;
  tipo: string;
  tipoNome: string;
  unidadeSuperiorId: string | null;
  unidadeSuperiorNome: string | null;
  cidade: string | null;
  estadoRegiao: string | null;
  statusAprovacao: string;
  ativo: boolean;
};

export type UnidadeDetalhe = {
  id: string;
  tipoCodigo: string;
  nome: string;
  nomeReduzido: string | null;
  email: string | null;
  celular: string | null;
  telefone: string | null;
  site: string | null;
  municipioId: string;
  igrejaId: string;
  paisId: string;
  ufId: string;
  subdivisaoLocalId: string | null;
  codigoPostalId: string | null;
  codigoPostal: string | null;
  dataConstituicao: string | null;
  diaReuniaoId: string | null;
  horarioInicioReuniao: string | null;
  horarioFimReuniao: string | null;
  fusoHorario: string | null;
  unidadeSuperiorId: string | null;
  observacao: string | null;
  statusAprovacao: string;
  ativo: boolean;
};

export type AtualizarUnidadeInput = Omit<
  CriarUnidadeInput,
  'solicitanteUsuarioId'
> & {
  usuarioId: string;
};

export type TipoUnidadeOpcao = {
  codigo: string;
  nome: string;
  ordemHierarquica: number | null;
  tiposSuperiorPermitidos: string[];
};

export type DiaReuniaoOpcao = {
  id: string;
  nome: string;
};

export type FusoHorarioOpcao = {
  nome: string;
  abreviacao: string | null;
  offsetUtc: string | null;
  horarioVerao: boolean;
};

export type PaisOpcao = {
  id: string;
  nome: string;
  sigla: string | null;
  sigla3: string | null;
};

export type UfOpcao = {
  id: string;
  nome: string;
  sigla: string | null;
  codigoIso: string | null;
};

export type MunicipioOpcao = {
  id: string;
  nome: string;
};

export type SubdivisaoLocalOpcao = {
  id: string;
  municipioId: string;
  nome: string;
  tipo: string | null;
  codigo: string | null;
};

export type IgrejaOpcao = {
  id: string;
  nome: string;
  padre: string | null;
  status: string;
  codigoPostalId: string | null;
  subdivisaoLocalId: string | null;
  codigoPostal: string | null;
  logradouro: string | null;
  numeroLogradouro: string | null;
  complemento: string | null;
  bairro: string | null;
};

export type CodigoPostalOpcao = {
  id: string;
  paisId: string;
  ufId: string | null;
  municipioId: string | null;
  subdivisaoLocalId: string | null;
  codigoPostal: string;
  tipoLogradouro: string | null;
  logradouro: string | null;
  bairro: string | null;
  localidade: string | null;
  fonte: string | null;
  municipioNome: string | null;
  ufNome: string | null;
  ufSigla: string | null;
  subdivisaoLocalNome: string | null;
  subdivisaoLocalTipo: string | null;
  subdivisaoLocalCodigo: string | null;
  paisNome: string;
  paisSigla: string | null;
};

const TIPO_SEM_SUPERIOR = 'CONCILIUM';

function normalizarTextoOpcional(valor: unknown): string | null {
  const texto = String(valor ?? '').trim();
  return texto === '' ? null : texto;
}

function normalizarTextoMaiusculo(valor: unknown): string {
  return String(valor ?? '').trim().toUpperCase();
}

function normalizarTextoOpcionalMaiusculo(valor: unknown): string | null {
  const texto = normalizarTextoMaiusculo(valor);
  return texto === '' ? null : texto;
}

/**
 * pais_codigo é legado (CHAR(2)). A localização real da unidade é
 * determinada por municipio_id -> uf -> pais. Para países sem sigla
 * alfa-2 preenchida, usamos EX apenas nesse campo legado.
 */
function codigoPaisLegado(valor: unknown): string {
  const sigla = normalizarTextoMaiusculo(valor);
  return /^[A-Z]{2}$/.test(sigla) ? sigla : 'EX';
}

function normalizarTipo(valor: unknown): string {
  return String(valor ?? '').trim().toUpperCase();
}

function normalizarId(valor: unknown, campo: string): string {
  const texto = String(valor ?? '').trim();

  if (!/^\d+$/.test(texto) || texto === '0') {
    throw new HttpError(400, `Informe ${campo} válido.`);
  }

  return texto;
}

function normalizarCodigoPostal(valor: unknown): string | null {
  const texto = normalizarTextoOpcional(valor);

  if (!texto) {
    return null;
  }

  return texto.toUpperCase().slice(0, 20);
}

function normalizarFiltro(valor: unknown): string | null {
  const texto = normalizarTextoOpcional(valor);
  return texto ? texto.slice(0, 100) : null;
}

function normalizarHoraOpcional(
  valor: unknown,
  campo: string
): string | null {
  const texto = normalizarTextoOpcional(valor);

  if (!texto) {
    return null;
  }

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(texto)) {
    throw new HttpError(
      400,
      `Informe ${campo} em um horário válido.`
    );
  }

  return texto.length === 5 ? `${texto}:00` : texto;
}

function ehBrasilSigla(sigla: string | null | undefined): boolean {
  return String(sigla ?? '').trim().toUpperCase() === 'BR';
}

function validarCepBrasil(codigoPostal: string): void {
  const somenteNumeros = codigoPostal.replace(/\D/g, '');

  if (somenteNumeros.length !== 8) {
    throw new HttpError(400, 'Informe um CEP brasileiro com 8 dígitos.');
  }
}

function mapearCodigoPostal(row: CodigoPostalRow): CodigoPostalOpcao {
  return {
    id: row.id,
    paisId: row.pais_id,
    ufId: row.uf_id,
    municipioId: row.municipio_id,
    subdivisaoLocalId: row.subdivisao_local_id,
    codigoPostal: row.codigo_postal,
    tipoLogradouro: row.tipo_logradouro,
    logradouro: row.logradouro,
    bairro: row.bairro,
    localidade: row.localidade,
    fonte: row.fonte,
    municipioNome: row.municipio_nome,
    ufNome: row.uf_nome,
    ufSigla: row.uf_sigla,
    subdivisaoLocalNome: row.subdivisao_local_nome,
    subdivisaoLocalTipo: row.subdivisao_local_tipo,
    subdivisaoLocalCodigo: row.subdivisao_local_codigo,
    paisNome: row.pais_nome,
    paisSigla: row.pais_sigla
  };
}

async function resolverPais(
  paisIdValor: unknown,
  transaction?: Transaction
): Promise<PaisRow> {
  const paisId = normalizarId(paisIdValor, 'um País');

  const linhas = await sequelize.query<PaisRow>(
    `
      SELECT
        id::text,
        nome,
        sigla,
        sigla3
      FROM legio.pais
      WHERE id = CAST(:paisId AS integer)
      LIMIT 1
    `,
    {
      replacements: { paisId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const pais = linhas[0];

  if (!pais) {
    throw new HttpError(400, 'País não encontrado.');
  }

  return pais;
}

async function bloquearInclusaoBrasil(
  paisIdValor: unknown,
  entidade: string,
  transaction?: Transaction
): Promise<PaisRow> {
  const pais = await resolverPais(paisIdValor, transaction);

  if (ehBrasilSigla(pais.sigla)) {
    throw new HttpError(
      400,
      `Não é permitido incluir ${entidade} para o Brasil neste fluxo. Utilize somente os registros já importados.`
    );
  }

  return pais;
}

async function resolverUf(
  ufIdValor: unknown,
  transaction?: Transaction
): Promise<UfRow> {
  const ufId = normalizarId(ufIdValor, 'uma UF/Divisão Administrativa');

  const linhas = await sequelize.query<UfRow>(
    `
      SELECT
        u.id::text,
        u.id_pais::text,
        u.nome,
        u.sigla,
        u.codigo_iso,
        p.sigla AS pais_sigla
      FROM legio.uf u
      JOIN legio.pais p
        ON p.id = u.id_pais
      WHERE u.id = CAST(:ufId AS integer)
      LIMIT 1
    `,
    {
      replacements: { ufId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const uf = linhas[0];

  if (!uf) {
    throw new HttpError(400, 'UF/Divisão Administrativa não encontrada.');
  }

  return uf;
}

async function resolverLocalizacao(
  municipioIdValor: unknown,
  transaction?: Transaction
): Promise<LocalizacaoRow> {
  const municipioId = normalizarId(
    municipioIdValor,
    'um Município/Localidade'
  );

  const linhas = await sequelize.query<LocalizacaoRow>(
    `
      SELECT
        m.id::text AS municipio_id,
        m.nome AS municipio_nome,
        u.id::text AS uf_id,
        u.nome AS uf_nome,
        u.sigla AS uf_sigla,
        p.id::text AS pais_id,
        p.nome AS pais_nome,
        p.sigla AS pais_sigla
      FROM legio.municipio m
      JOIN legio.uf u
        ON u.id = m.id_uf
      JOIN legio.pais p
        ON p.id = u.id_pais
      WHERE m.id = CAST(:municipioId AS integer)
      LIMIT 1
    `,
    {
      replacements: { municipioId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const localizacao = linhas[0];

  if (!localizacao) {
    throw new HttpError(400, 'Município/Localidade não encontrado.');
  }

  const siglaPais = normalizarTextoOpcionalMaiusculo(
    localizacao.pais_sigla
  );

  return {
    ...localizacao,
    pais_sigla: siglaPais
  };
}

async function resolverSubdivisaoLocal(
  subdivisaoLocalIdValor: unknown,
  municipioId: string,
  transaction?: Transaction
): Promise<SubdivisaoLocalRow> {
  const subdivisaoLocalId = normalizarId(
    subdivisaoLocalIdValor,
    'uma Subdivisão Local'
  );

  const linhas = await sequelize.query<SubdivisaoLocalRow>(
    `
      SELECT
        id::text,
        municipio_id::text,
        nome,
        tipo,
        codigo,
        ativo
      FROM legio.subdivisao_local
      WHERE id = CAST(:subdivisaoLocalId AS bigint)
        AND municipio_id = CAST(:municipioId AS integer)
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: {
        subdivisaoLocalId,
        municipioId
      },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const subdivisao = linhas[0];

  if (!subdivisao) {
    throw new HttpError(
      400,
      'A Subdivisão Local não existe, está inativa ou não pertence ao Município/Localidade selecionado.'
    );
  }

  return subdivisao;
}

async function resolverTipo(
  codigo: string,
  transaction?: Transaction
): Promise<TipoUnidadeRow> {
  const tipos = await sequelize.query<TipoUnidadeRow>(
    `
      SELECT
        id,
        codigo,
        nome,
        ordem_hierarquica
      FROM legio.tipo_unidade
      WHERE codigo = :codigo
        AND ativo = TRUE
      LIMIT 1
    `,
    {
      replacements: { codigo },
      type: QueryTypes.SELECT,
      transaction
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

async function resolverDiaReuniao(
  diaReuniaoIdValor: unknown,
  transaction?: Transaction
): Promise<DiaReuniaoRow> {
  const diaReuniaoId = normalizarId(
    diaReuniaoIdValor,
    'um Dia de Reunião'
  );

  const linhas = await sequelize.query<DiaReuniaoRow>(
    `
      SELECT
        id::text,
        nome,
        status
      FROM legio.dia_reuniao
      WHERE id = CAST(:diaReuniaoId AS integer)
        AND status = 'ATIVO'
      LIMIT 1
    `,
    {
      replacements: { diaReuniaoId },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const dia = linhas[0];

  if (!dia) {
    throw new HttpError(
      400,
      'Dia de Reunião não encontrado ou inativo.'
    );
  }

  return dia;
}

async function validarFusoHorario(
  fusoHorarioValor: unknown,
  transaction?: Transaction
): Promise<string | null> {
  const fusoHorario = normalizarTextoOpcional(fusoHorarioValor);

  if (!fusoHorario) {
    return null;
  }

  const linhas = await sequelize.query<{ nome: string }>(
    `
      SELECT name AS nome
      FROM pg_timezone_names
      WHERE name = :fusoHorario
      LIMIT 1
    `,
    {
      replacements: { fusoHorario },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  if (!linhas[0]) {
    throw new HttpError(
      400,
      'Fuso horário inválido. Selecione um fuso disponível na lista do sistema.'
    );
  }

  return linhas[0].nome;
}

async function resolverIgreja(
  igrejaIdValor: unknown,
  municipioId: string,
  transaction?: Transaction
): Promise<IgrejaRow> {
  const igrejaId = normalizarId(
    igrejaIdValor,
    'uma Igreja/Paróquia/Sede'
  );

  const linhas = await sequelize.query<IgrejaRow>(
    `
      SELECT
        i.id::text,
        i.nome,
        i.padre,
        i.status,
        i.codigo_postal_id::text,
        i.subdivisao_local_id::text,
        cp.codigo_postal,
        COALESCE(NULLIF(BTRIM(i.logradouro), ''), cp.logradouro) AS logradouro,
        i.numero_logradouro,
        i.complemento,
        COALESCE(NULLIF(BTRIM(i.bairro), ''), cp.bairro) AS bairro
      FROM legio.igreja i
      LEFT JOIN legio.codigo_postal cp
        ON cp.id = i.codigo_postal_id
      WHERE i.id = CAST(:igrejaId AS bigint)
        AND i.id_municipio = CAST(:municipioId AS integer)
        AND i.status = 'ATIVA'
      LIMIT 1
    `,
    {
      replacements: {
        igrejaId,
        municipioId
      },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const igreja = linhas[0];

  if (!igreja) {
    throw new HttpError(
      400,
      'A Igreja/Paróquia/Sede informada não existe, está inativa ou não pertence ao Município/Localidade selecionado.'
    );
  }

  return igreja;
}

async function validarSuperior(
  tipo: TipoUnidadeRow,
  unidadeSuperiorId: string | null,
  transaction?: Transaction
): Promise<void> {
  if (tipo.codigo === TIPO_SEM_SUPERIOR) {
    if (unidadeSuperiorId) {
      throw new HttpError(
        400,
        'CONCILIUM não pode possuir unidade superior.'
      );
    }

    return;
  }

  if (!unidadeSuperiorId) {
    throw new HttpError(
      400,
      `Unidades do tipo ${tipo.codigo} precisam de uma unidade superior.`
    );
  }

  const superiores = await sequelize.query<{ id: string }>(
    `
      SELECT ul.id::text
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade pai
        ON pai.id = ul.tipo_unidade_id
      JOIN legio.tipo_unidade_hierarquia h
        ON h.tipo_pai_id = pai.id
       AND h.tipo_filho_id = :tipoFilhoId
       AND h.ativo = TRUE
      WHERE ul.id = CAST(:unidadeSuperiorId AS bigint)
        AND ul.ativo = TRUE
        AND ul.status_aprovacao = 'APROVADA'
      LIMIT 1
    `,
    {
      replacements: {
        tipoFilhoId: tipo.id,
        unidadeSuperiorId
      },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  if (superiores.length === 0) {
    throw new HttpError(
      400,
      'A unidade superior não foi encontrada, ainda não foi aprovada ou não é permitida para o tipo selecionado.'
    );
  }
}

async function buscarCodigosPostaisInterno(
  paisId: string,
  codigoPostal: string,
  municipioId?: string | null,
  transaction?: Transaction
): Promise<CodigoPostalRow[]> {
  return sequelize.query<CodigoPostalRow>(
    `
      SELECT
        cp.id::text,
        cp.pais_id::text,
        COALESCE(cp.uf_id, m.id_uf)::text AS uf_id,
        cp.municipio_id::text,
        cp.subdivisao_local_id::text,
        cp.codigo_postal,
        cp.tipo_logradouro,
        cp.logradouro,
        cp.bairro,
        cp.localidade,
        cp.fonte,
        m.nome AS municipio_nome,
        u.nome AS uf_nome,
        u.sigla AS uf_sigla,
        sl.nome AS subdivisao_local_nome,
        sl.tipo AS subdivisao_local_tipo,
        sl.codigo AS subdivisao_local_codigo,
        p.nome AS pais_nome,
        p.sigla AS pais_sigla
      FROM legio.codigo_postal cp
      JOIN legio.pais p
        ON p.id = cp.pais_id
      LEFT JOIN legio.municipio m
        ON m.id = cp.municipio_id
      LEFT JOIN legio.uf u
        ON u.id = COALESCE(cp.uf_id, m.id_uf)
      LEFT JOIN legio.subdivisao_local sl
        ON sl.id = cp.subdivisao_local_id
      WHERE cp.pais_id = CAST(:paisId AS integer)
        AND cp.ativo = TRUE
        AND upper(regexp_replace(cp.codigo_postal, '[^A-Za-z0-9]', '', 'g'))
            = upper(regexp_replace(:codigoPostal, '[^A-Za-z0-9]', '', 'g'))
        AND (
          CAST(:municipioId AS varchar) IS NULL
          OR cp.municipio_id = CAST(:municipioId AS integer)
        )
      ORDER BY
        CASE WHEN cp.subdivisao_local_id IS NULL THEN 1 ELSE 0 END,
        cp.localidade NULLS LAST,
        cp.logradouro NULLS LAST,
        cp.bairro NULLS LAST,
        cp.id
      LIMIT 100
    `,
    {
      replacements: {
        paisId,
        codigoPostal,
        municipioId: municipioId ?? null
      },
      type: QueryTypes.SELECT,
      transaction
    }
  );
}

async function inserirCodigoPostalExterior(
  input: {
    paisId: string;
    municipioId: string;
    subdivisaoLocalId?: string | null;
    codigoPostal: string;
    tipoLogradouro?: string | null;
    logradouro?: string | null;
    bairro?: string | null;
    localidade?: string | null;
    usuarioId: string;
  },
  transaction: Transaction
): Promise<CodigoPostalOpcao> {
  const localizacao = await resolverLocalizacao(
    input.municipioId,
    transaction
  );

  if (localizacao.pais_id !== input.paisId) {
    throw new HttpError(
      400,
      'O Município/Localidade não pertence ao país informado.'
    );
  }

  if (ehBrasilSigla(localizacao.pais_sigla)) {
    throw new HttpError(
      400,
      'Não é permitido cadastrar novo CEP brasileiro. Utilize um CEP já importado.'
    );
  }

  if (input.subdivisaoLocalId) {
    await resolverSubdivisaoLocal(
      input.subdivisaoLocalId,
      input.municipioId,
      transaction
    );
  }

  const existentes = await buscarCodigosPostaisInterno(
    input.paisId,
    input.codigoPostal,
    input.municipioId,
    transaction
  );

  const existente = existentes.find((item) => {
    const atual = item.subdivisao_local_id ?? null;
    const desejada = input.subdivisaoLocalId ?? null;
    return atual === desejada;
  }) ?? existentes[0];

  if (existente) {
    return mapearCodigoPostal(existente);
  }

  const linhas = await sequelize.query<CodigoPostalRow>(
    `
      INSERT INTO legio.codigo_postal
      (
        pais_id,
        uf_id,
        municipio_id,
        subdivisao_local_id,
        localidade,
        codigo_postal,
        tipo_logradouro,
        logradouro,
        bairro,
        fonte,
        origem_id,
        ativo,
        usu_inc_id,
        usu_alt_id
      )
      VALUES
      (
        CAST(:paisId AS integer),
        CAST(:ufId AS integer),
        CAST(:municipioId AS integer),
        CAST(:subdivisaoLocalId AS bigint),
        :localidade,
        :codigoPostal,
        :tipoLogradouro,
        :logradouro,
        :bairro,
        'CADASTRO_USUARIO',
        NULL,
        TRUE,
        CAST(:usuarioId AS bigint),
        CAST(:usuarioId AS bigint)
      )
      RETURNING
        id::text,
        pais_id::text,
        uf_id::text,
        municipio_id::text,
        subdivisao_local_id::text,
        codigo_postal,
        tipo_logradouro,
        logradouro,
        bairro,
        localidade,
        fonte,
        NULL::varchar AS municipio_nome,
        NULL::varchar AS uf_nome,
        NULL::varchar AS uf_sigla,
        NULL::varchar AS subdivisao_local_nome,
        NULL::varchar AS subdivisao_local_tipo,
        NULL::varchar AS subdivisao_local_codigo,
        NULL::varchar AS pais_nome,
        NULL::varchar AS pais_sigla
    `,
    {
      replacements: {
        paisId: input.paisId,
        ufId: localizacao.uf_id,
        municipioId: input.municipioId,
        subdivisaoLocalId: input.subdivisaoLocalId ?? null,
        localidade: input.localidade ?? localizacao.municipio_nome,
        codigoPostal: input.codigoPostal,
        tipoLogradouro: input.tipoLogradouro ?? null,
        logradouro: input.logradouro ?? null,
        bairro: input.bairro ?? null,
        usuarioId: input.usuarioId
      },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const id = linhas[0].id;

  const recarregados = await sequelize.query<CodigoPostalRow>(
    `
      SELECT
        cp.id::text,
        cp.pais_id::text,
        COALESCE(cp.uf_id, m.id_uf)::text AS uf_id,
        cp.municipio_id::text,
        cp.subdivisao_local_id::text,
        cp.codigo_postal,
        cp.tipo_logradouro,
        cp.logradouro,
        cp.bairro,
        cp.localidade,
        cp.fonte,
        m.nome AS municipio_nome,
        u.nome AS uf_nome,
        u.sigla AS uf_sigla,
        sl.nome AS subdivisao_local_nome,
        sl.tipo AS subdivisao_local_tipo,
        sl.codigo AS subdivisao_local_codigo,
        p.nome AS pais_nome,
        p.sigla AS pais_sigla
      FROM legio.codigo_postal cp
      JOIN legio.pais p ON p.id = cp.pais_id
      LEFT JOIN legio.municipio m ON m.id = cp.municipio_id
      LEFT JOIN legio.uf u ON u.id = COALESCE(cp.uf_id, m.id_uf)
      LEFT JOIN legio.subdivisao_local sl
        ON sl.id = cp.subdivisao_local_id
      WHERE cp.id = CAST(:id AS bigint)
      LIMIT 1
    `,
    {
      replacements: { id },
      type: QueryTypes.SELECT,
      transaction
    }
  );

  return mapearCodigoPostal(recarregados[0]);
}

async function obterOuCriarCodigoPostal(
  input: {
    codigoPostalId?: string | null;
    codigoPostal?: string | null;
    municipioId: string;
    subdivisaoLocalId?: string | null;
    localizacao: LocalizacaoRow;
    tipoLogradouro?: string | null;
    logradouro?: string | null;
    bairro?: string | null;
    localidade?: string | null;
    usuarioId: string;
  },
  transaction: Transaction
): Promise<string | null> {
  const codigoPostal = normalizarCodigoPostal(input.codigoPostal);

  if (input.codigoPostalId) {
    const codigoPostalId = normalizarId(
      input.codigoPostalId,
      'um CEP/Código Postal'
    );

    const existentes = await sequelize.query<{ id: string }>(
      `
        SELECT id::text
        FROM legio.codigo_postal
        WHERE id = CAST(:codigoPostalId AS bigint)
          AND pais_id = CAST(:paisId AS integer)
          AND ativo = TRUE
          AND (
            municipio_id IS NULL
            OR municipio_id = CAST(:municipioId AS integer)
          )
        LIMIT 1
      `,
      {
        replacements: {
          codigoPostalId,
          paisId: input.localizacao.pais_id,
          municipioId: input.municipioId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (existentes.length === 0) {
      throw new HttpError(
        400,
        'O CEP/Código Postal selecionado não pertence à localização informada.'
      );
    }

    return codigoPostalId;
  }

  if (!codigoPostal) {
    return null;
  }

  if (ehBrasilSigla(input.localizacao.pais_sigla)) {
    throw new HttpError(
      400,
      'CEP brasileiro não encontrado/selecionado. No Brasil não é permitido cadastrar novo CEP neste fluxo.'
    );
  }

  const codigo = await inserirCodigoPostalExterior(
    {
      paisId: input.localizacao.pais_id,
      municipioId: input.municipioId,
      subdivisaoLocalId: input.subdivisaoLocalId ?? null,
      codigoPostal,
      tipoLogradouro: normalizarTextoOpcional(input.tipoLogradouro),
      logradouro: normalizarTextoOpcional(input.logradouro),
      bairro: normalizarTextoOpcional(input.bairro),
      localidade: normalizarTextoOpcional(input.localidade),
      usuarioId: input.usuarioId
    },
    transaction
  );

  return codigo.id;
}

export async function listarTipos(): Promise<TipoUnidadeOpcao[]> {
  const linhas = await sequelize.query<{
    codigo: string;
    nome: string;
    ordem_hierarquica: number | null;
    tipos_superiores: string[] | null;
  }>(
    `
      SELECT
        filho.codigo,
        filho.nome,
        filho.ordem_hierarquica,
        COALESCE(
          array_agg(pai.codigo ORDER BY pai.ordem_hierarquica)
            FILTER (WHERE pai.id IS NOT NULL),
          ARRAY[]::varchar[]
        ) AS tipos_superiores
      FROM legio.tipo_unidade filho
      LEFT JOIN legio.tipo_unidade_hierarquia h
        ON h.tipo_filho_id = filho.id
       AND h.ativo = TRUE
      LEFT JOIN legio.tipo_unidade pai
        ON pai.id = h.tipo_pai_id
       AND pai.ativo = TRUE
      WHERE filho.ativo = TRUE
      GROUP BY
        filho.id,
        filho.codigo,
        filho.nome,
        filho.ordem_hierarquica
      ORDER BY
        filho.ordem_hierarquica NULLS LAST,
        filho.nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  return linhas.map((item) => ({
    codigo: item.codigo,
    nome: item.nome,
    ordemHierarquica: item.ordem_hierarquica,
    tiposSuperiorPermitidos: item.tipos_superiores ?? []
  }));
}

export async function listarDiasReuniao(
  filtroValor?: unknown
): Promise<DiaReuniaoOpcao[]> {
  const filtro = normalizarFiltro(filtroValor);

  const linhas = await sequelize.query<DiaReuniaoRow>(
    `
      SELECT
        id::text,
        nome,
        status
      FROM legio.dia_reuniao
      WHERE status = 'ATIVO'
        AND (
          CAST(:filtro AS varchar) IS NULL
          OR nome ILIKE '%' || CAST(:filtro AS varchar) || '%'
        )
      ORDER BY id
    `,
    {
      replacements: { filtro },
      type: QueryTypes.SELECT
    }
  );

  return linhas.map((item) => ({
    id: item.id,
    nome: item.nome
  }));
}

export async function listarFusosHorarios(
  filtroValor?: unknown
): Promise<FusoHorarioOpcao[]> {
  const filtro = normalizarFiltro(filtroValor);

  const linhas = await sequelize.query<FusoHorarioRow>(
    `
      SELECT
        name AS nome,
        abbrev AS abreviacao,
        utc_offset::text AS offset_utc,
        is_dst AS horario_verao
      FROM pg_timezone_names
      WHERE name NOT LIKE 'posix/%'
        AND name NOT LIKE 'right/%'
        AND name NOT LIKE 'Etc/%'
        AND (
          CAST(:filtro AS varchar) IS NULL
          OR name ILIKE '%' || CAST(:filtro AS varchar) || '%'
          OR abbrev ILIKE '%' || CAST(:filtro AS varchar) || '%'
        )
      ORDER BY
        CASE
          WHEN name = 'America/Sao_Paulo' THEN 0
          WHEN name = 'Europe/Dublin' THEN 1
          WHEN name = 'UTC' THEN 2
          ELSE 3
        END,
        name
      LIMIT 200
    `,
    {
      replacements: { filtro },
      type: QueryTypes.SELECT
    }
  );

  return linhas.map((item) => ({
    nome: item.nome,
    abreviacao: item.abreviacao,
    offsetUtc: item.offset_utc,
    horarioVerao: item.horario_verao
  }));
}

export async function listarPaises(): Promise<PaisOpcao[]> {
  return sequelize.query<PaisOpcao>(
    `
      SELECT
        id::text,
        nome,
        sigla,
        sigla3
      FROM legio.pais
      WHERE nome IS NOT NULL
      ORDER BY
        CASE WHEN upper(COALESCE(sigla, '')) = 'BR' THEN 0 ELSE 1 END,
        nome
    `,
    {
      type: QueryTypes.SELECT
    }
  );
}

export async function listarUfs(
  paisIdValor: unknown,
  filtroValor?: unknown
): Promise<UfOpcao[]> {
  const paisId = normalizarId(paisIdValor, 'um País');
  const filtro = normalizarFiltro(filtroValor);

  return sequelize.query<UfOpcao>(
    `
      SELECT
        id::text,
        nome,
        sigla,
        codigo_iso AS "codigoIso"
      FROM legio.uf
      WHERE id_pais = CAST(:paisId AS integer)
        AND nome IS NOT NULL
        AND (
          CAST(:filtro AS varchar) IS NULL
          OR nome ILIKE '%' || CAST(:filtro AS varchar) || '%'
          OR sigla ILIKE '%' || CAST(:filtro AS varchar) || '%'
          OR codigo_iso ILIKE '%' || CAST(:filtro AS varchar) || '%'
        )
      ORDER BY nome
      LIMIT 500
    `,
    {
      replacements: {
        paisId,
        filtro
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function criarUf(input: CriarUfInput): Promise<UfOpcao> {
  const paisId = normalizarId(input.paisId, 'um País');
  const nome = normalizarTextoMaiusculo(input.nome);
  const sigla = normalizarTextoOpcionalMaiusculo(input.sigla);
  const codigoIso = normalizarTextoOpcionalMaiusculo(input.codigoIso);

  if (!nome) {
    throw new HttpError(400, 'Informe o nome da Divisão Administrativa.');
  }

  await bloquearInclusaoBrasil(
    paisId,
    'nova UF/Divisão Administrativa'
  );

  const duplicadas = await sequelize.query<{ id: string }>(
    `
      SELECT id::text
      FROM legio.uf
      WHERE id_pais = CAST(:paisId AS integer)
        AND lower(btrim(nome)) = lower(btrim(:nome))
      LIMIT 1
    `,
    {
      replacements: {
        paisId,
        nome
      },
      type: QueryTypes.SELECT
    }
  );

  if (duplicadas.length > 0) {
    throw new HttpError(
      409,
      'Já existe uma Divisão Administrativa com esse nome no país selecionado.'
    );
  }

  const linhas = await sequelize.query<{
    id: string;
    nome: string;
    sigla: string | null;
    codigoIso: string | null;
  }>(
    `
      INSERT INTO legio.uf
      (
        id_pais,
        nome,
        sigla,
        codigo_iso,
        codigo_ibge
      )
      VALUES
      (
        CAST(:paisId AS integer),
        :nome,
        :sigla,
        :codigoIso,
        NULL
      )
      RETURNING
        id::text,
        nome,
        sigla,
        codigo_iso AS "codigoIso"
    `,
    {
      replacements: {
        paisId,
        nome,
        sigla,
        codigoIso
      },
      type: QueryTypes.SELECT
    }
  );

  return linhas[0];
}

export async function listarMunicipios(
  ufIdValor: unknown,
  filtroValor?: unknown
): Promise<MunicipioOpcao[]> {
  const ufId = normalizarId(
    ufIdValor,
    'uma UF/Divisão Administrativa'
  );
  const filtro = normalizarFiltro(filtroValor);

  return sequelize.query<MunicipioOpcao>(
    `
      SELECT
        id::text,
        nome
      FROM legio.municipio
      WHERE id_uf = CAST(:ufId AS integer)
        AND (
          CAST(:filtro AS varchar) IS NULL
          OR nome ILIKE '%' || CAST(:filtro AS varchar) || '%'
        )
      ORDER BY nome
      LIMIT 2000
    `,
    {
      replacements: {
        ufId,
        filtro
      },
      type: QueryTypes.SELECT
    }
  );
}

export async function criarMunicipio(
  input: CriarMunicipioInput
): Promise<MunicipioOpcao> {
  const uf = await resolverUf(input.ufId);
  const nome = normalizarTextoMaiusculo(input.nome);

  if (!nome) {
    throw new HttpError(400, 'Informe o nome do Município/Localidade.');
  }

  if (ehBrasilSigla(uf.pais_sigla)) {
    throw new HttpError(
      400,
      'Não é permitido incluir novo Município brasileiro neste fluxo. Utilize somente os Municípios já importados.'
    );
  }

  const duplicadas = await sequelize.query<{ id: string }>(
    `
      SELECT id::text
      FROM legio.municipio
      WHERE id_uf = CAST(:ufId AS integer)
        AND lower(btrim(nome)) = lower(btrim(:nome))
      LIMIT 1
    `,
    {
      replacements: {
        ufId: uf.id,
        nome
      },
      type: QueryTypes.SELECT
    }
  );

  if (duplicadas.length > 0) {
    throw new HttpError(
      409,
      'Já existe um Município/Localidade com esse nome na Divisão Administrativa selecionada.'
    );
  }

  const linhas = await sequelize.query<MunicipioOpcao>(
    `
      INSERT INTO legio.municipio
      (
        id_uf,
        nome,
        codigo_ibge,
        codigo
      )
      VALUES
      (
        CAST(:ufId AS integer),
        :nome,
        NULL,
        NULL
      )
      RETURNING
        id::text,
        nome
    `,
    {
      replacements: {
        ufId: uf.id,
        nome
      },
      type: QueryTypes.SELECT
    }
  );

  return linhas[0];
}

export async function listarSubdivisoesLocais(
  municipioIdValor: unknown,
  filtroValor?: unknown
): Promise<SubdivisaoLocalOpcao[]> {
  const municipioId = normalizarId(
    municipioIdValor,
    'um Município/Localidade'
  );
  const filtro = normalizarFiltro(filtroValor);

  const linhas = await sequelize.query<SubdivisaoLocalRow>(
    `
      SELECT
        id::text,
        municipio_id::text,
        nome,
        tipo,
        codigo,
        ativo
      FROM legio.subdivisao_local
      WHERE municipio_id = CAST(:municipioId AS integer)
        AND ativo = TRUE
        AND (
          CAST(:filtro AS varchar) IS NULL
          OR nome ILIKE '%' || CAST(:filtro AS varchar) || '%'
          OR tipo ILIKE '%' || CAST(:filtro AS varchar) || '%'
          OR codigo ILIKE '%' || CAST(:filtro AS varchar) || '%'
        )
      ORDER BY
        tipo NULLS LAST,
        nome
      LIMIT 1000
    `,
    {
      replacements: {
        municipioId,
        filtro
      },
      type: QueryTypes.SELECT
    }
  );

  return linhas.map((item) => ({
    id: item.id,
    municipioId: item.municipio_id,
    nome: item.nome,
    tipo: item.tipo,
    codigo: item.codigo
  }));
}

export async function criarSubdivisaoLocal(
  input: CriarSubdivisaoLocalInput
): Promise<SubdivisaoLocalOpcao> {
  const municipioId = normalizarId(
    input.municipioId,
    'um Município/Localidade'
  );
  const usuarioId = normalizarId(input.usuarioId, 'um usuário');
  const nome = normalizarTextoMaiusculo(input.nome);
  const tipo = normalizarTextoOpcional(input.tipo);
  const codigo = normalizarTextoOpcional(input.codigo);

  if (!nome) {
    throw new HttpError(400, 'Informe o nome da Subdivisão Local.');
  }

  const localizacao = await resolverLocalizacao(municipioId);

  if (ehBrasilSigla(localizacao.pais_sigla)) {
    throw new HttpError(
      400,
      'Não é permitido incluir nova Subdivisão Local brasileira neste fluxo. Utilize somente as subdivisões já cadastradas.'
    );
  }

  const duplicadas = await sequelize.query<{ id: string }>(
    `
      SELECT id::text
      FROM legio.subdivisao_local
      WHERE municipio_id = CAST(:municipioId AS integer)
        AND lower(btrim(nome)) = lower(btrim(:nome))
      LIMIT 1
    `,
    {
      replacements: {
        municipioId,
        nome
      },
      type: QueryTypes.SELECT
    }
  );

  if (duplicadas.length > 0) {
    throw new HttpError(
      409,
      'Já existe uma Subdivisão Local com esse nome no Município/Localidade selecionado.'
    );
  }

  const linhas = await sequelize.query<SubdivisaoLocalRow>(
    `
      INSERT INTO legio.subdivisao_local
      (
        municipio_id,
        nome,
        tipo,
        codigo,
        ativo,
        usu_inc_id,
        usu_alt_id
      )
      VALUES
      (
        CAST(:municipioId AS integer),
        :nome,
        :tipo,
        :codigo,
        TRUE,
        CAST(:usuarioId AS bigint),
        CAST(:usuarioId AS bigint)
      )
      RETURNING
        id::text,
        municipio_id::text,
        nome,
        tipo,
        codigo,
        ativo
    `,
    {
      replacements: {
        municipioId,
        nome,
        tipo,
        codigo,
        usuarioId
      },
      type: QueryTypes.SELECT
    }
  );

  const item = linhas[0];

  return {
    id: item.id,
    municipioId: item.municipio_id,
    nome: item.nome,
    tipo: item.tipo,
    codigo: item.codigo
  };
}

export async function buscarCodigosPostais(
  paisIdValor: unknown,
  codigoPostalValor: unknown,
  municipioIdValor?: unknown
): Promise<CodigoPostalOpcao[]> {
  const pais = await resolverPais(paisIdValor);
  const codigoPostal = normalizarCodigoPostal(codigoPostalValor);

  if (!codigoPostal) {
    throw new HttpError(400, 'Informe o CEP/Código Postal.');
  }

  if (ehBrasilSigla(pais.sigla)) {
    validarCepBrasil(codigoPostal);
  }

  const municipioId = normalizarTextoOpcional(municipioIdValor);

  if (municipioId && !/^\d+$/.test(municipioId)) {
    throw new HttpError(400, 'Município/Localidade inválido.');
  }

  const linhas = await buscarCodigosPostaisInterno(
    pais.id,
    codigoPostal,
    municipioId
  );

  return linhas.map(mapearCodigoPostal);
}

export async function criarCodigoPostal(
  input: CriarCodigoPostalInput
): Promise<CodigoPostalOpcao> {
  const paisId = normalizarId(input.paisId, 'um País');
  const municipioId = normalizarId(
    input.municipioId,
    'um Município/Localidade'
  );
  const usuarioId = normalizarId(input.usuarioId, 'um usuário');
  const codigoPostal = normalizarCodigoPostal(input.codigoPostal);

  if (!codigoPostal) {
    throw new HttpError(400, 'Informe o Código Postal.');
  }

  await bloquearInclusaoBrasil(
    paisId,
    'novo CEP/Código Postal'
  );

  return sequelize.transaction(async (transaction) => {
    return inserirCodigoPostalExterior(
      {
        paisId,
        municipioId,
        subdivisaoLocalId: normalizarTextoOpcional(
          input.subdivisaoLocalId
        ),
        codigoPostal,
        tipoLogradouro: normalizarTextoOpcional(input.tipoLogradouro),
        logradouro: normalizarTextoOpcional(input.logradouro),
        bairro: normalizarTextoOpcional(input.bairro),
        localidade: normalizarTextoOpcional(input.localidade),
        usuarioId
      },
      transaction
    );
  });
}

export async function listarIgrejas(
  municipioIdValor: unknown,
  subdivisaoLocalIdValor?: unknown
): Promise<IgrejaOpcao[]> {
  const municipioId = normalizarId(
    municipioIdValor,
    'um Município/Localidade'
  );

  const subdivisaoLocalId = normalizarTextoOpcional(
    subdivisaoLocalIdValor
  );

  if (
    subdivisaoLocalId &&
    !/^\d+$/.test(subdivisaoLocalId)
  ) {
    throw new HttpError(400, 'Subdivisão Local inválida.');
  }

  const linhas = await sequelize.query<IgrejaRow>(
    `
      SELECT
        i.id::text,
        i.nome,
        i.padre,
        i.status,
        i.codigo_postal_id::text,
        i.subdivisao_local_id::text,
        cp.codigo_postal,
        COALESCE(NULLIF(BTRIM(i.logradouro), ''), cp.logradouro) AS logradouro,
        i.numero_logradouro,
        i.complemento,
        COALESCE(NULLIF(BTRIM(i.bairro), ''), cp.bairro) AS bairro
      FROM legio.igreja i
      LEFT JOIN legio.codigo_postal cp
        ON cp.id = i.codigo_postal_id
      WHERE i.id_municipio = CAST(:municipioId AS integer)
        AND i.status = 'ATIVA'
        AND (
          CAST(:subdivisaoLocalId AS varchar) IS NULL
          OR i.subdivisao_local_id = CAST(:subdivisaoLocalId AS bigint)
        )
      ORDER BY i.nome
    `,
    {
      replacements: {
        municipioId,
        subdivisaoLocalId
      },
      type: QueryTypes.SELECT
    }
  );

  return linhas.map((item) => ({
    id: item.id,
    nome: item.nome,
    padre: item.padre,
    status: item.status,
    codigoPostalId: item.codigo_postal_id,
    subdivisaoLocalId: item.subdivisao_local_id,
    codigoPostal: item.codigo_postal ?? null,
    logradouro: item.logradouro ?? null,
    numeroLogradouro: item.numero_logradouro ?? null,
    complemento: item.complemento ?? null,
    bairro: item.bairro ?? null
  }));
}

export async function criarIgreja(
  input: CriarIgrejaInput
): Promise<IgrejaOpcao> {
  const nome = String(input.nome ?? '').trim();
  const padre = normalizarTextoOpcional(input.padre);
  const municipioId = normalizarId(
    input.municipioId,
    'um Município/Localidade'
  );
  const usuarioId = normalizarId(input.usuarioId, 'um usuário');
  const subdivisaoLocalId = normalizarTextoOpcional(
    input.subdivisaoLocalId
  );

  const tipoLogradouro = normalizarTextoOpcional(input.tipoLogradouro);
  const logradouro = normalizarTextoOpcional(input.logradouro);
  const bairro = normalizarTextoOpcional(input.bairro);
  const localidade = normalizarTextoOpcional(input.localidade);
  const numeroLogradouro = normalizarTextoOpcional(
    input.numeroLogradouro
  );
  const complemento = normalizarTextoOpcional(input.complemento);
  const celular = normalizarTextoOpcional(input.celular);
  const telefone = normalizarTextoOpcional(input.telefone);
  const telefone2 = normalizarTextoOpcional(input.telefone2);
  const email = normalizarTextoOpcional(input.email);
  const site = normalizarTextoOpcional(input.site);

  if (!nome) {
    throw new HttpError(400, 'Informe o nome da Igreja/Paróquia/Sede.');
  }

  return sequelize.transaction(async (transaction) => {
    const localizacao = await resolverLocalizacao(
      municipioId,
      transaction
    );

    if (subdivisaoLocalId) {
      await resolverSubdivisaoLocal(
        subdivisaoLocalId,
        municipioId,
        transaction
      );
    }

    const duplicadas = await sequelize.query<{
      id: string;
      status: string;
    }>(
      `
        SELECT id::text, status
        FROM legio.igreja
        WHERE id_municipio = CAST(:municipioId AS integer)
          AND lower(btrim(nome)) = lower(btrim(:nome))
        LIMIT 1
      `,
      {
        replacements: {
          municipioId,
          nome
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (duplicadas.length > 0) {
      const existente = duplicadas[0];
      const detalhe = existente.status === 'ATIVA'
        ? 'Já existe uma Igreja/Paróquia/Sede ativa com esse nome nessa localidade.'
        : 'Já existe uma Igreja/Paróquia/Sede inativa com esse nome nessa localidade. Reative o cadastro existente em vez de criar outro.';

      throw new HttpError(409, detalhe);
    }

    const codigoPostalId = await obterOuCriarCodigoPostal(
      {
        codigoPostalId: input.codigoPostalId,
        codigoPostal: input.codigoPostal,
        municipioId,
        subdivisaoLocalId,
        localizacao,
        tipoLogradouro,
        logradouro,
        bairro,
        localidade,
        usuarioId
      },
      transaction
    );

    const linhas = await sequelize.query<IgrejaRow>(
      `
        INSERT INTO legio.igreja
        (
          nome,
          padre,
          celular,
          telefone,
          telefone2,
          email,
          site,
          id_municipio,
          subdivisao_local_id,
          codigo_postal_id,
          bairro,
          logradouro,
          numero_logradouro,
          complemento,
          status,
          usu_inc_id,
          usu_alt_id
        )
        VALUES
        (
          :nome,
          :padre,
          :celular,
          :telefone,
          :telefone2,
          :email,
          :site,
          CAST(:municipioId AS integer),
          CAST(:subdivisaoLocalId AS bigint),
          CAST(:codigoPostalId AS bigint),
          :bairro,
          :logradouro,
          :numeroLogradouro,
          :complemento,
          'ATIVA',
          CAST(:usuarioId AS bigint),
          CAST(:usuarioId AS bigint)
        )
        RETURNING
          id::text,
          nome,
          padre,
          status,
          codigo_postal_id::text,
          subdivisao_local_id::text,
          logradouro,
          numero_logradouro,
          complemento,
          bairro
      `,
      {
        replacements: {
          nome,
          padre,
          celular,
          telefone,
          telefone2,
          email,
          site,
          municipioId,
          subdivisaoLocalId,
          codigoPostalId,
          bairro,
          logradouro,
          numeroLogradouro,
          complemento,
          usuarioId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const igreja = linhas[0];

    return {
      id: igreja.id,
      nome: igreja.nome,
      padre: igreja.padre,
      status: igreja.status,
      codigoPostalId: igreja.codigo_postal_id,
      subdivisaoLocalId: igreja.subdivisao_local_id,
      codigoPostal: normalizarCodigoPostal(input.codigoPostal),
      logradouro: igreja.logradouro ?? logradouro,
      numeroLogradouro: igreja.numero_logradouro ?? numeroLogradouro,
      complemento: igreja.complemento ?? complemento,
      bairro: igreja.bairro ?? bairro
    };
  });
}

/**
 * Lista somente unidades aprovadas/ativas para uso como unidade superior.
 */
export async function listar(
  tipoCodigo: string | null
): Promise<UnidadeResumo[]> {
  const tipoNormalizado = tipoCodigo
    ? normalizarTipo(tipoCodigo)
    : null;

  if (tipoNormalizado) {
    await resolverTipo(tipoNormalizado);
  }

  const linhas = await sequelize.query<{
    id: string;
    nome: string;
    nome_reduzido: string | null;
    tipo: string;
    cidade: string | null;
    estado_regiao: string | null;
    unidade_superior_id: string | null;
    status_aprovacao: string;
  }>(
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
        AND ul.status_aprovacao = 'APROVADA'
        AND (
          CAST(:tipoCodigo AS varchar) IS NULL
          OR tu.codigo = CAST(:tipoCodigo AS varchar)
        )
      ORDER BY
        tu.ordem_hierarquica NULLS LAST,
        ul.nome
    `,
    {
      replacements: {
        tipoCodigo: tipoNormalizado
      },
      type: QueryTypes.SELECT
    }
  );

  return linhas.map((item) => ({
    id: item.id,
    nome: item.nome,
    nomeReduzido: item.nome_reduzido,
    tipo: item.tipo,
    cidade: item.cidade,
    estadoRegiao: item.estado_regiao,
    unidadeSuperiorId: item.unidade_superior_id,
    statusAprovacao: item.status_aprovacao
  }));
}

export async function criar(
  input: CriarUnidadeInput
): Promise<UnidadeCriada> {
  const tipoCodigo = normalizarTipo(input.tipoCodigo);
  const nome = normalizarTextoMaiusculo(input.nome);

  if (!nome) {
    throw new HttpError(400, 'Informe o nome da unidade.');
  }

  const municipioId = normalizarId(
    input.municipioId,
    'um Município/Localidade'
  );
  const igrejaId = normalizarId(
    input.igrejaId,
    'uma Igreja/Paróquia/Sede'
  );
  const solicitanteUsuarioId = normalizarId(
    input.solicitanteUsuarioId,
    'um usuário solicitante'
  );

  const nomeReduzido = normalizarTextoOpcionalMaiusculo(
    input.nomeReduzido
  );

  const email = normalizarTextoOpcional(input.email);
  const celular = normalizarTextoOpcional(input.celular);
  const telefone = normalizarTextoOpcional(input.telefone);
  const site = normalizarTextoOpcional(input.site);

  if (email && email.length > 254) {
    throw new HttpError(
      400,
      'O e-mail da unidade deve possuir no máximo 254 caracteres.'
    );
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(
      400,
      'Informe um e-mail válido para a unidade.'
    );
  }

  if (celular && celular.length > 30) {
    throw new HttpError(
      400,
      'O celular da unidade deve possuir no máximo 30 caracteres.'
    );
  }

  if (telefone && telefone.length > 30) {
    throw new HttpError(
      400,
      'O telefone da unidade deve possuir no máximo 30 caracteres.'
    );
  }

  if (site && site.length > 255) {
    throw new HttpError(
      400,
      'O site da unidade deve possuir no máximo 255 caracteres.'
    );
  }

  const dataConstituicao = normalizarTextoOpcional(
    input.dataConstituicao
  );
  const diaReuniaoId = normalizarTextoOpcional(
    input.diaReuniaoId
  );
  const horarioInicioReuniao = normalizarHoraOpcional(
    input.horarioInicioReuniao,
    'o horário de início da reunião'
  );
  const horarioFimReuniao = normalizarHoraOpcional(
    input.horarioFimReuniao,
    'o horário de fim da reunião'
  );
  const fusoHorarioInformado = normalizarTextoOpcional(
    input.fusoHorario
  );
  const observacao = normalizarTextoOpcional(
    input.observacao
  );
  const unidadeSuperiorId = normalizarTextoOpcional(
    input.unidadeSuperiorId
  );

  if (!dataConstituicao) {
    throw new HttpError(
      400,
      'Informe a data de fundação/constituição da unidade.'
    );
  }

  return sequelize.transaction(async (transaction) => {
    const tipo = await resolverTipo(tipoCodigo, transaction);
    const localizacao = await resolverLocalizacao(
      municipioId,
      transaction
    );

    const igreja = await resolverIgreja(
      igrejaId,
      municipioId,
      transaction
    );

    const fusoHorario = await validarFusoHorario(
      fusoHorarioInformado,
      transaction
    );

    if (diaReuniaoId) {
      await resolverDiaReuniao(
        diaReuniaoId,
        transaction
      );
    }

    await validarSuperior(
      tipo,
      unidadeSuperiorId,
      transaction
    );

    const inseridas = await sequelize.query<UnidadeCriadaRow>(
      `
        INSERT INTO legio.unidade_legionaria
        (
          tipo_unidade_id,
          unidade_superior_id,
          nome,
          nome_reduzido,
          email,
          celular,
          telefone,
          site,
          cep,
          logradouro,
          numero_logradouro,
          complemento,
          bairro,
          municipio_id,
          igreja_id,
          cidade,
          estado_regiao,
          pais_codigo,
          data_constituicao,
          dia_reuniao,
          horario_inicio_reuniao,
          horario_fim_reuniao,
          fuso_horario,
          observacao,
          status_aprovacao,
          ativo,
          usu_inc_id,
          usu_alt_id
        )
        VALUES
        (
          :tipoUnidadeId,
          CAST(:unidadeSuperiorId AS bigint),
          :nome,
          :nomeReduzido,
          :email,
          :celular,
          :telefone,
          :site,
          :cep,
          :logradouro,
          :numeroLogradouro,
          :complemento,
          :bairro,
          CAST(:municipioId AS integer),
          CAST(:igrejaId AS bigint),
          :cidade,
          :estadoRegiao,
          :paisCodigo,
          CAST(:dataConstituicao AS date),
          CAST(:diaReuniaoId AS integer),
          CAST(:horarioInicioReuniao AS time),
          CAST(:horarioFimReuniao AS time),
          :fusoHorario,
          :observacao,
          'PENDENTE',
          TRUE,
          CAST(:solicitanteUsuarioId AS bigint),
          CAST(:solicitanteUsuarioId AS bigint)
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
          email,
          celular,
          telefone,
          site,
          cep: igreja.codigo_postal ?? null,
          logradouro: igreja.logradouro ?? null,
          numeroLogradouro: igreja.numero_logradouro ?? null,
          complemento: igreja.complemento ?? null,
          bairro: igreja.bairro ?? null,
          municipioId,
          igrejaId,
          cidade: localizacao.municipio_nome,
          estadoRegiao: localizacao.uf_nome,
          paisCodigo: codigoPaisLegado(localizacao.pais_sigla),
          dataConstituicao,
          diaReuniaoId,
          horarioInicioReuniao,
          horarioFimReuniao,
          fusoHorario,
          observacao,
          solicitanteUsuarioId
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
          solicitanteId: solicitanteUsuarioId,
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

/**
 * Estrutura completa de unidades ativas para a tela de Afiliação.
 * Inclui unidades pendentes para permitir gestão/edição do cadastro.
 */
export async function listarEstrutura(): Promise<UnidadeEstrutura[]> {
  const linhas = await sequelize.query<{
    id: string;
    nome: string;
    nome_reduzido: string | null;
    tipo: string;
    tipo_nome: string;
    unidade_superior_id: string | null;
    unidade_superior_nome: string | null;
    cidade: string | null;
    estado_regiao: string | null;
    status_aprovacao: string;
    ativo: boolean;
  }>(
    `
      SELECT
        ul.id::text,
        ul.nome,
        ul.nome_reduzido,
        tu.codigo AS tipo,
        tu.nome AS tipo_nome,
        ul.unidade_superior_id::text,
        sup.nome AS unidade_superior_nome,
        ul.cidade,
        ul.estado_regiao,
        ul.status_aprovacao,
        ul.ativo
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      LEFT JOIN legio.unidade_legionaria sup
        ON sup.id = ul.unidade_superior_id
      WHERE ul.ativo = TRUE
      ORDER BY
        tu.ordem_hierarquica DESC NULLS LAST,
        ul.nome
    `,
    { type: QueryTypes.SELECT }
  );

  return linhas.map((item) => ({
    id: item.id,
    nome: item.nome,
    nomeReduzido: item.nome_reduzido,
    tipo: item.tipo,
    tipoNome: item.tipo_nome,
    unidadeSuperiorId: item.unidade_superior_id,
    unidadeSuperiorNome: item.unidade_superior_nome,
    cidade: item.cidade,
    estadoRegiao: item.estado_regiao,
    statusAprovacao: item.status_aprovacao,
    ativo: item.ativo
  }));
}

export async function obterPorId(
  idValor: unknown
): Promise<UnidadeDetalhe> {
  const id = normalizarId(idValor, 'uma Unidade');

  const linhas = await sequelize.query<{
    id: string;
    tipo_codigo: string;
    nome: string;
    nome_reduzido: string | null;
    email: string | null;
    celular: string | null;
    telefone: string | null;
    site: string | null;
    municipio_id: string;
    igreja_id: string;
    pais_id: string;
    uf_id: string;
    subdivisao_local_id: string | null;
    codigo_postal_id: string | null;
    codigo_postal: string | null;
    data_constituicao: string | null;
    dia_reuniao: string | null;
    horario_inicio_reuniao: string | null;
    horario_fim_reuniao: string | null;
    fuso_horario: string | null;
    unidade_superior_id: string | null;
    observacao: string | null;
    status_aprovacao: string;
    ativo: boolean;
  }>(
    `
      SELECT
        ul.id::text,
        tu.codigo AS tipo_codigo,
        ul.nome,
        ul.nome_reduzido,
        ul.email,
        ul.celular,
        ul.telefone,
        ul.site,
        ul.municipio_id::text,
        ul.igreja_id::text,
        p.id::text AS pais_id,
        uf.id::text AS uf_id,
        i.subdivisao_local_id::text,
        i.codigo_postal_id::text,
        COALESCE(cp.codigo_postal, ul.cep) AS codigo_postal,
        ul.data_constituicao::text,
        ul.dia_reuniao::text,
        ul.horario_inicio_reuniao::text,
        ul.horario_fim_reuniao::text,
        ul.fuso_horario,
        ul.unidade_superior_id::text,
        ul.observacao,
        ul.status_aprovacao,
        ul.ativo
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      JOIN legio.municipio m
        ON m.id = ul.municipio_id
      JOIN legio.uf uf
        ON uf.id = m.id_uf
      JOIN legio.pais p
        ON p.id = uf.id_pais
      JOIN legio.igreja i
        ON i.id = ul.igreja_id
      LEFT JOIN legio.codigo_postal cp
        ON cp.id = i.codigo_postal_id
      WHERE ul.id = CAST(:id AS bigint)
      LIMIT 1
    `,
    {
      replacements: { id },
      type: QueryTypes.SELECT
    }
  );

  const item = linhas[0];

  if (!item) {
    throw new HttpError(404, 'Unidade não encontrada.');
  }

  return {
    id: item.id,
    tipoCodigo: item.tipo_codigo,
    nome: item.nome,
    nomeReduzido: item.nome_reduzido,
    email: item.email,
    celular: item.celular,
    telefone: item.telefone,
    site: item.site,
    municipioId: item.municipio_id,
    igrejaId: item.igreja_id,
    paisId: item.pais_id,
    ufId: item.uf_id,
    subdivisaoLocalId: item.subdivisao_local_id,
    codigoPostalId: item.codigo_postal_id,
    codigoPostal: item.codigo_postal,
    dataConstituicao: item.data_constituicao,
    diaReuniaoId: item.dia_reuniao,
    horarioInicioReuniao: item.horario_inicio_reuniao?.slice(0, 5) ?? null,
    horarioFimReuniao: item.horario_fim_reuniao?.slice(0, 5) ?? null,
    fusoHorario: item.fuso_horario,
    unidadeSuperiorId: item.unidade_superior_id,
    observacao: item.observacao,
    statusAprovacao: item.status_aprovacao,
    ativo: item.ativo
  };
}

export async function atualizar(
  idValor: unknown,
  input: AtualizarUnidadeInput
): Promise<UnidadeCriada> {
  const id = normalizarId(idValor, 'uma Unidade');
  const tipoCodigo = normalizarTipo(input.tipoCodigo);
  const nome = normalizarTextoMaiusculo(input.nome);

  if (!nome) {
    throw new HttpError(400, 'Informe o nome da unidade.');
  }

  const municipioId = normalizarId(
    input.municipioId,
    'um Município/Localidade'
  );
  const igrejaId = normalizarId(
    input.igrejaId,
    'uma Igreja/Paróquia/Sede'
  );
  const usuarioId = normalizarId(input.usuarioId, 'um usuário');

  const nomeReduzido = normalizarTextoOpcionalMaiusculo(input.nomeReduzido);
  const email = normalizarTextoOpcional(input.email);
  const celular = normalizarTextoOpcional(input.celular);
  const telefone = normalizarTextoOpcional(input.telefone);
  const site = normalizarTextoOpcional(input.site);
  const dataConstituicao = normalizarTextoOpcional(input.dataConstituicao);
  const diaReuniaoId = normalizarTextoOpcional(input.diaReuniaoId);
  const horarioInicioReuniao = normalizarHoraOpcional(
    input.horarioInicioReuniao,
    'o horário de início da reunião'
  );
  const horarioFimReuniao = normalizarHoraOpcional(
    input.horarioFimReuniao,
    'o horário de fim da reunião'
  );
  const fusoHorarioInformado = normalizarTextoOpcional(input.fusoHorario);
  const observacao = normalizarTextoOpcional(input.observacao);
  const unidadeSuperiorId = normalizarTextoOpcional(input.unidadeSuperiorId);

  if (!dataConstituicao) {
    throw new HttpError(
      400,
      'Informe a data de fundação/constituição da unidade.'
    );
  }

  if (unidadeSuperiorId === id) {
    throw new HttpError(400, 'Uma unidade não pode ser superior de si própria.');
  }

  return sequelize.transaction(async (transaction) => {
    const existente = await sequelize.query<{ id: string }>(
      `
        SELECT id::text
        FROM legio.unidade_legionaria
        WHERE id = CAST(:id AS bigint)
          AND ativo = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (!existente[0]) {
      throw new HttpError(404, 'Unidade não encontrada ou já excluída.');
    }

    const tipo = await resolverTipo(tipoCodigo, transaction);
    const localizacao = await resolverLocalizacao(municipioId, transaction);
    const igreja = await resolverIgreja(igrejaId, municipioId, transaction);
    const fusoHorario = await validarFusoHorario(
      fusoHorarioInformado,
      transaction
    );

    if (diaReuniaoId) {
      await resolverDiaReuniao(diaReuniaoId, transaction);
    }

    await validarSuperior(tipo, unidadeSuperiorId, transaction);

    const alteradas = await sequelize.query<UnidadeCriadaRow>(
      `
        UPDATE legio.unidade_legionaria
        SET
          tipo_unidade_id = :tipoUnidadeId,
          unidade_superior_id = CAST(:unidadeSuperiorId AS bigint),
          nome = :nome,
          nome_reduzido = :nomeReduzido,
          email = :email,
          celular = :celular,
          telefone = :telefone,
          site = :site,
          cep = :cep,
          logradouro = :logradouro,
          numero_logradouro = :numeroLogradouro,
          complemento = :complemento,
          bairro = :bairro,
          municipio_id = CAST(:municipioId AS integer),
          igreja_id = CAST(:igrejaId AS bigint),
          cidade = :cidade,
          estado_regiao = :estadoRegiao,
          pais_codigo = :paisCodigo,
          data_constituicao = CAST(:dataConstituicao AS date),
          dia_reuniao = CAST(:diaReuniaoId AS integer),
          horario_inicio_reuniao = CAST(:horarioInicioReuniao AS time),
          horario_fim_reuniao = CAST(:horarioFimReuniao AS time),
          fuso_horario = :fusoHorario,
          observacao = :observacao,
          usu_alt_id = CAST(:usuarioId AS bigint)
        WHERE id = CAST(:id AS bigint)
          AND ativo = TRUE
        RETURNING
          id::text,
          nome,
          cidade,
          estado_regiao,
          status_aprovacao
      `,
      {
        replacements: {
          id,
          tipoUnidadeId: tipo.id,
          unidadeSuperiorId,
          nome,
          nomeReduzido,
          email,
          celular,
          telefone,
          site,
          cep: igreja.codigo_postal ?? null,
          logradouro: igreja.logradouro ?? null,
          numeroLogradouro: igreja.numero_logradouro ?? null,
          complemento: igreja.complemento ?? null,
          bairro: igreja.bairro ?? null,
          municipioId,
          igrejaId,
          cidade: localizacao.municipio_nome,
          estadoRegiao: localizacao.uf_nome,
          paisCodigo: codigoPaisLegado(localizacao.pais_sigla),
          dataConstituicao,
          diaReuniaoId,
          horarioInicioReuniao,
          horarioFimReuniao,
          fusoHorario,
          observacao,
          usuarioId
        },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const unidade = alteradas[0];

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

export async function excluirLogicamente(
  idValor: unknown,
  usuarioIdValor: unknown
): Promise<void> {
  const id = normalizarId(idValor, 'uma Unidade');
  const usuarioId = normalizarId(usuarioIdValor, 'um usuário');

  await sequelize.transaction(async (transaction) => {
    const unidade = await sequelize.query<{ id: string }>(
      `
        SELECT id::text
        FROM legio.unidade_legionaria
        WHERE id = CAST(:id AS bigint)
          AND ativo = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (!unidade[0]) {
      throw new HttpError(404, 'Unidade não encontrada ou já excluída.');
    }

    const filhos = await sequelize.query<{ quantidade: string }>(
      `
        SELECT COUNT(*)::text AS quantidade
        FROM legio.unidade_legionaria
        WHERE unidade_superior_id = CAST(:id AS bigint)
          AND ativo = TRUE
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    if (Number(filhos[0]?.quantidade ?? 0) > 0) {
      throw new HttpError(
        409,
        'A unidade possui unidades subordinadas ativas. Realoque ou exclua as subordinadas antes de excluir esta unidade.'
      );
    }

    await sequelize.query(
      `
        UPDATE legio.unidade_legionaria
        SET
          ativo = FALSE,
          usu_alt_id = CAST(:usuarioId AS bigint)
        WHERE id = CAST(:id AS bigint)
      `,
      {
        replacements: { id, usuarioId },
        transaction
      }
    );
  });
}

