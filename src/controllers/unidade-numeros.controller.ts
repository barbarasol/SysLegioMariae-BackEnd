import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import * as service from '../services/unidade-numeros.service.js';

function idUsuario(req: AuthenticatedRequest): string {
  const id = req.auth?.usuarioId;
  if (!id) throw new HttpError(401, 'Sessão não autenticada.');
  return String(id);
}

export async function obter(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.obter(idUsuario(req), req.params.unidadeId, req.params.ano, req.params.mes);
    res.json(resultado);
  } catch (erro) { next(erro); }
}

export async function listarHistorico(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.listarHistorico(idUsuario(req), req.params.unidadeId, req.query.ano);
    res.json(resultado);
  } catch (erro) { next(erro); }
}

export async function salvar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.salvar(idUsuario(req), req.params.unidadeId, req.params.ano, req.params.mes, req.body?.valores, req.body?.copiadoDeId);
    res.status(200).json(resultado);
  } catch (erro) { next(erro); }
}

