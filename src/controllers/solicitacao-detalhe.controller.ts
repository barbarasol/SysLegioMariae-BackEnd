import type { NextFunction, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

type Anexo = { id: string; nome: string; url: string };

/**
 * Adapta registros já existentes se houver tabela de anexos conhecida.
 * Nunca inventa anexos; se não houver uma tabela/colunas reconhecidas,
 * devolve lista vazia e não apresenta seção de documentos no frontend.
 */
async function listarAnexos(solicitacaoId: string, unidadeId: string): Promise<Anexo[]> {
  const bases = [
    { tabela: 'solicitacao_unidade_anexo', chaves: ['solicitacao_unidade_id', 'solicitacao_id'], valor: solicitacaoId },
    { tabela: 'unidade_legionaria_anexo', chaves: ['unidade_legionaria_id', 'unidade_id'], valor: unidadeId }
  ] as const;
  const anexos: Anexo[] = [];

  for (const base of bases) {
    const colunas = await sequelize.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'legio' AND table_name = :tabela`,
      { replacements: { tabela: base.tabela }, type: QueryTypes.SELECT }
    );
    const nomes = new Set(colunas.map((c) => c.column_name));
    const chave = base.chaves.find((c) => nomes.has(c));
    if (!chave) continue;
    // O nome da tabela e da coluna é selecionado apenas de constantes internas.
    const linhas = await sequelize.query<{ dados: Record<string, unknown> }>(
      `SELECT to_jsonb(a) AS dados FROM legio.${base.tabela} a
       WHERE a.${chave}::text = :id`,
      { replacements: { id: base.valor }, type: QueryTypes.SELECT }
    );
    for (const { dados } of linhas) {
      const valor = (...chaves: string[]) => {
        for (const k of chaves) {
          const v = dados[k];
          if (typeof v === 'string' && v.trim()) return v.trim();
        }
        return '';
      };
      const url = valor('url', 'url_arquivo', 'arquivo_url');
      // Somente URLs HTTPS ou rotas internas seguras; caminho de disco não é URL.
      if (!/^https:\/\//i.test(url) && !/^\/api\//.test(url)) continue;
      anexos.push({
        id: String(dados['id'] ?? anexos.length + 1),
        nome: valor('nome_arquivo', 'nome_original', 'nome', 'arquivo_nome') || 'Documento',
        url
      });
    }
  }
  return anexos;
}

/** GET /api/solicitacoes-unidades/:id: consulta a solicitação REAL e a unidade vinculada. */
export async function detalhar(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    if (!/^\d+$/.test(id)) throw new HttpError(400, 'Solicitação inválida.');
    const linhas = await sequelize.query<{
      id: string; unidadeId: string; [key: string]: unknown;
    }>(
      `SELECT su.id::text AS "id",
              su.status AS "status",
              su.justificativa AS "justificativa",
              su.resposta AS "resposta",
              su.solicitado_em AS "solicitadoEm",
              su.analisado_em AS "analisadoEm",
              ul.id::text AS "unidadeId",
              ul.nome AS "unidadeNome",
              ul.nome_reduzido AS "nomeReduzido",
              ul.status_aprovacao AS "statusUnidade",
              tu.codigo AS "unidadeTipo",
              ul.cidade AS "unidadeCidade",
              ul.estado_regiao AS "unidadeEstado",
              sup.nome AS "unidadeSuperior",
              usup.nome AS "solicitanteNome",
              usu.email AS "solicitanteEmail",
              pan.nome AS "analisadorNome",
              ul.data_constituicao::text AS "dataFundacao",
              ul.data_elevacao::text AS "dataElevacao",
              COALESCE(ig.codigo_postal, ul.cep) AS "codigoPostal",
              COALESCE(ig.logradouro, ul.logradouro) AS "logradouro",
              COALESCE(ig.numero_logradouro, ul.numero_logradouro) AS "numeroLogradouro",
              COALESCE(ig.complemento, ul.complemento) AS "complemento",
              COALESCE(ig.bairro, ul.bairro) AS "bairro",
              m.nome AS "municipioNome",
              uf.nome AS "ufNome",
              pa.nome AS "paisNome",
              sl.nome AS "subdivisaoNome",
              ig.nome AS "igrejaNome",
              ul.email AS "email", ul.celular AS "celular",
              ul.telefone AS "telefone", ul.site AS "site",
              dr.nome AS "diaReuniaoNome",
              ul.horario_inicio_reuniao::text AS "horarioInicio",
              ul.horario_fim_reuniao::text AS "horarioFim",
              ul.fuso_horario AS "fusoHorario"
         FROM legio.solicitacao_unidade su
         JOIN legio.unidade_legionaria ul ON ul.id = su.unidade_id
         JOIN legio.tipo_unidade tu ON tu.id = ul.tipo_unidade_id
         LEFT JOIN legio.unidade_legionaria sup ON sup.id = ul.unidade_superior_id
         LEFT JOIN legio.usuario usu ON usu.id = su.solicitante_usuario_id
         LEFT JOIN legio.pessoa usup ON usup.id = usu.pessoa_id
         LEFT JOIN legio.usuario uan ON uan.id = su.analisado_por_usuario_id
         LEFT JOIN legio.pessoa pan ON pan.id = uan.pessoa_id
         LEFT JOIN legio.municipio m ON m.id = ul.municipio_id
         LEFT JOIN legio.uf uf ON uf.id = m.id_uf
         LEFT JOIN legio.pais pa ON pa.id = uf.id_pais
         LEFT JOIN legio.igreja ig ON ig.id = ul.igreja_id
         LEFT JOIN legio.subdivisao_local sl ON sl.id = ig.subdivisao_local_id
         LEFT JOIN legio.dia_reuniao dr ON dr.id = ul.dia_reuniao
        WHERE su.id = CAST(:id AS bigint)
        LIMIT 1`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    const solicitacao = linhas[0];
    if (!solicitacao) throw new HttpError(404, 'Solicitação não encontrada.');
    const anexos = await listarAnexos(id, solicitacao.unidadeId);
    res.json({ ...solicitacao, anexos });
  } catch (error) {
    next(error);
  }
}
