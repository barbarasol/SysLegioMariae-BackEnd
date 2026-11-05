import type {
  NextFunction,
  Response
} from 'express';
import * as oficialService from '../services/oficial.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';

function queryString(valor: unknown): string | null {
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    return limpo === '' ? null : limpo;
  }

  return null;
}

function queryNumero(valor: unknown): number | null {
  const texto = queryString(valor);

  if (texto === null) {
    return null;
  }

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : null;
}

/**
 * GET /api/oficiais
 * ?busca=&unidadeId=&cargo=&vigentes=true
 */
export async function listar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const oficiais = await oficialService.listar({
      busca: queryString(req.query.busca),
      unidadeId: queryString(req.query.unidadeId),
      cargo: queryString(req.query.cargo),
      somenteVigentes: queryString(req.query.vigentes) === 'true'
    });

    res.json(oficiais);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/oficiais/aniversariantes
 * ?mes=11            -> todos do mês de novembro
 * ?dias=15           -> próximos 15 dias (padrão 30)
 */
export async function aniversariantes(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const mes = queryNumero(req.query.mes);
    const dias = queryNumero(req.query.dias) ?? 30;

    const lista = await oficialService.aniversariantes(mes, dias);

    res.json(lista);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/oficiais/resumo
 * Contadores para os cards e o total de aniversariantes do mês.
 */
export async function resumo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agora = new Date();
    const mes = queryNumero(req.query.mes) ?? agora.getMonth() + 1;

    const dados = await oficialService.resumo(mes);

    res.json(dados);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/oficiais/cargos
 * Cargos oficiais para o filtro.
 */
export async function cargos(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const lista = await oficialService.listarCargos();

    res.json(lista);
  } catch (error) {
    next(error);
  }
}