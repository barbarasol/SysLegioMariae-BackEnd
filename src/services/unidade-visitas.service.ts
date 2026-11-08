import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { validarId, verificarAcesso, validarCompetencia } from './unidade-numeros.service.js';

type Visita = {
  id: string;
  unidade_id: string;
  ano: number;
  data_visita: string;
  visitantes: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  usu_inc_id: string | null;
  usu_alt_id: string | null;
};

function normalizarPayload(payload: unknown): { ano: number; dataVisita: string; visitantes: string; observacoes: string | null } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Informe os dados da visita.');
  }
  const o = payload as Record<string, unknown>;
  const validos = ['data_visita', 'visitantes', 'observacoes'];
  const extras = Object.keys(o).filter(c => !validos.includes(c));
  if (extras.length) throw new HttpError(400, `Campos não permitidos: ${extras.join(', ')}.`);

  if (typeof o.data_visita !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.data_visita)) {
    throw new HttpError(400, 'A data da visita deve estar no formato AAAA-MM-DD.');
  }
  const dataVisita = o.data_visita;
  const [ano, mes, dia] = dataVisita.split('-').map(Number);
  validarCompetencia(ano, mes);
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (dt.getUTCFullYear() !== ano || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) {
    throw new HttpError(400, 'Data de visita inexistente.');
  }
  if (typeof o.visitantes !== 'string' || !o.visitantes.trim() || o.visitantes.trim().length > 200) {
    throw new HttpError(400, 'Informe visitantes com até 200 caracteres.');
  }
  if (o.observacoes != null && typeof o.observacoes !== 'string') {
    throw new HttpError(400, 'Observações inválidas.');
  }
  const observacoes = typeof o.observacoes === 'string' ? o.observacoes.trim() : '';
  if (observacoes.length > 10000) throw new HttpError(400, 'Observações excedem 10.000 caracteres.');
  return { ano, dataVisita, visitantes: o.visitantes.trim(), observacoes: observacoes || null };
}

async function buscar(id: string, unidadeId: string, transaction?: Transaction): Promise<Visita> {
  const linhas = await sequelize.query<Visita>(`
    SELECT id::text, unidade_id::text, ano, data_visita::text AS data_visita, visitantes, observacoes,
           created_at, updated_at, usu_inc_id::text, usu_alt_id::text
    FROM legio.unidade_visitas
    WHERE id = :id AND unidade_id = :unidadeId
    LIMIT 1
  `, { replacements: { id, unidadeId }, type: QueryTypes.SELECT, transaction });
  if (!linhas[0]) throw new HttpError(404, 'Visita não encontrada nesta unidade.');
  return linhas[0];
}

async function auditar(usuarioId: string, visitaId: string, acao: string, antes: unknown, depois: unknown, transaction: Transaction): Promise<void> {
  await sequelize.query(`
    INSERT INTO legio.auditoria_evento
    (usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
    VALUES (:usuarioId, :acao, 'legio.unidade_visitas', :visitaId,
            CAST(:antes AS jsonb), CAST(:depois AS jsonb))
  `, { replacements: {
    usuarioId, visitaId, acao,
    antes: JSON.stringify(antes ?? null),
    depois: JSON.stringify(depois ?? null)
  }, transaction });
}

export async function listar(usuarioId: string, idUnidade: unknown, anoValor: unknown, mesValor?: unknown) {
  const unidadeId = validarId(idUnidade, 'Unidade');
  const ano = validarCompetencia(anoValor, 1).ano;
  const mes = mesValor === undefined || mesValor === null || mesValor === ''
    ? null : validarCompetencia(ano, mesValor).mes;
  const permissoes = await verificarAcesso(usuarioId, unidadeId, 'LER');
  const visitas = await sequelize.query<Visita>(`
    SELECT id::text, unidade_id::text, ano, data_visita::text AS data_visita, visitantes, observacoes,
           created_at, updated_at, usu_inc_id::text, usu_alt_id::text
    FROM legio.unidade_visitas
    WHERE unidade_id = :unidadeId AND ano = :ano
      AND (CAST(:mes AS INTEGER) IS NULL OR EXTRACT(MONTH FROM data_visita)::INTEGER = :mes)
    ORDER BY data_visita DESC, id DESC LIMIT 1000
  `, { replacements: { unidadeId, ano, mes }, type: QueryTypes.SELECT });
  return { visitas, permissoes: { editar: permissoes.pode_editar } };
}

