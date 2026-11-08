import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import * as service from '../services/unidade-institucional.service.js';

function usuario(req: AuthenticatedRequest): string {
  if (!req.auth?.usuarioId) throw new HttpError(401, 'Sessão não autenticada.');
  return String(req.auth.usuarioId);
}
export async function obter(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await service.obter(usuario(req), req.params.unidadeId)); }
  catch (erro) { next(erro); }
}
export async function atualizar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await service.atualizar(usuario(req), req.params.unidadeId, req.body)); }
  catch (erro) { next(erro); }
}
