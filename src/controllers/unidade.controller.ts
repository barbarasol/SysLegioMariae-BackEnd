import type {
  NextFunction,
  Response
} from 'express';
import * as unidadeService from '../services/unidade.service.js';
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
    const solicitanteUsuarioId = req.auth?.usuarioId;

    if (!solicitanteUsuarioId) {
      throw new HttpError(
        401,
        'Sessão não autenticada.'
      );
    }

    const {
      tipoCodigo,
      nome,
      nomeReduzido,
      cidade,
      estadoRegiao,
      paisCodigo,
      dataConstituicao,
      unidadeSuperiorId,
      observacao
    } = req.body ?? {};

    const resultado = await unidadeService.criar({
      tipoCodigo,
      nome,
      nomeReduzido,
      cidade,
      estadoRegiao,
      paisCodigo,
      dataConstituicao,
      unidadeSuperiorId,
      observacao,
      solicitanteUsuarioId
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * Lista as unidades para alimentar o select de "unidade superior"
 * do formulário. Filtra por tipo quando informado.
 */
export async function listar(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tipo = String(req.query.tipo ?? '').trim();

    const unidades = await unidadeService.listar(
      tipo || null
    );

    res.json(unidades);
  } catch (error) {
    next(error);
  }
}