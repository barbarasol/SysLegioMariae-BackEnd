import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Histórico quantitativo da unidade legionária.
 * Os nomes das colunas são intencionais: refletem a migration 014.
 * Nunca interpolar campos vindos do request no SQL.
 */
export const CAMPOS_NUMEROS = [
  'qtd_senatus',
  'qtd_regiae',
  'qtd_comitia',
  'qtd_comitia_juv',
  'qtd_curiae',
  'qtd_curiae_juv',
  'qtd_praesidia',
  'qtd_praesidia_juv',
  'qtd_velites',
  'qtd_praticios',
  'qtd_pretorianos',
  'qtd_adjutores',
  'qtd_ativos_com_promessa',
  'qtd_ativos_sem_promessa',
  'qtd_auxiliares_permanentes',
  'qtd_auxiliares_provisorios',
  'qtd_mescs',
  'qtd_catequistas',
  'qtd_coroinhas',
  'qtd_praesidia_total',
  'qtd_igrejas_com_legiao',
  'qtd_igrejas_sem_legiao'
] as const;

export type CampoNumeros = typeof CAMPOS_NUMEROS[number];
const CAMPOS_VALORES: readonly string[] = [...CAMPOS_NUMEROS];

type Registro = Record<string, unknown> & {
  id: string;
  unidade_id: string;
  ano: number;
  mes: number;
  status: 'RASCUNHO' | 'CONFIRMADO';
  origem: 'MANUAL' | 'VIRADA_ANO';
};

type Acesso = {
  pode_ler: boolean;
  pode_editar: boolean;
};

type AcessoRow = {
  global_leitura: boolean;
  global_administracao: boolean;
  unidade_leitura: boolean;
  unidade_administracao: boolean;
};

export function validarId(valor: unknown, nome = 'Identificador'): string {
  const id = String(valor ?? '').trim();
  if (!/^\d+$/.test(id) || BigInt(id) <= 0n || BigInt(id) > 9223372036854775807n) {
    throw new HttpError(400, `${nome} inválido.`);
  }
  return id;
}

export function validarCompetencia(anoValor: unknown, mesValor: unknown): { ano: number; mes: number } {
  const ano = Number(anoValor);
  const mes = Number(mesValor);
  if (!Number.isInteger(ano) || ano < 1900 || ano > 2200) {
    throw new HttpError(400, 'Ano de referência inválido.');
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new HttpError(400, 'Mês de referência inválido.');
  }
  return { ano, mes };
}

export async function verificarAcesso(
  usuarioId: string,
  unidadeId: string,
  modo: 'LER' | 'EDITAR',
  transaction?: Transaction
): Promise<Acesso> {
  const unidades = await sequelize.query<{ id: string }>(`
    SELECT id::text FROM legio.unidade_legionaria
    WHERE id = :unidadeId AND ativo = TRUE LIMIT 1
  `, {
    replacements: { unidadeId }, type: QueryTypes.SELECT, transaction
  });
  if (!unidades[0]) throw new HttpError(404, 'Unidade legionária inexistente ou inativa.');

  const acessos = await sequelize.query<AcessoRow>(`
    SELECT
      EXISTS (
        SELECT 1 FROM legio.usuario u
        JOIN legio.usuario_perfil_global ug ON ug.usuario_id = u.id
        JOIN legio.perfil_acesso pa ON pa.id = ug.perfil_id
        WHERE u.id = :usuarioId AND u.status = 'ATIVO'
          AND pa.ativo = TRUE AND pa.escopo = 'GLOBAL'
      ) AS global_leitura,
      EXISTS (
        SELECT 1 FROM legio.usuario u
        JOIN legio.usuario_perfil_global ug ON ug.usuario_id = u.id
        JOIN legio.perfil_acesso pa ON pa.id = ug.perfil_id
        WHERE u.id = :usuarioId AND u.status = 'ATIVO'
          AND pa.ativo = TRUE AND pa.escopo = 'GLOBAL'
          AND pa.codigo IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN')
      ) AS global_administracao,
      EXISTS (
        SELECT 1 FROM legio.usuario u
        JOIN legio.usuario_unidade_perfil up ON up.usuario_id = u.id
        JOIN legio.perfil_acesso pa ON pa.id = up.perfil_id
        WHERE u.id = :usuarioId AND u.status = 'ATIVO'
          AND up.unidade_id = :unidadeId AND up.ativo = TRUE
          AND pa.ativo = TRUE AND pa.escopo = 'UNIDADE'
      ) AS unidade_leitura,
      EXISTS (
        SELECT 1 FROM legio.usuario u
        JOIN legio.usuario_unidade_perfil up ON up.usuario_id = u.id
        JOIN legio.perfil_acesso pa ON pa.id = up.perfil_id
        WHERE u.id = :usuarioId AND u.status = 'ATIVO'
          AND up.unidade_id = :unidadeId AND up.ativo = TRUE
          AND pa.ativo = TRUE AND pa.escopo = 'UNIDADE'
          AND pa.codigo IN ('ADMIN_UNIDADE', 'OPERADOR')
      ) AS unidade_administracao
  `, {
    replacements: { usuarioId, unidadeId }, type: QueryTypes.SELECT, transaction
  });

  const a = acessos[0];
  if (!a) throw new HttpError(403, 'Não foi possível verificar permissões da conta.');
  const acesso: Acesso = {
    pode_ler: !!(a.global_leitura || a.unidade_leitura),
    pode_editar: !!(a.global_administracao || a.unidade_administracao)
  };

  const permitido = modo === 'LER' ? acesso.pode_ler : acesso.pode_editar;
  if (!permitido) {
    throw new HttpError(403, 'Seu perfil não possui permissão para esta operação na unidade.');
  }
  return acesso;
}

