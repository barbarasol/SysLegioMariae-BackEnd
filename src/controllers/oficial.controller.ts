import type {
  NextFunction,
  Response
} from 'express';
import * as oficialService from '../services/oficial.service.js';
import { unidadesPermitidas } from '../services/hierarquia-acesso.service.js';
import { HttpError } from '../utils/http-error.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';

function exigirUsuario(req: AuthenticatedRequest): string {
  if (!req.auth?.usuarioId) throw new HttpError(401, 'Sessão não autenticada.');
  return req.auth.usuarioId;
}

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
    const oficiais = await oficialService.listar(exigirUsuario(req), {
      busca: queryString(req.query.busca),
      unidadeId: queryString(req.query.unidadeId),
      tipoUnidade: queryString(req.query.tipoUnidade),
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
 * ?mes=11            -> todos do mes de novembro
 * ?dias=15           -> proximos 15 dias (padrao 30)
 */
export async function aniversariantes(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const mes = queryNumero(req.query.mes);
    const dias = queryNumero(req.query.dias) ?? 30;

    const lista = await oficialService.aniversariantes(exigirUsuario(req), mes, dias, {
      unidadeId: queryString(req.query.unidadeId),
      tipoUnidade: queryString(req.query.tipoUnidade)
    });

    res.json(lista);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/oficiais/resumo
 * Contadores para os cards e o total de aniversariantes do mes.
 */
export async function resumo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agora = new Date();
    const mes = queryNumero(req.query.mes) ?? agora.getMonth() + 1;

    const dados = await oficialService.resumo(exigirUsuario(req), mes, {
      unidadeId: queryString(req.query.unidadeId),
      tipoUnidade: queryString(req.query.tipoUnidade)
    });

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

/**
 * DELETE /api/oficiais/:id
 *
 * Encerra o mandato. O "id" e o do vinculo em
 * membro_cargo_unidade, nao o do membro.
 */
export async function encerrar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');

    await oficialService.encerrar(exigirUsuario(req), id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
/** Catálogo restrito ao escopo hierárquico do usuário autenticado. */
export async function unidadesAcessiveis(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    res.json(await unidadesPermitidas(exigirUsuario(req)));
  } catch (error) { next(error); }
}
