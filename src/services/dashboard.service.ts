import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { CAMPOS_NUMEROS, validarId } from './unidade-numeros.service.js';

/** Indicadores solicitados; exclui os dois campos de igrejas do consolidado. */
const CAMPOS_DASHBOARD = CAMPOS_NUMEROS.filter(
  campo => campo !== 'qtd_igrejas_com_legiao' && campo !== 'qtd_igrejas_sem_legiao'
);

type LinhaUnidade = Record<string, unknown> & {
  id: string;
  nome: string;
  tipo: string;
  registro_id: string | null;
  ultima_atualizacao: string | Date | null;
};

type LinhaEvolucao = {
  mes: number;
  unidades_com_registro: string | number;
  total_unidades: string | number;
  membros: string | number | null;
};

const NUMERO_MAXIMO_SEGURO = Number.MAX_SAFE_INTEGER;

function inteiroNaoNegativo(valor: unknown, nome: string): number {
  if (valor === null || valor === undefined) return 0;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0) {
    throw new HttpError(500, `Valor numérico inválido no indicador ${nome}.`);
  }
  return numero;
}

function somarSeguro(a: number, b: number, nome: string): number {
  const soma = a + b;
  if (!Number.isSafeInteger(soma) || soma > NUMERO_MAXIMO_SEGURO) {
    throw new HttpError(500, `Total do indicador ${nome} excede o limite numérico seguro.`);
  }
  return soma;
}

/**
 * Consulta somente filhos DIRETOS do Concilium identificado pela hierarquia.
 * Seleciona a competência mais recente por unidade e preserva meses sem cobertura.
 */
