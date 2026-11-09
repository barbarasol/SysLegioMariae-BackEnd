import type { NextFunction, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

/** Permissão consultada no banco em CADA requisição, não no body nem em token do cliente. */
export async function exigirPlatformOwner(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = req.auth?.usuarioId;
    if (!usuarioId) throw new HttpError(401, 'Sessão não autenticada.');

    const [verificacao] = await sequelize.query<{ permitido: boolean }>(`
      SELECT EXISTS (
        SELECT 1
          FROM legio.usuario u
          JOIN legio.usuario_perfil_global upg ON upg.usuario_id = u.id
          JOIN legio.perfil_acesso pa ON pa.id = upg.perfil_id
         WHERE u.id = CAST(:usuarioId AS bigint)
           AND u.status = 'ATIVO'
           AND pa.codigo = 'PLATFORM_OWNER'
           AND pa.escopo = 'GLOBAL'
           AND pa.ativo = TRUE
      ) AS permitido
    `, {
      replacements: { usuarioId: String(usuarioId) },
      type: QueryTypes.SELECT
    });
    if (!verificacao?.permitido) {
      throw new HttpError(403, 'Acesso exclusivo do perfil PLATFORM_OWNER.');
    }
    next();
  } catch (erro) {
    next(erro);
  }
}