export async function criar(usuarioId: string, idUnidade: unknown, payload: unknown) {
  const unidadeId = validarId(idUnidade, 'Unidade');
  const valores = normalizarPayload(payload);
  return sequelize.transaction(async transaction => {
    await verificarAcesso(usuarioId, unidadeId, 'EDITAR', transaction);
    const linhas = await sequelize.query<Visita>(`
      INSERT INTO legio.unidade_visitas
        (unidade_id, ano, data_visita, visitantes, observacoes, usu_inc_id, usu_alt_id)
      VALUES (:unidadeId, :ano, :dataVisita, :visitantes, :observacoes, :usuarioId, :usuarioId)
      RETURNING id::text, unidade_id::text, ano, data_visita::text AS data_visita, visitantes,
                observacoes, created_at, updated_at, usu_inc_id::text, usu_alt_id::text
    `, { replacements: { unidadeId, usuarioId, ...valores }, type: QueryTypes.SELECT, transaction });
    const visita = linhas[0];
    await auditar(usuarioId, visita.id, 'UNIDADE_VISITA_CRIADA', null, visita, transaction);
    return { visita };
  });
}

export async function atualizar(usuarioId: string, idUnidade: unknown, visitaIdValor: unknown, payload: unknown) {
  const unidadeId = validarId(idUnidade, 'Unidade');
  const visitaId = validarId(visitaIdValor, 'Visita');
  const valores = normalizarPayload(payload);
  return sequelize.transaction(async transaction => {
    await verificarAcesso(usuarioId, unidadeId, 'EDITAR', transaction);
    const antes = await buscar(visitaId, unidadeId, transaction);
    const linhas = await sequelize.query<Visita>(`
      UPDATE legio.unidade_visitas SET
        ano = :ano, data_visita = :dataVisita,
        visitantes = :visitantes, observacoes = :observacoes,
        usu_alt_id = :usuarioId, updated_at = CURRENT_TIMESTAMP
      WHERE id = :visitaId AND unidade_id = :unidadeId
      RETURNING id::text, unidade_id::text, ano, data_visita::text AS data_visita, visitantes,
                observacoes, created_at, updated_at, usu_inc_id::text, usu_alt_id::text
    `, { replacements: { unidadeId, visitaId, usuarioId, ...valores }, type: QueryTypes.SELECT, transaction });
    const visita = linhas[0];
    await auditar(usuarioId, visita.id, 'UNIDADE_VISITA_ATUALIZADA', antes, visita, transaction);
    return { visita };
  });
}

export async function excluir(usuarioId: string, idUnidade: unknown, visitaIdValor: unknown) {
  const unidadeId = validarId(idUnidade, 'Unidade');
  const visitaId = validarId(visitaIdValor, 'Visita');
  return sequelize.transaction(async transaction => {
    await verificarAcesso(usuarioId, unidadeId, 'EDITAR', transaction);
    const antes = await buscar(visitaId, unidadeId, transaction);
    await auditar(usuarioId, visitaId, 'UNIDADE_VISITA_EXCLUIDA', antes, null, transaction);
    await sequelize.query(`
      DELETE FROM legio.unidade_visitas WHERE id = :visitaId AND unidade_id = :unidadeId
    `, { replacements: { visitaId, unidadeId }, transaction });
    return { message: 'Visita excluída com sucesso.' };
  });
}