async function buscarRegistro(
  unidadeId: string, ano: number, mes: number, transaction?: Transaction
): Promise<Registro | null> {
  const linhas = await sequelize.query<Registro>(`
    SELECT * FROM legio.unidade_numeros
    WHERE unidade_id = :unidadeId AND ano = :ano AND mes = :mes
    LIMIT 1
  `, { replacements: { unidadeId, ano, mes }, type: QueryTypes.SELECT, transaction });
  return linhas[0] ?? null;
}

async function registrarAuditoria(
  usuarioId: string, registro: Registro, acao: string,
  antes: unknown, depois: unknown, transaction: Transaction
): Promise<void> {
  await sequelize.query(`
    INSERT INTO legio.auditoria_evento
      (usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois)
    VALUES
      (:usuarioId, :acao, 'legio.unidade_numeros', :registroId,
       CAST(:antes AS jsonb), CAST(:depois AS jsonb))
  `, {
    replacements: {
      usuarioId, acao, registroId: registro.id,
      antes: JSON.stringify(antes ?? null),
      depois: JSON.stringify(depois ?? null)
    }, transaction
  });
}

function normalizarValores(payload: unknown): Record<string, string | number | null> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Envie o objeto valores com os indicadores da unidade.');
  }
  const dados = payload as Record<string, unknown>;
  const inesperados = Object.keys(dados).filter(chave => !CAMPOS_VALORES.includes(chave));
  if (inesperados.length) throw new HttpError(400, `Campos não permitidos: ${inesperados.join(', ')}.`);

  const valores: Record<string, string | number | null> = {};
  for (const campo of CAMPOS_NUMEROS) {
    const bruto = dados[campo];
    if (bruto === null || bruto === undefined || bruto === '') {
      valores[campo] = null;
      continue;
    }
    // Number('  ') === 0: não aceitar string vazia com espaços.
    if (typeof bruto === 'string' && !bruto.trim()) {
      valores[campo] = null;
      continue;
    }
    const numero = Number(bruto);
    if (!Number.isSafeInteger(numero) || numero < 0 || numero > 2147483647) {
      throw new HttpError(400, `O campo ${campo} deve ser um número inteiro não negativo.`);
    }
    valores[campo] = numero;
  }

  return valores;
}

export async function obter(
  usuarioId: string, unidadeIdValor: unknown, anoValor: unknown, mesValor: unknown
) {
  const unidadeId = validarId(unidadeIdValor, 'Unidade');
  const { ano, mes } = validarCompetencia(anoValor, mesValor);
  const acesso = await verificarAcesso(usuarioId, unidadeId, 'LER');
  const registro = await buscarRegistro(unidadeId, ano, mes);
  return { registro, permissoes: { editar: acesso.pode_editar } };
}

