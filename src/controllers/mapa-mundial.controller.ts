import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { HttpError } from '../utils/http-error.js';
import * as mapa from '../services/mapa-mundial.service.js';

function usuario(req: AuthenticatedRequest): string {
  const id = req.auth?.usuarioId;
  if (!id) throw new HttpError(401, 'Sessão não autenticada.');
  return String(id);
}
function stringQuery(valor: unknown): string | null {
  return typeof valor === 'string' ? valor.trim() || null : null;
}
export async function paises(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { res.json(await mapa.listarPaises(usuario(req))); } catch (e) { next(e); }
}
export async function unidades(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const paisId = stringQuery(req.query.paisId);
    if (!paisId) throw new HttpError(400, 'Informe o país.');
    const pagina = Number(stringQuery(req.query.pagina) ?? '1');
    res.json(await mapa.listarUnidades(usuario(req), paisId,
      stringQuery(req.query.tipo), stringQuery(req.query.busca), pagina));
  } catch (e) { next(e); }
}

export async function opcoes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const paisId = stringQuery(req.query.paisId);
    if (!paisId) throw new HttpError(400, 'Informe o país.');
    res.json(await mapa.listarOpcoesUnidades(usuario(req), paisId, stringQuery(req.query.tipo)));
  } catch (e) { next(e); }
}
