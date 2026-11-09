import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import * as service from '../services/controle-versao.service.js';

function usuarioId(req: AuthenticatedRequest): string {
  const id = req.auth?.usuarioId;
  if (!id) throw new HttpError(401, 'Sessão não autenticada.');
  return String(id);
}
export async function atual(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { usuarioId(req); res.json(await service.versaoAtual()); } catch (e) { next(e); }
}
export async function listar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { usuarioId(req); res.json(await service.listar()); } catch (e) { next(e); }
}
export async function criar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.status(201).json(await service.criar(usuarioId(req), req.body)); } catch (e) { next(e); }
}
export async function atualizar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await service.atualizar(usuarioId(req), req.params.id, req.body)); } catch (e) { next(e); }
}
export async function excluir(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { usuarioId(req); await service.excluir(req.params.id); res.status(204).send(); } catch (e) { next(e); }
}
