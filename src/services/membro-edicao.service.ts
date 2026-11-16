import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { obterUnidadesPermitidasMembros, garantirPraesidiumPermitido } from './membro-acesso.service.js';

// Edição administrativa: vínculo selecionado somente entre Praesidia autorizados.
// MEMBRO mantém exclusivamente a rota /me do módulo existente.
type Linha = {
  id: string; pessoaId: string; vinculoId: string; nome: string;
  nomePreferido: string | null; cpf: string | null; rg: string | null;
  dataNascimento: string | null; email: string | null; celular: string | null; telefone: string | null;
  dtRecrutamento: string | null; dtIngresso: string | null; dtCompromisso: string | null;
  formacaoEscolar: string | null; aposentado: boolean; pretoriano: boolean;
  adjutor: boolean; mesc: boolean; catequista: boolean; coroinha: boolean;
  status: string; observacao: string | null; unidadeId: string;
  categoriaCodigo: string; cargoCodigo: string | null; numeroMandato: number | null;
  principal: boolean; dataInicio: string | null;
};

function idValido(valor: unknown, campo: string): string {
  const id = String(valor ?? '').trim();
  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n) {
    throw new HttpError(400, `${campo} inválido.`);
  }
  return id;
}

async function detalheAutorizado(
  usuarioId: string, membroId: string, unidadeId: string | null, transaction?: Transaction
): Promise<Linha> {
  const unidades = await obterUnidadesPermitidasMembros(usuarioId, transaction);
  const linhas = await sequelize.query<Linha>(`
    SELECT m.id::text, m.pessoa_id::text AS "pessoaId", mu.id::text AS "vinculoId",
      p.nome, p.nome_preferido AS "nomePreferido", p.cpf, p.rg,
      to_char(p.data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
      p.email, p.celular, p.telefone,
      to_char(m.dt_recrutamento, 'YYYY-MM-DD') AS "dtRecrutamento",
      to_char(m.dt_ingresso, 'YYYY-MM-DD') AS "dtIngresso",
      to_char(m.dt_compromisso, 'YYYY-MM-DD') AS "dtCompromisso",
      m.formacao_escolar AS "formacaoEscolar", COALESCE(m.aposentado, FALSE) AS aposentado,
      COALESCE(m.pretoriano, FALSE) AS pretoriano,
      COALESCE(m.adjutor, FALSE) AS adjutor, COALESCE(m.mesc, FALSE) AS mesc,
      COALESCE(m.catequista, FALSE) AS catequista, COALESCE(m.coroinha, FALSE) AS coroinha,
      m.status, m.observacao, mu.unidade_id::text AS "unidadeId",
      cat.codigo AS "categoriaCodigo", COALESCE(mu.principal, FALSE) AS principal,
      to_char(mu.data_inicio, 'YYYY-MM-DD') AS "dataInicio",
      cargo.codigo AS "cargoCodigo", cargo."numeroMandato"
    FROM legio.membro m
    JOIN legio.pessoa p ON p.id = m.pessoa_id
    JOIN legio.membro_unidade mu ON mu.membro_id = m.id AND mu.ativo = TRUE
    JOIN legio.unidade_legionaria ul ON ul.id = mu.unidade_id AND ul.ativo = TRUE
    JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id AND tu.codigo = 'PRAESIDIUM'
    JOIN legio.categoria_membro cat ON cat.id = mu.categoria_membro_id
    LEFT JOIN LATERAL (
      SELECT cl.codigo, mcu.numero_mandato AS "numeroMandato"
      FROM legio.membro_cargo_unidade mcu
      JOIN legio.cargo_legionario cl ON cl.id = mcu.cargo_id
      WHERE mcu.membro_id = m.id AND mcu.unidade_id = mu.unidade_id AND mcu.ativo = TRUE
      ORDER BY mcu.data_inicio DESC NULLS LAST, mcu.id DESC LIMIT 1
    ) cargo ON TRUE
    WHERE m.id = CAST(:membroId AS bigint)
      AND mu.unidade_id::text IN (:unidades)
      AND (CAST(:unidadeId AS bigint) IS NULL OR mu.unidade_id = CAST(:unidadeId AS bigint))
    ORDER BY mu.principal DESC, mu.data_inicio DESC NULLS LAST, mu.id DESC
    LIMIT 1
  `, { replacements: { membroId, unidadeId, unidades: unidades.length ? unidades : ['0'] }, type: QueryTypes.SELECT, transaction });
  if (!linhas[0]) throw new HttpError(404, 'Membro não encontrado nos Praesidia autorizados.');
  return linhas[0];
}

