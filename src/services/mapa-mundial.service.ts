import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import { unidadesPermitidas } from './hierarquia-acesso.service.js';

export type PaisMapa = {
  paisId: string; paisNome: string; paisSigla: string | null;
  total: number; tipos: Record<string, number>;
};
export type UnidadeMapa = {
  id: string; nome: string; tipoCodigo: string; tipoNome: string;
  unidadeSuperiorId: string | null; unidadeSuperiorNome: string | null; municipio: string; uf: string;
};

async function idsPermitidos(usuarioId: string): Promise<string[]> {
  const permitidas = await unidadesPermitidas(usuarioId);
  return permitidas.map(unidade => unidade.id).filter(id => /^\d+$/.test(id));
}

/** Totalização de unidades reais, aprovadas e dentro da hierarquia autorizada. */
export async function listarPaises(usuarioId: string): Promise<PaisMapa[]> {
  const ids = await idsPermitidos(usuarioId);
  if (ids.length === 0) return [];
  const linhas = await sequelize.query<{
    paisId: string; paisNome: string; paisSigla: string | null;
    tipoCodigo: string; quantidade: string;
  }>(`
    SELECT p.id::text AS "paisId", p.nome AS "paisNome",
           UPPER(NULLIF(TRIM(p.sigla), '')) AS "paisSigla",
           tu.codigo AS "tipoCodigo", COUNT(*)::text AS quantidade
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
      JOIN legio.municipio m ON m.id = ul.municipio_id
      JOIN legio.uf uf ON uf.id = m.id_uf
      JOIN legio.pais p ON p.id = uf.id_pais
     WHERE ul.id IN (:ids)
       AND ul.ativo = TRUE
       AND ul.status_aprovacao = 'APROVADA'
     GROUP BY p.id, p.nome, p.sigla, tu.codigo
     ORDER BY p.nome, tu.codigo
  `, { replacements: { ids }, type: QueryTypes.SELECT });
  const agrupados = new Map<string, PaisMapa>();
  for (const linha of linhas) {
    let pais = agrupados.get(linha.paisId);
    if (!pais) {
      pais = { paisId: linha.paisId, paisNome: linha.paisNome,
        paisSigla: linha.paisSigla, total: 0, tipos: {} };
      agrupados.set(linha.paisId, pais);
    }
    const quantidade = Number(linha.quantidade);
    pais.total += quantidade;
    pais.tipos[linha.tipoCodigo] = (pais.tipos[linha.tipoCodigo] ?? 0) + quantidade;
  }
  return [...agrupados.values()];
}

export async function listarUnidades(
  usuarioId: string, paisId: string, tipo: string | null,
  busca: string | null, pagina: number
): Promise<{ total: number; pagina: number; porPagina: number; unidades: UnidadeMapa[] }> {
  if (!/^\d+$/.test(paisId)) throw new HttpError(400, 'País inválido.');
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000) {
    throw new HttpError(400, 'Página inválida.');
  }
  const porPagina = 100;
  const ids = await idsPermitidos(usuarioId);
  if (ids.length === 0) return { total: 0, pagina, porPagina, unidades: [] };
  const condicoes = `
    FROM legio.unidade_legionaria ul
    JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
    LEFT JOIN legio.unidade_legionaria superior ON superior.id = ul.unidade_superior_id
    JOIN legio.municipio m ON m.id = ul.municipio_id
    JOIN legio.uf uf ON uf.id = m.id_uf
    JOIN legio.pais p ON p.id = uf.id_pais
    WHERE ul.id IN (:ids) AND ul.ativo = TRUE
      AND ul.status_aprovacao = 'APROVADA'
      AND p.id = CAST(:paisId AS bigint)
      AND (CAST(:tipo AS varchar) IS NULL OR tu.codigo = CAST(:tipo AS varchar))
      AND (CAST(:busca AS varchar) IS NULL OR ul.nome ILIKE '%' || CAST(:busca AS varchar) || '%')
  `;
  const replacements = {
    ids, paisId, tipo: tipo?.trim() || null, busca: busca?.trim().slice(0, 100) || null,
  };
  const [{ total }] = await sequelize.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total ${condicoes}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const unidades = await sequelize.query<UnidadeMapa>(`
    SELECT ul.id::text AS id, ul.nome,
           tu.codigo AS "tipoCodigo", tu.nome AS "tipoNome",
           ul.unidade_superior_id::text AS "unidadeSuperiorId",
           superior.nome AS "unidadeSuperiorNome",
           m.nome AS municipio, uf.nome AS uf
    ${condicoes}
    ORDER BY tu.ordem_hierarquica NULLS LAST, ul.nome, ul.id
    LIMIT :limite OFFSET :deslocamento
  `, { replacements: { ...replacements, limite: porPagina, deslocamento: (pagina - 1) * porPagina },
       type: QueryTypes.SELECT });
  return { total: Number(total), pagina, porPagina, unidades };
}

/** Opções reais para o seletor, em uma consulta, sem COUNT/OFFSET. */
export async function listarOpcoesUnidades(
  usuarioId: string, paisId: string, tipo: string | null
): Promise<UnidadeMapa[]> {
  if (!/^\d+$/.test(paisId)) throw new HttpError(400, 'País inválido.');
  const ids = await idsPermitidos(usuarioId);
  if (ids.length === 0) return [];
  return sequelize.query<UnidadeMapa>(`
    SELECT ul.id::text AS id, ul.nome,
           tu.codigo AS "tipoCodigo", tu.nome AS "tipoNome",
           ul.unidade_superior_id::text AS "unidadeSuperiorId",
           superior.nome AS "unidadeSuperiorNome",
           m.nome AS municipio, uf.nome AS uf
      FROM legio.unidade_legionaria ul
      JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
      LEFT JOIN legio.unidade_legionaria superior ON superior.id = ul.unidade_superior_id
      JOIN legio.municipio m ON m.id = ul.municipio_id
      JOIN legio.uf uf ON uf.id = m.id_uf
     WHERE ul.id IN (:ids)
       AND ul.ativo = TRUE
       AND ul.status_aprovacao = 'APROVADA'
       AND uf.id_pais = CAST(:paisId AS bigint)
       AND (CAST(:tipo AS varchar) IS NULL OR tu.codigo = CAST(:tipo AS varchar))
     ORDER BY ul.nome, ul.id
  `, {
    replacements: { ids, paisId, tipo: tipo?.trim() || null },
    type: QueryTypes.SELECT
  });
}
