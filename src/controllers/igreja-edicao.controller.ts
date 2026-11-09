import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import * as unidadeService from '../services/unidade.service.js';
import { HttpError } from '../utils/http-error.js';

export async function atualizarIgreja(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuarioId = req.auth?.usuarioId;
    if (!usuarioId) throw new HttpError(401, 'Usuário não autenticado.');
    const resultado = await unidadeService.atualizarIgreja(req.params.id, {
      ...req.body,
      usuarioId: String(usuarioId)
    });
    res.json(resultado);
  } catch (erro) { next(erro); }
}
