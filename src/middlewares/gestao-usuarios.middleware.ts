import type { NextFunction, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

/** Exclusivamente OWNER ou ADMIN global ativo; checado no BD em cada chamada. */
export async function exigirGestorUsuarios(
  req: AuthenticatedRequest, _res: Response, next: NextFunction
): Promise<void> {
  try {
    const usuarioId = req.auth?.usuarioId;
    if (!usuarioId) throw new HttpError(401, 'Sessão não autenticada.');
    const [verificacao] = await sequelize.query<{ permitido: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM legio.usuario u
         JOIN legio.usuario_perfil_global upg ON upg.usuario_id = u.id
         JOIN legio.perfil_acesso pa ON pa.id = upg.perfil_id
         WHERE u.id = CAST(:usuarioId AS bigint) AND u.status = 'ATIVO'
           AND pa.codigo IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN')
           AND pa.escopo = 'GLOBAL' AND pa.ativo = TRUE
       ) AS permitido`,
      { replacements: { usuarioId }, type: QueryTypes.SELECT }
    );
    if (!verificacao?.permitido) throw new HttpError(403, 'Operação exclusiva da administração da plataforma.');
    next();
  } catch (erro) { next(erro); }
}
