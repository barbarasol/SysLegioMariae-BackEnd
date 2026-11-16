import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import { obterResumoConcilium } from '../services/dashboard.service.js';

export async function obterConcilium(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = req.auth?.usuarioId;
    if (!usuarioId) throw new HttpError(401, 'Sessão não autenticada.');
    res.json(await obterResumoConcilium(String(usuarioId)));
  } catch (erro) {
    next(erro);
  }
}
