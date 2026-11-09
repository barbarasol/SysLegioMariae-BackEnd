import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

/** Data de Elevação: validação no servidor, incluindo ano bissexto. */
function normalizarDataElevacao(tipoCodigo: string, valor: unknown): string | null {
  const relevante = ['COMITIUM', 'COMITIA', 'REGIA', 'SENATUS'].includes(
    String(tipoCodigo ?? '').trim().toUpperCase()
  );
  if (!relevante) return null;
  const data = String(valor ?? '').trim();
  if (!data) throw new HttpError(400, 'Informe a Data de Elevação da unidade.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new HttpError(400, 'Data de Elevação deve estar em AAAA-MM-DD.');
  }
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() + 1 !== mes || d.getUTCDate() !== dia) {
    throw new HttpError(400, 'Data de Elevação inválida.');
  }
  return data;
}


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
  subdivisao_local_id: string | null;
  codigo_postal?: string | null;
  logradouro?: string | null;
  numero_logradouro?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  celular?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  email?: string | null;
  site?: string | null;
};


type CepBrasilExterno = {
  cep: string;
  uf: string;
  cidade: string;
  bairro: string | null;
  logradouro: string | null;
  codigoIbge: string | null;
  fonte: 'BRASILAPI' | 'VIACEP';
};

type BrasilApiCepResponse = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string | null;
  street?: string | null;
  service?: string;
  ibge?: {
    city?: string | number | null;
    state?: string | number | null;
  } | null;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  localidade?: string;
  uf?: string;
  ibge?: string | null;
  erro?: boolean | string;
};

