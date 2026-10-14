import type {
  NextFunction,
  Response
} from 'express';
import * as solicitacaoService from '../services/solicitacao.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';

/**
 * GET /api/solicitacoes-unidades
 * Filtros opcionais: ?status=PENDENTE&tipo=COMITIUM
 */
export async function listar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = String(req.query.status ?? '').trim();
    const tipo = String(req.query.tipo ?? '').trim();

    const solicitacoes = await solicitacaoService.listar(
      status || null,
      tipo || null
    );

    res.json(solicitacoes);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/solicitacoes-unidades/resumo
 * Contadores para os cards do topo.
 */
export async function resumo(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const contadores = await solicitacaoService.resumo();

    res.json(contadores);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/solicitacoes-unidades/:id/aprovar
 * Muda o status da solicitação e o status_aprovacao da unidade
 * na mesma transação.
 */
export async function aprovar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const analistaId = req.auth?.usuarioId;

    if (!analistaId) {
      throw new HttpError(401, 'Sessão não autenticada.');
    }

    const resultado = await solicitacaoService.aprovar(
      String(req.params.id),
      analistaId,
      req.body?.resposta
    );

    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/solicitacoes-unidades/:id/rejeitar
 */
export async function rejeitar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const analistaId = req.auth?.usuarioId;

    if (!analistaId) {
      throw new HttpError(401, 'Sessão não autenticada.');
    }

    const resultado = await solicitacaoService.rejeitar(
      String(req.params.id),
      analistaId,
      req.body?.resposta
    );

    res.json(resultado);
  } catch (error) {
    next(error);
  }
}
