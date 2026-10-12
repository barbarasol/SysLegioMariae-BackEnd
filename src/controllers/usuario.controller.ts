import type {
  NextFunction,
  Response
} from 'express';
import * as usuarioService from '../services/usuario.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';

export async function criar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioAutenticadoId = req.auth?.usuarioId;

    if (!usuarioAutenticadoId) {
      throw new HttpError(
        401,
        'Sessão não autenticada.'
      );
    }

    const {
      nome,
      email,
      senha,
      nomePreferido,
      cpf,
      celular,
      perfilCodigo
    } = req.body ?? {};

    const resultado = await usuarioService.criar({
      nome,
      email,
      senha,
      nomePreferido,
      cpf,
      celular,
      perfilCodigo
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}
