import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import * as service from '../services/unidade-visitas.service.js';

function usuario(req: AuthenticatedRequest): string {
  if (!req.auth?.usuarioId) throw new HttpError(401, 'Sessão não autenticada.');
  return String(req.auth.usuarioId);
}

export async function listar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await service.listar(usuario(req), req.params.unidadeId, req.query.ano, req.query.mes)); }
  catch (erro) { next(erro); }
}
export async function criar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await service.criar(usuario(req), req.params.unidadeId, req.body)); }
  catch (erro) { next(erro); }
}
export async function atualizar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await service.atualizar(usuario(req), req.params.unidadeId, req.params.visitaId, req.body)); }
  catch (erro) { next(erro); }
}
export async function excluir(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await service.excluir(usuario(req), req.params.unidadeId, req.params.visitaId)); }
  catch (erro) { next(erro); }
}