export async function obterParaEdicao(usuarioId: string, membroIdValor: unknown, unidadeIdValor?: unknown): Promise<Linha> {
  const membroId = idValido(membroIdValor, 'Membro');
  const unidadeId = unidadeIdValor == null || unidadeIdValor === '' ? null : idValido(unidadeIdValor, 'Praesidium');
  return detalheAutorizado(usuarioId, membroId, unidadeId);
}

function texto(valor: unknown, nome: string, limite: number): string | null {
  if (valor == null || valor === '') return null;
  if (typeof valor !== 'string') throw new HttpError(400, `${nome} deve ser texto.`);
  const v = valor.trim();
  if (v.length > limite) throw new HttpError(400, `${nome} excede o limite de ${limite} caracteres.`);
  return v || null;
}
function data(valor: unknown, nome: string): string | null {
  const v = texto(valor, nome, 10);
  if (!v) return null;
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const d = p ? new Date(Date.UTC(+p[1], +p[2] - 1, +p[3])) : null;
  if (!d || d.toISOString().slice(0, 10) !== v) throw new HttpError(400, `${nome} inválida.`);
  return v;
}
function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean') throw new HttpError(400, `${campo} deve ser verdadeiro ou falso.`);
  return valor;
}
const CAMPOS = new Set([
  'vinculoId','unidadeId','nome','nomePreferido','cpf','rg','dataNascimento','email','celular','telefone',
  'dtRecrutamento','dtIngresso','dtCompromisso','formacaoEscolar','aposentado','pretoriano',
  'adjutor','mesc','catequista','coroinha','status','observacao',
  'categoriaCodigo','cargoCodigo','numeroMandato','principal','dataInicio'
]);

