import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import * as perfilService from '../services/perfil.service.js';

function obterUsuarioId(req: AuthenticatedRequest): string {
  const usuarioId = req.auth?.usuarioId;
  if (!usuarioId) throw new HttpError(401, 'Sessão não autenticada.');
  return String(usuarioId);
}

export async function atualizarMeuPerfil(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const resultado = await perfilService.atualizarDados(obterUsuarioId(req), req.body ?? {});
    res.status(200).json(resultado);
  } catch (erro) { next(erro); }
}

export async function alterarMinhaSenha(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const resultado = await perfilService.alterarSenha(obterUsuarioId(req), req.body ?? {});
    res.status(200).json(resultado);
  } catch (erro) { next(erro); }
}

export async function obterMinhasPreferencias(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const preferencias = await perfilService.consultarPreferencias(obterUsuarioId(req));
    res.status(200).json({ preferencias });
  } catch (erro) { next(erro); }
}

export async function atualizarMinhasPreferencias(
  req: AuthenticatedRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const preferencias = await perfilService.salvarPreferencias(obterUsuarioId(req), req.body ?? {});
    res.status(200).json({ preferencias });
  } catch (erro) { next(erro); }
}