export async function listarHistorico(
  usuarioId: string, unidadeIdValor: unknown, anoValor?: unknown
) {
  const unidadeId = validarId(unidadeIdValor, 'Unidade');
  await verificarAcesso(usuarioId, unidadeId, 'LER');
  let ano: number | null = null;
  if (anoValor !== undefined && anoValor !== null && anoValor !== '') {
    ano = validarCompetencia(anoValor, 1).ano;
  }
  const registros = await sequelize.query<Registro>(`
    SELECT * FROM legio.unidade_numeros
    WHERE unidade_id = :unidadeId AND (:ano IS NULL OR ano = :ano)
    ORDER BY ano DESC, mes DESC LIMIT 120
  `, { replacements: { unidadeId, ano }, type: QueryTypes.SELECT });
  return { registros };
}

export async function salvar(
  usuarioId: string, unidadeIdValor: unknown,
  anoValor: unknown, mesValor: unknown, payload: unknown, copiadoDeIdValor?: unknown
) {
  const unidadeId = validarId(unidadeIdValor, 'Unidade');
  const { ano, mes } = validarCompetencia(anoValor, mesValor);
  const valores = normalizarValores(payload);
  const copiadoDeId = copiadoDeIdValor === null || copiadoDeIdValor === undefined || copiadoDeIdValor === ''
    ? null : validarId(copiadoDeIdValor, 'Registro de origem');

  return sequelize.transaction(async transaction => {
    await verificarAcesso(usuarioId, unidadeId, 'EDITAR', transaction);
    // Serializa gravações para a mesma unidade, evitando corrida de confirmação/cópia.
    await sequelize.query(`
      SELECT id FROM legio.unidade_legionaria WHERE id = :unidadeId FOR UPDATE
    `, { replacements: { unidadeId }, transaction, type: QueryTypes.SELECT });
    const antes = await buscarRegistro(unidadeId, ano, mes, transaction);
    // A cópia é facultativa e só referencia um registro da MESMA unidade.
    // Nunca sobrescreve o vínculo de origem ao editar uma competência existente.
    let competenciaFonte: { ano: number; mes: number } | null = null;
    if (!antes && copiadoDeId !== null) {
      const fontes = await sequelize.query<{ ano: number; mes: number }>(`
        SELECT ano, mes FROM legio.unidade_numeros
        WHERE id = :copiadoDeId AND unidade_id = :unidadeId LIMIT 1
      `, {
        replacements: { copiadoDeId, unidadeId }, type: QueryTypes.SELECT, transaction
      });
      competenciaFonte = fontes[0] ?? null;
      if (!competenciaFonte) {
        throw new HttpError(400, 'A competência de origem não pertence à unidade selecionada.');
      }
    }
    const colunas = [...CAMPOS_NUMEROS];
    const sqlColunas = colunas.join(', ');
    const sqlValores = colunas.map(c => `:${c}`).join(', ');
    const updates = colunas.map(c => `${c} = EXCLUDED.${c}`).join(',\n');
    // O status CONFIRMADO permanece por compatibilidade com relatórios antigos.
    // Ele NÃO representa bloqueio: qualquer usuário com permissão EDITAR pode salvar novamente.
    const linhas = await sequelize.query<Registro>(`
      INSERT INTO legio.unidade_numeros
        (unidade_id, ano, mes, ${sqlColunas}, status, origem, copiado_de_id,
         confirmado_em, confirmado_por_usuario_id, usu_inc_id, usu_alt_id)
      VALUES (:unidadeId, :ano, :mes, ${sqlValores}, 'CONFIRMADO', :origem, :copiadoDeId,
              CURRENT_TIMESTAMP, :usuarioId, :usuarioId, :usuarioId)
      ON CONFLICT (unidade_id, ano, mes) DO UPDATE SET
        ${updates}, status = 'CONFIRMADO',
        confirmado_em = COALESCE(legio.unidade_numeros.confirmado_em, CURRENT_TIMESTAMP),
        confirmado_por_usuario_id = COALESCE(legio.unidade_numeros.confirmado_por_usuario_id, :usuarioId),
        usu_alt_id = :usuarioId, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, {
      replacements: {
        unidadeId, ano, mes, ...valores, usuarioId, copiadoDeId,
        origem: competenciaFonte && mes === 1 && competenciaFonte.ano < ano ? 'VIRADA_ANO' : 'MANUAL'
      },
      type: QueryTypes.SELECT, transaction
    });
    const registro = linhas[0];
    if (!registro) throw new HttpError(409, 'Não foi possível gravar a competência. Tente novamente.');
    await registrarAuditoria(usuarioId, registro, antes ? 'NUMEROS_UNIDADE_ATUALIZADOS' : 'NUMEROS_UNIDADE_CRIADOS', antes, registro, transaction);
    return { registro };
  });
}