export async function atualizarCadastro(usuarioId: string, membroIdValor: unknown, body: unknown): Promise<Linha> {
  const membroId = idValido(membroIdValor, 'Membro');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Informe os dados do membro.');
  const b = body as Record<string, unknown>;
  if (Object.keys(b).some(k => !CAMPOS.has(k))) throw new HttpError(400, 'Campos não permitidos na edição.');
  const vinculoId = idValido(b.vinculoId, 'Vínculo');
  const unidadeId = idValido(b.unidadeId, 'Praesidium');
  const nome = texto(b.nome, 'Nome', 180);
  if (!nome) throw new HttpError(400, 'Informe o nome completo.');
  const nomePreferido = texto(b.nomePreferido, 'Nome preferido', 180);
  const cpf = texto(b.cpf, 'CPF', 30);
  const rg = texto(b.rg, 'RG', 30);
  const dataNascimento = data(b.dataNascimento, 'Data de nascimento');
  const email = texto(b.email, 'E-mail', 254)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');
  const celular = texto(b.celular, 'Celular', 30);
  const telefone = texto(b.telefone, 'Telefone', 30);
  const dtRecrutamento = data(b.dtRecrutamento, 'Data de recrutamento');
  const dtIngresso = data(b.dtIngresso, 'Data de ingresso');
  const dtCompromisso = data(b.dtCompromisso, 'Data da promessa');
  const formacaoEscolar = texto(b.formacaoEscolar, 'Formação escolar', 80);
  const observacao = texto(b.observacao, 'Observação', 5000);
  const status = texto(b.status, 'Status', 30);
  if (!status || !['ATIVO','INATIVO','FALECIDO'].includes(status)) throw new HttpError(400, 'Status inválido.');
  const categoriaCodigo = texto(b.categoriaCodigo, 'Categoria', 60);
  if (!categoriaCodigo) throw new HttpError(400, 'Selecione a categoria.');
  const cargoCodigo = texto(b.cargoCodigo, 'Cargo', 60);
  const numeroMandato = b.numeroMandato == null || b.numeroMandato === '' ? null : Number(b.numeroMandato);
  if (numeroMandato !== null && (!Number.isSafeInteger(numeroMandato) || numeroMandato < 1)) throw new HttpError(400, 'Número do mandato inválido.');
  const dataInicio = data(b.dataInicio, 'Data de início do vínculo');
  const flags = {
    aposentado: booleano(b.aposentado, 'Aposentado'), pretoriano: booleano(b.pretoriano, 'Pretoriano'),
    adjutor: booleano(b.adjutor, 'Adjutor'), mesc: booleano(b.mesc, 'MESC'),
    catequista: booleano(b.catequista, 'Catequista'), coroinha: booleano(b.coroinha, 'Coroinha'),
    principal: booleano(b.principal, 'Vínculo principal')
  };
  return sequelize.transaction(async transaction => {
    // A autorização é recalculada na mesma transação, sem confiar no frontend.
    const permitidas = await obterUnidadesPermitidasMembros(usuarioId, transaction);
    garantirPraesidiumPermitido(unidadeId, permitidas);
    await sequelize.query(`SELECT id FROM legio.membro WHERE id = CAST(:membroId AS bigint) FOR UPDATE`,
      { replacements: { membroId }, type: QueryTypes.SELECT, transaction });
    const atuais = await sequelize.query<{unidadeId: string}>(`
      SELECT mu.unidade_id::text AS "unidadeId"
      FROM legio.membro_unidade mu
      WHERE mu.id = CAST(:vinculoId AS bigint) AND mu.membro_id = CAST(:membroId AS bigint) AND mu.ativo = TRUE
      FOR UPDATE
    `, { replacements: { vinculoId, membroId }, type: QueryTypes.SELECT, transaction });
    if (!atuais[0]) throw new HttpError(409, 'Vínculo inexistente ou alterado. Atualize a página.');
    const unidadeAnteriorId = atuais[0].unidadeId;
    garantirPraesidiumPermitido(unidadeAnteriorId, permitidas);
    const antes = await detalheAutorizado(usuarioId, membroId, unidadeAnteriorId, transaction);
    if (antes.vinculoId !== vinculoId) throw new HttpError(409, 'O vínculo selecionado mudou. Atualize a página.');
    // Evita copiar CPF já utilizado por outra pessoa.
    if (cpf) {
      const duplicados = await sequelize.query<{id: string}>(`
        SELECT id::text FROM legio.pessoa
        WHERE regexp_replace(cpf, '[^0-9]', '', 'g') = regexp_replace(:cpf, '[^0-9]', '', 'g')
          AND id <> CAST(:pessoaId AS bigint) LIMIT 1
      `, { replacements: { cpf, pessoaId: antes.pessoaId }, type: QueryTypes.SELECT, transaction });
      if (duplicados[0]) throw new HttpError(409, 'CPF já utilizado por outra pessoa.');
    }
    const categorias = await sequelize.query<{id: number}>(`
      SELECT id FROM legio.categoria_membro WHERE codigo = :categoriaCodigo AND ativo = TRUE LIMIT 1
    `, { replacements: { categoriaCodigo }, type: QueryTypes.SELECT, transaction });
    if (!categorias[0]) throw new HttpError(400, 'Categoria inválida ou inativa.');
    const cargos = cargoCodigo ? await sequelize.query<{id: number}>(`
      SELECT id FROM legio.cargo_legionario WHERE codigo = :cargoCodigo AND ativo = TRUE LIMIT 1
    `, { replacements: { cargoCodigo }, type: QueryTypes.SELECT, transaction }) : [];
    if (cargoCodigo && !cargos[0]) throw new HttpError(400, 'Cargo inválido ou inativo.');
    const unidadesAlvo = await sequelize.query<{id: string}>(`
      SELECT ul.id::text FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
      WHERE ul.id = CAST(:unidadeId AS bigint) AND ul.ativo = TRUE AND tu.codigo = 'PRAESIDIUM' LIMIT 1
    `, { replacements: { unidadeId }, type: QueryTypes.SELECT, transaction });
    if (!unidadesAlvo[0]) throw new HttpError(400, 'Praesidium inexistente ou inativo.');
    if (unidadeId !== unidadeAnteriorId) {
      const existente = await sequelize.query<{id: string}>(`
        SELECT id::text FROM legio.membro_unidade WHERE membro_id = CAST(:membroId AS bigint)
          AND unidade_id = CAST(:unidadeId AS bigint) AND ativo = TRUE LIMIT 1
      `, { replacements: { membroId, unidadeId }, type: QueryTypes.SELECT, transaction });
      if (existente[0]) throw new HttpError(409, 'O membro já possui vínculo ativo no Praesidium escolhido.');
    }
    await sequelize.query(`UPDATE legio.pessoa SET nome = :nome, nome_preferido = :nomePreferido,
      cpf = :cpf, rg = :rg, data_nascimento = CAST(:dataNascimento AS date),
      email = :email, celular = :celular, telefone = :telefone
      WHERE id = CAST(:pessoaId AS bigint)`, { replacements: {
      pessoaId: antes.pessoaId, nome, nomePreferido, cpf, rg, dataNascimento, email, celular, telefone
    }, transaction });
    await sequelize.query(`UPDATE legio.membro SET
      dt_recrutamento = CAST(:dtRecrutamento AS date), dt_ingresso = CAST(:dtIngresso AS date),
      dt_compromisso = CAST(:dtCompromisso AS date), formacao_escolar = :formacaoEscolar,
      aposentado = :aposentado, pretoriano = :pretoriano, adjutor = :adjutor,
      mesc = :mesc, catequista = :catequista, coroinha = :coroinha,
      status = :status, observacao = :observacao
      WHERE id = CAST(:membroId AS bigint)`, { replacements: {
      membroId, dtRecrutamento, dtIngresso, dtCompromisso, formacaoEscolar, ...flags, status, observacao
    }, transaction });
    // Se transferir a unidade, encerra o cargo antigo sem alterar registros históricos.
    if (unidadeAnteriorId !== unidadeId) {
      await sequelize.query(`UPDATE legio.membro_cargo_unidade SET ativo = FALSE
        WHERE membro_id = CAST(:membroId AS bigint) AND unidade_id = CAST(:unidadeAnteriorId AS bigint) AND ativo = TRUE`,
        { replacements: { membroId, unidadeAnteriorId }, transaction });
    }
    await sequelize.query(`UPDATE legio.membro_unidade SET
      unidade_id = CAST(:unidadeId AS bigint), categoria_membro_id = :categoriaId,
      principal = :principal, data_inicio = CAST(:dataInicio AS date)
      WHERE id = CAST(:vinculoId AS bigint) AND membro_id = CAST(:membroId AS bigint)`, {
      replacements: { vinculoId, membroId, unidadeId, categoriaId: categorias[0].id, principal: flags.principal, dataInicio }, transaction
    });
    // Cargo atual: não alterar os registros inativos/históricos.
    const cargoAtivo = await sequelize.query<{id: string}>(`
      SELECT id::text FROM legio.membro_cargo_unidade
      WHERE membro_id = CAST(:membroId AS bigint) AND unidade_id = CAST(:unidadeId AS bigint) AND ativo = TRUE
      ORDER BY data_inicio DESC NULLS LAST, id DESC LIMIT 1
    `, { replacements: { membroId, unidadeId }, type: QueryTypes.SELECT, transaction });
    if (cargoAtivo[0]) {
      if (cargos[0]) {
        await sequelize.query(`UPDATE legio.membro_cargo_unidade
          SET cargo_id = :cargoId, numero_mandato = :numeroMandato WHERE id = CAST(:cargoVinculoId AS bigint)`,
          { replacements: { cargoId: cargos[0].id, numeroMandato, cargoVinculoId: cargoAtivo[0].id }, transaction });
      } else {
        await sequelize.query(`UPDATE legio.membro_cargo_unidade SET ativo = FALSE WHERE id = CAST(:cargoVinculoId AS bigint)`,
          { replacements: { cargoVinculoId: cargoAtivo[0].id }, transaction });
      }
    } else if (cargos[0]) {
      await sequelize.query(`INSERT INTO legio.membro_cargo_unidade
        (membro_id, unidade_id, cargo_id, numero_mandato, data_inicio, ativo)
        VALUES (CAST(:membroId AS bigint), CAST(:unidadeId AS bigint), :cargoId,
                :numeroMandato, COALESCE(CAST(:dataInicio AS date), CURRENT_DATE), TRUE)`,
        { replacements: { membroId, unidadeId, cargoId: cargos[0].id, numeroMandato, dataInicio }, transaction });
    }
    await sequelize.query(`INSERT INTO legio.auditoria_evento
      (usuario_id, unidade_id, acao, entidade, entidade_id, dados_antes, dados_depois)
      VALUES (CAST(:usuarioId AS bigint), CAST(:unidadeId AS bigint), 'MEMBRO_ATUALIZADO',
        'legio.membro', :membroId, CAST(:antes AS jsonb), CAST(:depois AS jsonb))`, {
      replacements: { usuarioId, unidadeId, membroId, antes: JSON.stringify(antes), depois: JSON.stringify(b) }, transaction
    });
    return detalheAutorizado(usuarioId, membroId, unidadeId, transaction);
  });
}
