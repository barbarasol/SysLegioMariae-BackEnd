import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { validarId, verificarAcesso } from './unidade-numeros.service.js';

type DadosInstitucionais = {
  unidade_id: string;
  nome: string;
  num_ult_ata: number | null;
  num_ult_relatorio: number | null;
  dt_apresentacao_ult_relatorio: string | null;
  dt_ultimo_congresso: string | null;
};

async function buscar(unidadeId: string, transaction?: import('sequelize').Transaction) {
  const dados = await sequelize.query<DadosInstitucionais>(`
    SELECT id::text AS unidade_id, nome, num_ult_ata, num_ult_relatorio,
           dt_apresentacao_ult_relatorio::text, dt_ultimo_congresso::text
    FROM legio.unidade_legionaria WHERE id = :unidadeId AND ativo = TRUE
    LIMIT 1
  `, { replacements: { unidadeId }, type: QueryTypes.SELECT, transaction });
  if (!dados[0]) throw new HttpError(404, 'Unidade inexistente ou inativa.');
  return dados[0];
}

const CAMPOS = ['num_ult_ata', 'num_ult_relatorio', 'dt_apresentacao_ult_relatorio', 'dt_ultimo_congresso'] as const;
type Campo = typeof CAMPOS[number];

function validar(payload: unknown): Record<Campo, number | string | null> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Informe os dados institucionais.');
  }
  const o = payload as Record<string, unknown>;
  const naoPermitidos = Object.keys(o).filter(k => !(CAMPOS as readonly string[]).includes(k));
  if (naoPermitidos.length) throw new HttpError(400, `Campos não permitidos: ${naoPermitidos.join(', ')}.`);
  const resultado = {} as Record<Campo, number | string | null>;
  for (const c of CAMPOS) {
    const valor = o[c];
    if (valor === null || valor === undefined || (typeof valor === 'string' && !valor.trim())) {
      resultado[c] = null;
      continue;
    }
    if (c === 'num_ult_ata' || c === 'num_ult_relatorio') {
      if ((typeof valor !== 'number' && typeof valor !== 'string') || !/^\d+$/.test(String(valor).trim())) {
        throw new HttpError(400, `${c}: informe um inteiro não negativo.`);
      }
      const num = Number(valor);
      if (!Number.isSafeInteger(num) || num > 2147483647) throw new HttpError(400, `${c}: valor inválido.`);
      resultado[c] = num;
    } else {
      if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        throw new HttpError(400, `${c}: data inválida (AAAA-MM-DD).`);
      }
      const [a, m, d] = valor.split('-').map(Number);
      const dt = new Date(Date.UTC(a, m - 1, d));
      if (a < 1900 || a > 2200 || dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m-1 || dt.getUTCDate() !== d) {
        throw new HttpError(400, `${c}: data inexistente.`);
      }
      resultado[c] = valor;
    }
  }
  return resultado;
}

export async function obter(usuarioId: string, idUnidade: unknown) {
  const unidadeId = validarId(idUnidade, 'Unidade');
  const p = await verificarAcesso(usuarioId, unidadeId, 'LER');
  return { dados: await buscar(unidadeId), permissoes: { editar: p.pode_editar } };
}

export async function atualizar(usuarioId: string, idUnidade: unknown, payload: unknown) {
  const unidadeId = validarId(idUnidade, 'Unidade');
  const valores = validar(payload);
  return sequelize.transaction(async transaction => {
    await verificarAcesso(usuarioId, unidadeId, 'EDITAR', transaction);
    await sequelize.query('SELECT id FROM legio.unidade_legionaria WHERE id = :unidadeId FOR UPDATE', {
      replacements: { unidadeId }, transaction, type: QueryTypes.SELECT
    });
    const antes = await buscar(unidadeId, transaction);
    await sequelize.query(`
      UPDATE legio.unidade_legionaria SET
        num_ult_ata = :num_ult_ata,
        num_ult_relatorio = :num_ult_relatorio,
        dt_apresentacao_ult_relatorio = :dt_apresentacao_ult_relatorio,
        dt_ultimo_congresso = :dt_ultimo_congresso,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :unidadeId
    `, { replacements: { unidadeId, ...valores }, transaction });
    const dados = await buscar(unidadeId, transaction);
    await sequelize.query(`
      INSERT INTO legio.auditoria_evento
        (usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
      VALUES (:usuarioId, 'UNIDADE_DADOS_INSTITUCIONAIS_ATUALIZADOS',
        'legio.unidade_legionaria', :unidadeId, CAST(:antes AS jsonb), CAST(:depois AS jsonb))
    `, { replacements: { usuarioId, unidadeId, antes: JSON.stringify(antes), depois: JSON.stringify(dados) }, transaction });
    return { dados };
  });
}