type CodigoPostalSubdivisaoRow = {
  subdivisao_local_id: string;
  subdivisao_local_nome: string;
  subdivisao_local_tipo: string | null;
  subdivisao_local_codigo: string | null;
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
  subdivisaoLocalId?: string | null; // RA da unidade selecionada no cadastro
  // Endereço da sede: independente do endereço cadastrado na paróquia.
  sedeEnderecoProprio?: boolean;
  copiarEnderecoParoquia?: boolean; // ação explícita; nunca implícita na edição
  sedeSubdivisaoLocalId?: string | null;
  sedeCodigoPostal?: string | null;
  sedeLogradouro?: string | null;
  sedeNumeroLogradouro?: string | null;
  sedeComplemento?: string | null;
  sedeBairro?: string | null;
  dataConstituicao?: string | null;
  dataElevacao?: string | null;
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
  ufSigla: string | null;
  subdivisaoLocalNome: string | null;
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
  subdivisaoLocalId: string | null; // subdivisão da paróquia
  codigoPostal: string | null; // CEP da paróquia
  sedeEnderecoProprio: boolean;
  sedeSubdivisaoLocalId: string | null;
  sedeCodigoPostal: string | null;
  sedeLogradouro: string | null;
  sedeNumeroLogradouro: string | null;
  sedeComplemento: string | null;
  sedeBairro: string | null;
  dataConstituicao: string | null;
  dataElevacao: string | null;
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
  subdivisaoLocalId: string | null;
  codigoPostal: string | null;
  logradouro: string | null;
  numeroLogradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  celular: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
  site: string | null;
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

function normalizarComparacao(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function ehMunicipioBrasilia(localizacao: LocalizacaoRow): boolean {
  return (
    normalizarComparacao(localizacao.uf_sigla) === 'DF' &&
    normalizarComparacao(localizacao.municipio_nome) === 'BRASILIA'
  );
}

function formatarCepBrasil(cep: string): string {
  const numeros = String(cep ?? '').replace(/\D/g, '').slice(0, 8);
  return numeros.length === 8
    ? `${numeros.slice(0, 5)}-${numeros.slice(5)}`
    : numeros;
}

function montarCodigoPostalOpcao(
  endereco: CepBrasilExterno,
  localizacao: LocalizacaoRow,
  subdivisao?: CodigoPostalSubdivisaoRow | null
): CodigoPostalOpcao {
  const subdivisaoId = subdivisao?.subdivisao_local_id ?? null;

  return {
    // Identificador transitório somente para seleção no frontend.
    // Não corresponde a uma linha de banco de dados.
    id: `API:${endereco.cep}:${subdivisaoId ?? 'SEM_SUBDIVISAO'}`,
    paisId: localizacao.pais_id,
    ufId: localizacao.uf_id,
    municipioId: localizacao.municipio_id,
    subdivisaoLocalId: subdivisaoId,
    codigoPostal: formatarCepBrasil(endereco.cep),
    tipoLogradouro: null,
    logradouro: endereco.logradouro,
    bairro: endereco.bairro,
    localidade: endereco.cidade,
    fonte: endereco.fonte,
    municipioNome: localizacao.municipio_nome,
    ufNome: localizacao.uf_nome,
    ufSigla: localizacao.uf_sigla,
    subdivisaoLocalNome: subdivisao?.subdivisao_local_nome ?? null,
    subdivisaoLocalTipo: subdivisao?.subdivisao_local_tipo ?? null,
    subdivisaoLocalCodigo: subdivisao?.subdivisao_local_codigo ?? null,
    paisNome: localizacao.pais_nome,
    paisSigla: localizacao.pais_sigla
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
        i.subdivisao_local_id::text,
        i.codigo_postal,
        i.logradouro,
        i.numero_logradouro,
        i.complemento,
        i.bairro
      FROM legio.igreja i
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


/**
 * Mantém dois endereços autônomos: Igreja/Paróquia em legio.igreja e sede
 * própria (ou cópia de compatibilidade) em legio.unidade_legionaria.
 * O município da sede é sempre unidade_legionaria.municipio_id.
 */
async function resolverEnderecoSede(
  input: CriarUnidadeInput | AtualizarUnidadeInput,
  igreja: IgrejaRow,
  municipioId: string,
  transaction?: Transaction
): Promise<{
  subdivisaoLocalId: string | null;
  codigoPostal: string | null;
  logradouro: string | null;
  numeroLogradouro: string | null;
  complemento: string | null;
  bairro: string | null;
}> {
  if (input.sedeEnderecoProprio !== true) {
    // Na inclusão, o seletor de RA da unidade pode sobrescrever somente a RA
    // copiada da paróquia, sem alterar endereço nem o cadastro da igreja.
    const raInformada = normalizarTextoOpcional(input.subdivisaoLocalId);
    if (raInformada) {
      await resolverSubdivisaoLocal(raInformada, municipioId, transaction);
    }
    return {
      subdivisaoLocalId: raInformada ?? igreja.subdivisao_local_id,
      codigoPostal: igreja.codigo_postal ?? null,
      logradouro: igreja.logradouro ?? null,
      numeroLogradouro: igreja.numero_logradouro ?? null,
      complemento: igreja.complemento ?? null,
      bairro: igreja.bairro ?? null
    };
  }

  const subdivisaoLocalId = normalizarTextoOpcional(input.sedeSubdivisaoLocalId);
  if (subdivisaoLocalId) {
    // Impede associação da subdivisão de outro município à sede.
    await resolverSubdivisaoLocal(subdivisaoLocalId, municipioId, transaction);
  }

  const codigoPostal = normalizarTextoOpcionalMaiusculo(input.sedeCodigoPostal);
  const logradouro = normalizarTextoOpcionalMaiusculo(input.sedeLogradouro);
  const numeroLogradouro = normalizarTextoOpcionalMaiusculo(input.sedeNumeroLogradouro);
  const complemento = normalizarTextoOpcionalMaiusculo(input.sedeComplemento);
  const bairro = normalizarTextoOpcionalMaiusculo(input.sedeBairro);

  if (!logradouro) {
    throw new HttpError(400, 'Informe o logradouro da sede própria da unidade.');
  }
  if (codigoPostal && codigoPostal.length > 20) {
    throw new HttpError(400, 'O CEP/Código Postal da sede aceita no máximo 20 caracteres.');
  }
  if (logradouro.length > 200 || (numeroLogradouro?.length ?? 0) > 30 ||
      (complemento?.length ?? 0) > 150 || (bairro?.length ?? 0) > 120) {
    throw new HttpError(400, 'Endereço da sede excede o limite permitido.');
  }

  return { subdivisaoLocalId, codigoPostal, logradouro,
    numeroLogradouro, complemento, bairro };
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

const BRASIL_API_CEP_BASE_URL = (
  process.env.BRASIL_API_CEP_BASE_URL ??
  'https://brasilapi.com.br/api/cep/v1'
).replace(/\/+$/, '');

const VIA_CEP_BASE_URL = (
  process.env.VIA_CEP_BASE_URL ??
  'https://viacep.com.br/ws'
).replace(/\/+$/, '');

const CEP_API_TIMEOUT_MS = 4500;

async function fetchJsonComTimeout<T>(
  url: string,
  timeoutMs = CEP_API_TIMEOUT_MS
): Promise<{
  status: number;
  ok: boolean;
  body: T | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SysLegioMariae/1.0 CEP lookup'
      },
      signal: controller.signal
    });

    let body: T | null = null;

    try {
      body = await response.json() as T;
    } catch {
      body = null;
    }

    return {
      status: response.status,
      ok: response.ok,
      body
    };
  } finally {
    clearTimeout(timer);
  }
}

async function consultarBrasilApiCep(
  cep: string
): Promise<CepBrasilExterno | null> {
  const resposta = await fetchJsonComTimeout<BrasilApiCepResponse>(
    `${BRASIL_API_CEP_BASE_URL}/${encodeURIComponent(cep)}`
  );

  if (resposta.status === 404) {
    return null;
  }

  if (!resposta.ok || !resposta.body) {
    throw new Error(
      `BrasilAPI indisponível para o CEP consultado (HTTP ${resposta.status}).`
    );
  }

  const body = resposta.body;
  const uf = String(body.state ?? '').trim().toUpperCase();
  const cidade = String(body.city ?? '').trim();

  if (!uf || !cidade) {
    return null;
  }

  return {
    cep,
    uf,
    cidade,
    bairro: normalizarTextoOpcional(body.neighborhood),
    logradouro: normalizarTextoOpcional(body.street),
    codigoIbge: normalizarTextoOpcional(body.ibge?.city),
    fonte: 'BRASILAPI'
  };
}

async function consultarViaCep(
  cep: string
): Promise<CepBrasilExterno | null> {
  const resposta = await fetchJsonComTimeout<ViaCepResponse>(
    `${VIA_CEP_BASE_URL}/${encodeURIComponent(cep)}/json/`
  );

  if (resposta.status === 404) {
    return null;
  }

  if (!resposta.ok || !resposta.body) {
    throw new Error(
      `ViaCEP indisponível para o CEP consultado (HTTP ${resposta.status}).`
    );
  }

  const body = resposta.body;
  const naoEncontrado =
    body.erro === true ||
    String(body.erro ?? '').toLowerCase() === 'true';

  if (naoEncontrado) {
    return null;
  }

  const uf = String(body.uf ?? '').trim().toUpperCase();
  const cidade = String(body.localidade ?? '').trim();

  if (!uf || !cidade) {
    return null;
  }

  return {
    cep,
    uf,
    cidade,
    bairro: normalizarTextoOpcional(body.bairro),
    logradouro: normalizarTextoOpcional(body.logradouro),
    codigoIbge: normalizarTextoOpcional(body.ibge),
    fonte: 'VIACEP'
  };
}

async function consultarCepBrasilExterno(
  cep: string
): Promise<CepBrasilExterno> {
  let brasilApiFalhou = false;
  let viaCepFalhou = false;

  try {
    const brasilApi = await consultarBrasilApiCep(cep);

    if (brasilApi) {
      return brasilApi;
    }
  } catch {
    brasilApiFalhou = true;
  }

  try {
    const viaCep = await consultarViaCep(cep);

    if (viaCep) {
      return viaCep;
    }
  } catch {
    viaCepFalhou = true;
  }

  if (brasilApiFalhou && viaCepFalhou) {
    throw new HttpError(
      503,
      'Os serviços públicos de consulta de CEP estão temporariamente indisponíveis. Tente novamente.'
    );
  }

  throw new HttpError(
    404,
    'CEP não encontrado nos serviços públicos consultados.'
  );
}

async function resolverLocalizacaoCepBrasil(
  cep: CepBrasilExterno
): Promise<LocalizacaoRow> {
  const codigoIbge = String(cep.codigoIbge ?? '')
    .replace(/\D/g, '')
    .slice(0, 7);

  if (codigoIbge) {
    const porIbge = await sequelize.query<LocalizacaoRow>(
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
        WHERE p.sigla = 'BR'
          AND m.codigo_ibge = CAST(:codigoIbge AS integer)
        LIMIT 1
      `,
      {
        replacements: { codigoIbge },
        type: QueryTypes.SELECT
      }
    );

    if (porIbge[0]) {
      return porIbge[0];
    }
  }

  const porNome = await sequelize.query<LocalizacaoRow>(
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
      WHERE p.sigla = 'BR'
        AND upper(COALESCE(u.sigla, '')) = upper(:uf)
        AND upper(btrim(m.nome)) = upper(btrim(:cidade))
      LIMIT 1
    `,
    {
      replacements: {
        uf: cep.uf,
        cidade: cep.cidade
      },
      type: QueryTypes.SELECT
    }
  );

  if (porNome[0]) {
    return porNome[0];
  }

  throw new HttpError(
    422,
    `O CEP foi localizado, porém o Município/Localidade "${cep.cidade}/${cep.uf}" não existe na base local.`
  );
}

async function listarSubdivisoesCepBrasilia(
  codigoPostal: string,
  municipioId: string,
  transaction?: Transaction
): Promise<CodigoPostalSubdivisaoRow[]> {
  return sequelize.query<CodigoPostalSubdivisaoRow>(
    `
      SELECT
        cps.subdivisao_local_id::text,
        sl.nome AS subdivisao_local_nome,
        sl.tipo AS subdivisao_local_tipo,
        sl.codigo AS subdivisao_local_codigo
      FROM legio.codigo_postal_subdivisao cps
      JOIN legio.subdivisao_local sl
        ON sl.id = cps.subdivisao_local_id
       AND sl.ativo = TRUE
      WHERE cps.ativo = TRUE
        AND sl.municipio_id = CAST(:municipioId AS integer)
        AND regexp_replace(cps.codigo_postal, '[^0-9]', '', 'g')
          = regexp_replace(:codigoPostal, '[^0-9]', '', 'g')
      ORDER BY sl.nome, sl.id
    `,
    {
      replacements: {
        codigoPostal,
        municipioId
      },
      type: QueryTypes.SELECT,
      transaction
    }
  );
}

async function consultarCepBrasilSomenteApi(
  codigoPostal: string
): Promise<CodigoPostalOpcao[]> {
  const cepNumerico = codigoPostal.replace(/\D/g, '');
  const endereco = await consultarCepBrasilExterno(cepNumerico);
  const localizacao = await resolverLocalizacaoCepBrasil(endereco);

  // A única consulta de CEP ao banco ocorre para Brasília/DF,
  // exclusivamente para descobrir a Região Administrativa.
  const subdivisoes = ehMunicipioBrasilia(localizacao)
    ? await listarSubdivisoesCepBrasilia(
        endereco.cep,
        localizacao.municipio_id
      )
    : [];

  if (subdivisoes.length === 0) {
    return [
      montarCodigoPostalOpcao(
        endereco,
        localizacao,
        null
      )
    ];
  }

  return subdivisoes.map((subdivisao) =>
    montarCodigoPostalOpcao(
      endereco,
      localizacao,
      subdivisao
    )
  );
}

async function prepararEnderecoIgreja(
  input: {
    codigoPostal?: string | null;
    municipioId: string;
    subdivisaoLocalId?: string | null;
    localizacao: LocalizacaoRow;
    logradouro?: string | null;
    bairro?: string | null;
    localidade?: string | null;
  }
): Promise<{
  codigoPostal: string | null;
  subdivisaoLocalId: string | null;
  logradouro: string | null;
  bairro: string | null;
  localidade: string | null;
}> {
  const codigoPostal = normalizarCodigoPostal(input.codigoPostal);
  let subdivisaoLocalId = input.subdivisaoLocalId ?? null;
  let logradouro = normalizarTextoOpcional(input.logradouro);
  let bairro = normalizarTextoOpcional(input.bairro);
  let localidade = normalizarTextoOpcional(input.localidade);

  if (subdivisaoLocalId) {
    await resolverSubdivisaoLocal(
      subdivisaoLocalId,
      input.municipioId
    );
  }

  // Exterior: o Código Postal é informação do endereço da Igreja e
  // é armazenado diretamente em legio.igreja, sem tabela catálogo.
  if (!ehBrasilSigla(input.localizacao.pais_sigla)) {
    return {
      codigoPostal,
      subdivisaoLocalId,
      logradouro,
      bairro,
      localidade: localidade ?? input.localizacao.municipio_nome
    };
  }

  if (!codigoPostal) {
    return {
      codigoPostal: null,
      subdivisaoLocalId,
      logradouro,
      bairro,
      localidade: input.localizacao.municipio_nome
    };
  }

  validarCepBrasil(codigoPostal);

  const enderecoApi = await consultarCepBrasilExterno(
    codigoPostal.replace(/\D/g, '')
  );
  const localizacaoApi = await resolverLocalizacaoCepBrasil(enderecoApi);

  if (
    localizacaoApi.pais_id !== input.localizacao.pais_id ||
    localizacaoApi.uf_id !== input.localizacao.uf_id ||
    localizacaoApi.municipio_id !== input.municipioId
  ) {
    throw new HttpError(
      400,
      `O CEP informado pertence a ${localizacaoApi.municipio_nome}/${localizacaoApi.uf_sigla ?? localizacaoApi.uf_nome}, e não ao Município/Localidade selecionado.`
    );
  }

  if (ehMunicipioBrasilia(localizacaoApi)) {
    const subdivisoesMapeadas = await listarSubdivisoesCepBrasilia(
      enderecoApi.cep,
      input.municipioId
    );

    if (subdivisoesMapeadas.length === 1) {
      const unica = subdivisoesMapeadas[0].subdivisao_local_id;

      if (subdivisaoLocalId && subdivisaoLocalId !== unica) {
        throw new HttpError(
          400,
          'A Região Administrativa selecionada não corresponde ao mapeamento desse CEP em Brasília.'
        );
      }

      subdivisaoLocalId = unica;
    } else if (subdivisoesMapeadas.length > 1) {
      const idsPermitidos = new Set(
        subdivisoesMapeadas.map((item) => item.subdivisao_local_id)
      );

      if (!subdivisaoLocalId) {
        throw new HttpError(
          400,
          'Este CEP possui mais de uma Região Administrativa possível em Brasília. Selecione a Subdivisão Local correspondente ao endereço.'
        );
      }

      if (!idsPermitidos.has(subdivisaoLocalId)) {
        throw new HttpError(
          400,
          'A Região Administrativa selecionada não corresponde às opções mapeadas para esse CEP em Brasília.'
        );
      }
    }
    // Se o CEP de Brasília não estiver no mapeamento, preservamos a
    // Subdivisão Local escolhida manualmente pelo usuário, quando houver.
  }

  return {
    codigoPostal: formatarCepBrasil(enderecoApi.cep),
    subdivisaoLocalId,
    logradouro: enderecoApi.logradouro ?? logradouro,
    bairro: enderecoApi.bairro ?? bairro,
    localidade: enderecoApi.cidade
  };
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
  codigoPostalValor: unknown
): Promise<CodigoPostalOpcao[]> {
  const pais = await resolverPais(paisIdValor);
  const codigoPostal = normalizarCodigoPostal(codigoPostalValor);

  if (!codigoPostal) {
    throw new HttpError(400, 'Informe o CEP/Código Postal.');
  }

  // Brasil: consulta sempre os serviços públicos. Não há cache em
  // legio.codigo_postal e nenhum endereço de CEP é lido dessa tabela.
  if (ehBrasilSigla(pais.sigla)) {
    validarCepBrasil(codigoPostal);
    return consultarCepBrasilSomenteApi(codigoPostal);
  }

  // Para o exterior não mantemos catálogo de códigos postais.
  // O código é informado no cadastro da Igreja/Paróquia/Sede e
  // persistido diretamente nela.
  return [];
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
        i.subdivisao_local_id::text,
        i.codigo_postal,
        i.logradouro,
        i.numero_logradouro,
        i.complemento,
        i.bairro,
        i.celular,
        i.telefone,
        i.telefone2,
        i.email,
        i.site
      FROM legio.igreja i
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
    subdivisaoLocalId: item.subdivisao_local_id,
    codigoPostal: item.codigo_postal ?? null,
    logradouro: item.logradouro ?? null,
    numeroLogradouro: item.numero_logradouro ?? null,
    complemento: item.complemento ?? null,
    bairro: item.bairro ?? null,
    celular: item.celular ?? null,
    telefone: item.telefone ?? null,
    telefone2: item.telefone2 ?? null,
    email: item.email ?? null,
    site: item.site ?? null
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
  const subdivisaoLocalIdInformada = normalizarTextoOpcional(
    input.subdivisaoLocalId
  );

  const logradouroInformado = normalizarTextoOpcional(input.logradouro);
  const bairroInformado = normalizarTextoOpcional(input.bairro);
  const localidadeInformada = normalizarTextoOpcional(input.localidade);
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

  // Resolve e valida a localização antes de abrir a transação. Para CEP
  // brasileiro, a consulta externa também ocorre aqui para não manter uma
  // transação do PostgreSQL aberta durante chamada HTTP.
  const localizacao = await resolverLocalizacao(municipioId);
  const endereco = await prepararEnderecoIgreja({
    codigoPostal: input.codigoPostal,
    municipioId,
    subdivisaoLocalId: subdivisaoLocalIdInformada,
    localizacao,
    logradouro: logradouroInformado,
    bairro: bairroInformado,
    localidade: localidadeInformada
  });

  return sequelize.transaction(async (transaction) => {
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
          codigo_postal,
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
          :codigoPostal,
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
          subdivisao_local_id::text,
          codigo_postal,
          logradouro,
          numero_logradouro,
          complemento,
          bairro,
          celular,
          telefone,
          telefone2,
          email,
          site
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
          subdivisaoLocalId: endereco.subdivisaoLocalId,
          codigoPostal: endereco.codigoPostal,
          bairro: endereco.bairro,
          logradouro: endereco.logradouro,
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
      subdivisaoLocalId: igreja.subdivisao_local_id,
      codigoPostal: igreja.codigo_postal ?? null,
      logradouro: igreja.logradouro ?? endereco.logradouro,
      numeroLogradouro: igreja.numero_logradouro ?? numeroLogradouro,
      complemento: igreja.complemento ?? complemento,
      bairro: igreja.bairro ?? endereco.bairro,
      celular: igreja.celular ?? celular,
      telefone: igreja.telefone ?? telefone,
      telefone2: igreja.telefone2 ?? telefone2,
      email: igreja.email ?? email,
      site: igreja.site ?? site
    };
  });
}


/**
 * Corrige uma igreja existente, sem alterar os campos de endereço das unidades
 * que a referenciam. Autoriza administrador global, responsável por uma unidade
 * vinculada à igreja ou autor do cadastro (somente conta ativa).
 */
export async function atualizarIgreja(
  igrejaIdValor: unknown,
  input: CriarIgrejaInput
): Promise<IgrejaOpcao> {
  const igrejaId = normalizarId(igrejaIdValor, 'uma Igreja/Paróquia/Sede');
  const usuarioId = normalizarId(input.usuarioId, 'um usuário');
  const municipioId = normalizarId(input.municipioId, 'um Município/Localidade');
  const nome = normalizarTextoMaiusculo(input.nome);
  if (!nome || nome.length > 180) {
    throw new HttpError(400, 'Informe um nome válido para a Igreja/Paróquia/Sede.');
  }
  const localizacao = await resolverLocalizacao(municipioId);
  const endereco = await prepararEnderecoIgreja({
    codigoPostal: input.codigoPostal,
    municipioId,
    subdivisaoLocalId: input.subdivisaoLocalId,
    localizacao,
    logradouro: input.logradouro,
    bairro: input.bairro,
    localidade: input.localidade
  });
  const valor = (v: unknown) => normalizarTextoOpcional(v);
  const maiusculo = (v: unknown) => normalizarTextoOpcionalMaiusculo(v);
  const campos = {
    nome,
    padre: maiusculo(input.padre),
    celular: valor(input.celular),
    telefone: valor(input.telefone),
    telefone2: valor(input.telefone2),
    email: valor(input.email),
    site: valor(input.site),
    numeroLogradouro: maiusculo(input.numeroLogradouro),
    complemento: maiusculo(input.complemento),
    logradouro: maiusculo(endereco.logradouro),
    bairro: maiusculo(endereco.bairro),
    codigoPostal: endereco.codigoPostal,
    subdivisaoLocalId: endereco.subdivisaoLocalId
  };
  return sequelize.transaction(async (transaction) => {
    const atuais = await sequelize.query<{
      id: string;
      id_municipio: string;
      usu_inc_id: string | null;
    }>(`
      SELECT id::text, id_municipio::text, usu_inc_id::text
      FROM legio.igreja
      WHERE id = CAST(:igrejaId AS bigint) AND status = 'ATIVA'
      FOR UPDATE
    `, { replacements: { igrejaId }, type: QueryTypes.SELECT, transaction });
    if (!atuais[0]) throw new HttpError(404, 'Igreja/Paróquia/Sede não encontrada ou inativa.');
    if (atuais[0].id_municipio !== municipioId) {
      throw new HttpError(400, 'Não é permitido alterar o município de uma igreja vinculada. Corrija o endereço dentro do município atual.');
    }
    const permissoes = await sequelize.query<{ pode_editar: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM legio.usuario u
        WHERE u.id = CAST(:usuarioId AS bigint) AND u.status = 'ATIVO' AND (
          EXISTS (
            SELECT 1 FROM legio.usuario_perfil_global up
            JOIN legio.perfil_acesso pa ON pa.id = up.perfil_id
            WHERE up.usuario_id = u.id AND pa.ativo = TRUE
              AND pa.codigo IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN')
          ) OR EXISTS (
            SELECT 1 FROM legio.usuario_unidade_perfil up
            JOIN legio.perfil_acesso pa ON pa.id = up.perfil_id
            JOIN legio.unidade_legionaria ul ON ul.id = up.unidade_id
            WHERE up.usuario_id = u.id AND up.ativo = TRUE AND pa.ativo = TRUE
              AND pa.codigo IN ('ADMIN_UNIDADE', 'OPERADOR')
              AND ul.igreja_id = CAST(:igrejaId AS bigint) AND ul.ativo = TRUE
          ) OR EXISTS (
            SELECT 1 FROM legio.igreja i
            WHERE i.id = CAST(:igrejaId AS bigint) AND i.usu_inc_id = u.id
          )
        )
      ) AS pode_editar
    `, { replacements: { usuarioId, igrejaId }, type: QueryTypes.SELECT, transaction });
    if (!permissoes[0]?.pode_editar) {
      throw new HttpError(403, 'Seu perfil não pode editar esta Igreja/Paróquia/Sede.');
    }
    const repetidos = await sequelize.query<{ id: string }>(`
      SELECT id::text FROM legio.igreja
      WHERE id <> CAST(:igrejaId AS bigint)
        AND id_municipio = CAST(:municipioId AS integer)
        AND lower(btrim(nome)) = lower(btrim(:nome)) LIMIT 1
    `, { replacements: { igrejaId, municipioId, nome }, type: QueryTypes.SELECT, transaction });
    if (repetidos[0]) throw new HttpError(409, 'Já existe uma Igreja/Paróquia/Sede com esse nome no município.');
    const resultado = await sequelize.query<IgrejaRow>(`
      UPDATE legio.igreja SET
        nome = :nome, padre = :padre,
        celular = :celular, telefone = :telefone, telefone2 = :telefone2,
        email = :email, site = :site,
        subdivisao_local_id = CAST(:subdivisaoLocalId AS bigint),
        codigo_postal = :codigoPostal, logradouro = :logradouro,
        numero_logradouro = :numeroLogradouro, complemento = :complemento,
        bairro = :bairro, usu_alt_id = CAST(:usuarioId AS bigint),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = CAST(:igrejaId AS bigint)
      RETURNING id::text, nome, padre, status, subdivisao_local_id::text,
        codigo_postal, logradouro, numero_logradouro, complemento,
        bairro, celular, telefone, telefone2, email, site
    `, {
      replacements: { igrejaId, municipioId, usuarioId, ...campos },
      type: QueryTypes.SELECT, transaction
    });
    const igreja = resultado[0];
    if (!igreja) throw new HttpError(404, 'Não foi possível atualizar a igreja.');
    return {
      id: igreja.id, nome: igreja.nome, padre: igreja.padre, status: igreja.status,
      subdivisaoLocalId: igreja.subdivisao_local_id,
      codigoPostal: igreja.codigo_postal ?? null,
      logradouro: igreja.logradouro ?? null,
      numeroLogradouro: igreja.numero_logradouro ?? null,
      complemento: igreja.complemento ?? null,
      bairro: igreja.bairro ?? null,
      celular: igreja.celular ?? null, telefone: igreja.telefone ?? null,
      telefone2: igreja.telefone2 ?? null, email: igreja.email ?? null,
      site: igreja.site ?? null
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
        m.nome AS cidade,
        uf.nome AS estado_regiao,
        ul.unidade_superior_id::text,
        ul.status_aprovacao
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      LEFT JOIN legio.municipio m ON m.id = ul.municipio_id
      LEFT JOIN legio.uf uf ON uf.id = m.id_uf
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
  const dataElevacao = normalizarDataElevacao(tipoCodigo, input.dataElevacao);
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
    const sede = await resolverEnderecoSede(input, igreja, municipioId, transaction);

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
          subdivisao_local_id,
          municipio_id,
          igreja_id,
          cidade,
          estado_regiao,
          pais_codigo,
          data_constituicao,
          data_elevacao,
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
          CAST(:sedeSubdivisaoLocalId AS bigint),
          CAST(:municipioId AS integer),
          CAST(:igrejaId AS bigint),
          :cidade,
          :estadoRegiao,
          :paisCodigo,
          CAST(:dataConstituicao AS date),
          CAST(:dataElevacao AS date),
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
          cep: sede.codigoPostal,
          logradouro: sede.logradouro,
          numeroLogradouro: sede.numeroLogradouro,
          complemento: sede.complemento,
          bairro: sede.bairro,
          sedeSubdivisaoLocalId: sede.subdivisaoLocalId,
          municipioId,
          igrejaId,
          cidade: localizacao.municipio_nome,
          estadoRegiao: localizacao.uf_nome,
          paisCodigo: codigoPaisLegado(localizacao.pais_sigla),
          dataConstituicao,
          dataElevacao,
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
    uf_sigla: string | null;
    subdivisao_local_nome: string | null;
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
        m.nome AS cidade,
        uf.nome AS estado_regiao,
        uf.sigla AS uf_sigla,
        sl.nome AS subdivisao_local_nome,
        ul.status_aprovacao,
        ul.ativo
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu
        ON tu.id = ul.tipo_unidade_id
      LEFT JOIN legio.unidade_legionaria sup
        ON sup.id = ul.unidade_superior_id
      LEFT JOIN legio.municipio m
        ON m.id = ul.municipio_id
      LEFT JOIN legio.uf uf
        ON uf.id = m.id_uf
      LEFT JOIN legio.subdivisao_local sl
        ON sl.id = ul.subdivisao_local_id
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
    ufSigla: item.uf_sigla,
    subdivisaoLocalNome: item.subdivisao_local_nome,
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
    codigo_postal: string | null;
    sede_endereco_proprio: boolean;
    sede_subdivisao_local_id: string | null;
    sede_codigo_postal: string | null;
    sede_logradouro: string | null;
    sede_numero_logradouro: string | null;
    sede_complemento: string | null;
    sede_bairro: string | null;
    data_constituicao: string | null;
    data_elevacao: string | null;
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
        i.codigo_postal AS codigo_postal,
        ul.subdivisao_local_id::text AS sede_subdivisao_local_id,
        ul.cep AS sede_codigo_postal,
        ul.logradouro AS sede_logradouro,
        ul.numero_logradouro AS sede_numero_logradouro,
        ul.complemento AS sede_complemento,
        ul.bairro AS sede_bairro,
        (
          ul.cep IS DISTINCT FROM i.codigo_postal OR
          ul.logradouro IS DISTINCT FROM i.logradouro OR
          ul.numero_logradouro IS DISTINCT FROM i.numero_logradouro OR
          ul.complemento IS DISTINCT FROM i.complemento OR
          ul.bairro IS DISTINCT FROM i.bairro
        ) AS sede_endereco_proprio,
        ul.data_constituicao::text,
        ul.data_elevacao::text,
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
    codigoPostal: item.codigo_postal,
    sedeEnderecoProprio: item.sede_endereco_proprio,
    sedeSubdivisaoLocalId: item.sede_subdivisao_local_id,
    sedeCodigoPostal: item.sede_codigo_postal,
    sedeLogradouro: item.sede_logradouro,
    sedeNumeroLogradouro: item.sede_numero_logradouro,
    sedeComplemento: item.sede_complemento,
    sedeBairro: item.sede_bairro,
    dataConstituicao: item.data_constituicao,
    dataElevacao: item.data_elevacao,
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
  const dataElevacao = normalizarDataElevacao(tipoCodigo, input.dataElevacao);
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
    // Ao editar, o endereço da unidade não muda ao corrigir / trocar igreja.
    // A cópia dos dados da igreja exige um comando explícito do formulário.
    let sede: Awaited<ReturnType<typeof resolverEnderecoSede>>;
    if (input.sedeEnderecoProprio === true || input.copiarEnderecoParoquia === true) {
      sede = await resolverEnderecoSede(
        { ...input,
          sedeEnderecoProprio: input.copiarEnderecoParoquia === true ? false : true,
          subdivisaoLocalId: input.copiarEnderecoParoquia === true ? null : input.subdivisaoLocalId
        },
        igreja, municipioId, transaction
      );
    } else {
      const anteriores = await sequelize.query<{
        municipio_id: string;
        subdivisao_local_id: string | null;
        cep: string | null;
        logradouro: string | null;
        numero_logradouro: string | null;
        complemento: string | null;
        bairro: string | null;
      }>(`SELECT municipio_id::text, subdivisao_local_id::text, cep,
          logradouro, numero_logradouro, complemento, bairro
          FROM legio.unidade_legionaria
          WHERE id = CAST(:id AS bigint) FOR UPDATE`, {
        replacements: { id }, type: QueryTypes.SELECT, transaction
      });
      const anterior = anteriores[0];
      if (!anterior) throw new HttpError(404, 'Unidade não encontrada.');
      if (anterior.municipio_id !== municipioId) {
        throw new HttpError(400,
          'Ao alterar o município da sede, informe novo endereço próprio ou use a ação Copiar endereço da paróquia.');
      }
      sede = {
        subdivisaoLocalId: anterior.subdivisao_local_id,
        codigoPostal: anterior.cep,
        logradouro: anterior.logradouro,
        numeroLogradouro: anterior.numero_logradouro,
        complemento: anterior.complemento,
        bairro: anterior.bairro
      };
      // Alterar a RA da unidade NÃO exige recadastrar seu endereço.
      // Ausência do campo significa preservar a RA atual; null permite limpar.
      if (input.subdivisaoLocalId !== undefined) {
        const novaRa = normalizarTextoOpcional(input.subdivisaoLocalId);
        if (novaRa) {
          await resolverSubdivisaoLocal(novaRa, municipioId, transaction);
        }
        sede.subdivisaoLocalId = novaRa;
      }
    }
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
          subdivisao_local_id = CAST(:sedeSubdivisaoLocalId AS bigint),
          municipio_id = CAST(:municipioId AS integer),
          igreja_id = CAST(:igrejaId AS bigint),
          cidade = :cidade,
          estado_regiao = :estadoRegiao,
          pais_codigo = :paisCodigo,
          data_constituicao = CAST(:dataConstituicao AS date),
          data_elevacao = CAST(:dataElevacao AS date),
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
          cep: sede.codigoPostal,
          logradouro: sede.logradouro,
          numeroLogradouro: sede.numeroLogradouro,
          complemento: sede.complemento,
          bairro: sede.bairro,
          sedeSubdivisaoLocalId: sede.subdivisaoLocalId,
          municipioId,
          igrejaId,
          cidade: localizacao.municipio_nome,
          estadoRegiao: localizacao.uf_nome,
          paisCodigo: codigoPaisLegado(localizacao.pais_sigla),
          dataConstituicao,
          dataElevacao,
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