export async function obterResumoConcilium(usuarioId: string) {
  // Encontra o Concilium pela hierarquia das unidades já cadastradas,
  // sem exigir lançamento quantitativo próprio em legio.unidade_numeros.
  // A existência de uma REGIA diretamente subordinada basta para identificá-lo.
  const concilia = await sequelize.query<{ id: string }>(`
    SELECT DISTINCT pai.id::text AS id
      FROM legio.unidade_legionaria pai
      JOIN legio.tipo_unidade tipo_pai ON tipo_pai.id = pai.tipo_unidade_id
      JOIN legio.unidade_legionaria filha ON filha.unidade_superior_id = pai.id
      JOIN legio.tipo_unidade tipo_filha ON tipo_filha.id = filha.tipo_unidade_id
     WHERE tipo_pai.codigo = 'CONCILIUM'
       AND pai.ativo = TRUE
       AND filha.ativo = TRUE
       AND filha.status_aprovacao = 'APROVADA'
       AND tipo_filha.codigo IN (
         'SENATUS', 'REGIA', 'REGIAE', 'COMITIUM', 'COMITIA',
         'CURIA', 'CURIAE', 'PRAESIDIUM', 'PRAESIDIA',
         'COMITIUM_JUVENIL', 'COMITIA_JUVENIL',
         'CURIA_JUVENIL', 'CURIAE_JUVENIL',
         'PRAESIDIUM_JUVENIL', 'PRAESIDIA_JUVENIL'
       )
     ORDER BY id
     LIMIT 2
  `, { type: QueryTypes.SELECT });

  if (concilia.length === 0) {
    throw new HttpError(404,
      'Nenhuma unidade ativa e aprovada diretamente vinculada a uma unidade do tipo CONCILIUM foi encontrada.');
  }
  if (concilia.length > 1) {
    throw new HttpError(409,
      'Mais de um Concilium possui unidades vinculadas. É necessário identificar qual Concilium consolidar.');
  }

  const conciliumId = concilia[0].id;

  // Dashboard estatístico: leitura permitida a qualquer usuário ATIVO
  // autenticado, incluindo MEMBRO. A autorização de EDITAR quantitativos
  // continua restrita no serviço unidade-numeros.service.ts.
  const usuarioIdValidado = validarId(usuarioId, 'Usuário');
  const usuariosAtivos = await sequelize.query<{ id: string }>(`
    SELECT id::text AS id
      FROM legio.usuario
     WHERE id = CAST(:usuarioId AS bigint)
       AND status = 'ATIVO'
     LIMIT 1
  `, {
    replacements: { usuarioId: usuarioIdValidado },
    type: QueryTypes.SELECT
  });
  if (!usuariosAtivos[0]) {
    throw new HttpError(403, 'A conta precisa estar ativa para consultar o dashboard.');
  }

  // Códigos reais da tipologia devem ser mantidos neste filtro; incluídas
  // as grafias singular/plural observadas na aplicação.
  const codigos = [
    'SENATUS', 'REGIA', 'REGIAE', 'COMITIUM', 'COMITIA',
    'CURIA', 'CURIAE', 'PRAESIDIUM', 'PRAESIDIA',
    'COMITIUM_JUVENIL', 'COMITIA_JUVENIL',
    'CURIA_JUVENIL', 'CURIAE_JUVENIL',
    'PRAESIDIUM_JUVENIL', 'PRAESIDIA_JUVENIL'
  ];

  const colunas = CAMPOS_DASHBOARD.map(campo => `n.${campo}`).join(',\n        ');
  const unidades = await sequelize.query<LinhaUnidade>(`
    SELECT ul.id::text AS id, ul.nome, tu.codigo AS tipo,
           n.id::text AS registro_id,
           n.updated_at AS ultima_atualizacao,
           ${colunas}
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
      LEFT JOIN LATERAL (
        SELECT * FROM legio.unidade_numeros nr
         WHERE nr.unidade_id = ul.id AND nr.status = 'CONFIRMADO'
         ORDER BY nr.ano DESC, nr.mes DESC,
                  nr.updated_at DESC NULLS LAST, nr.id DESC
         LIMIT 1
      ) n ON TRUE
     WHERE ul.unidade_superior_id = CAST(:conciliumId AS bigint)
       AND ul.ativo = TRUE
       AND ul.status_aprovacao = 'APROVADA'
       AND tu.codigo IN (:codigos)
     ORDER BY tu.ordem_hierarquica DESC NULLS LAST, ul.nome, ul.id
  `, {
    replacements: { conciliumId, codigos }, type: QueryTypes.SELECT
  });

  const totais: Record<string, number> = Object.fromEntries(
    CAMPOS_DASHBOARD.map(campo => [campo, 0])
  );

  let ultimaAtualizacao: string | null = null;
  let unidadesComRegistro = 0;
  const listaUnidades = unidades.map(unidade => {
    const data = unidade.ultima_atualizacao
      ? new Date(unidade.ultima_atualizacao).toISOString() : null;
    if (unidade.registro_id !== null) {
      unidadesComRegistro++;
      for (const campo of CAMPOS_DASHBOARD) {
        totais[campo] = somarSeguro(
          totais[campo], inteiroNaoNegativo(unidade[campo], campo), campo
        );
      }
      if (data && (!ultimaAtualizacao || data > ultimaAtualizacao)) ultimaAtualizacao = data;
    }
    return { id: unidade.id, nome: unidade.nome, tipo: unidade.tipo,
      ultima_atualizacao: unidade.registro_id !== null ? data : null };
  });

  // Usa o ano corrente do servidor e os meses 1..12. Registro de mês anterior
  // pode servir de snapshot, mas nunca um registro posterior ao mês avaliado.
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  const evolucao: Array<{ mes: number; membros: number | null }> =
    Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, membros: null }));

  if (unidades.length > 0) {
    const historico = await sequelize.query<LinhaEvolucao>(`
      WITH unidades AS (
        SELECT ul.id
          FROM legio.unidade_legionaria ul
          JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
         WHERE ul.unidade_superior_id = CAST(:conciliumId AS bigint)
           AND ul.ativo = TRUE AND ul.status_aprovacao = 'APROVADA'
           AND tu.codigo IN (:codigos)
      ), snapshots AS (
        SELECT m.mes, ul.id AS unidade_id,
               n.id AS registro_id,
               (
                 COALESCE(n.qtd_ativos_com_promessa, 0)::bigint +
                 COALESCE(n.qtd_ativos_sem_promessa, 0)::bigint +
                 COALESCE(n.qtd_auxiliares_permanentes, 0)::bigint +
                 COALESCE(n.qtd_auxiliares_provisorios, 0)::bigint
               ) AS membros
          FROM generate_series(1, 12) AS m(mes)
          CROSS JOIN unidades ul
          LEFT JOIN LATERAL (
            SELECT nr.* FROM legio.unidade_numeros nr
             WHERE nr.unidade_id = ul.id
               AND nr.status = 'CONFIRMADO'
               AND (nr.ano < :ano OR (nr.ano = :ano AND nr.mes <= m.mes))
             ORDER BY nr.ano DESC, nr.mes DESC,
                      nr.updated_at DESC NULLS LAST, nr.id DESC
             LIMIT 1
          ) n ON TRUE
      )
      SELECT mes,
             COUNT(registro_id)::text AS unidades_com_registro,
             COUNT(*)::text AS total_unidades,
             SUM(membros)::text AS membros
        FROM snapshots
       GROUP BY mes
       ORDER BY mes
    `, { replacements: { conciliumId, codigos, ano }, type: QueryTypes.SELECT });

    for (const item of historico) {
      const mes = Number(item.mes);
      const cobertura = Number(item.unidades_com_registro);
      const total = Number(item.total_unidades);
      if (mes >= 1 && mes <= mesAtual && total === unidades.length && cobertura === total) {
        evolucao[mes - 1].membros = inteiroNaoNegativo(item.membros, 'membros');
      }
    }
  }

  return {
    ano,
    ultima_atualizacao: ultimaAtualizacao,
    totais,
    evolucao,
    unidades: listaUnidades,
    cobertura: { unidades: unidades.length, com_registro: unidadesComRegistro }
  };
}
