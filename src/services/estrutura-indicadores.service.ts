import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/** Última competência por unidade. Janeiro permite recorrer ao ano anterior. */
export interface IndicadoresEstrutura {
  ano: number;
  mes: number;
  status: 'CONFIRMADO' | 'RASCUNHO';
  qtd_comitia: number | null;
  qtd_curiae: number | null;
  qtd_curiae_juv: number | null;
  qtd_praesidia: number | null;
  qtd_praesidia_juv: number | null;
  qtd_velites: number | null;
  qtd_praticios: number | null;
  qtd_pretorianos: number | null;
  qtd_adjutores: number | null;
  qtd_ativos_com_promessa: number | null;
  qtd_ativos_sem_promessa: number | null;
  qtd_auxiliares_permanentes: number | null;
  qtd_auxiliares_provisorios: number | null;
  qtd_mescs: number | null;
  qtd_catequistas: number | null;
  qtd_coroinhas: number | null;
  qtd_praesidia_total: number | null;
}

type Linha = IndicadoresEstrutura & { unidade_id: string };

/**
 * Usa o ano/mês civil de Brasília, não o fuso do servidor nem do Supabase.
 * Mantém os valores NULL: não informado é diferente de zero.
 * Nunca soma conselhos e unidades subordinadas aqui: cada registro já é um
 * retrato informativo da respectiva unidade/conselho.
 */
export async function listarIndicadoresEstrutura(usuarioId: string): Promise<Map<string, IndicadoresEstrutura>> {
  const linhas = await sequelize.query<Linha>(`
    WITH referencia AS (
      SELECT
        EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::int AS ano,
        EXTRACT(MONTH FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::int AS mes
    )
    SELECT DISTINCT ON (n.unidade_id)
       n.unidade_id::text AS unidade_id,
       n.ano,
       n.mes,
       n.status,
       n.qtd_comitia,
       n.qtd_curiae,
       n.qtd_curiae_juv,
       n.qtd_praesidia,
       n.qtd_praesidia_juv,
       n.qtd_velites,
       n.qtd_praticios,
       n.qtd_pretorianos,
       n.qtd_adjutores,
       n.qtd_ativos_com_promessa,
       n.qtd_ativos_sem_promessa,
       n.qtd_auxiliares_permanentes,
       n.qtd_auxiliares_provisorios,
       n.qtd_mescs,
       n.qtd_catequistas,
       n.qtd_coroinhas,
       n.qtd_praesidia_total
    FROM legio.unidade_numeros n
    CROSS JOIN referencia r
    WHERE (
        (n.ano = r.ano AND n.mes <= r.mes)
        OR (r.mes = 1 AND n.ano = r.ano - 1)
      )
      AND EXISTS (
        SELECT 1
        FROM legio.usuario usuario
        WHERE usuario.id = CAST(:usuarioId AS bigint)
          AND usuario.status = 'ATIVO'
          AND (
            EXISTS (
              SELECT 1
              FROM legio.usuario_perfil_global ug
              JOIN legio.perfil_acesso pa ON pa.id = ug.perfil_id
              WHERE ug.usuario_id = usuario.id
                AND pa.ativo = TRUE AND pa.escopo = 'GLOBAL'
            )
            OR EXISTS (
              SELECT 1
              FROM legio.usuario_unidade_perfil up
              JOIN legio.perfil_acesso pa ON pa.id = up.perfil_id
              WHERE up.usuario_id = usuario.id
                AND up.unidade_id = n.unidade_id
                AND up.ativo = TRUE
                AND pa.ativo = TRUE AND pa.escopo = 'UNIDADE'
            )
          )
      )
    ORDER BY n.unidade_id, n.ano DESC, n.mes DESC, n.id DESC
  `, { replacements: { usuarioId }, type: QueryTypes.SELECT });

  const porId = new Map<string, IndicadoresEstrutura>();
  for (const { unidade_id, ...numeros } of linhas) {
    porId.set(String(unidade_id), numeros);
  }
  return porId;
}
