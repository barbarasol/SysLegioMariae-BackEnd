import type {
  NextFunction,
  Response
} from 'express';
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';
import type {
  AuthenticatedRequest
} from './auth.middleware.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Autoriza a requisicao por perfil de acesso.
 *
 * Aceita quando o usuario possui qualquer um dos perfis informados,
 * seja como perfil GLOBAL (usuario_perfil_global) ou como perfil de
 * UNIDADE (usuario_unidade_perfil). E o mesmo criterio que a tela usa
 * para montar o menu.
 *
 * Uso:
 *   router.post('/x', perfilMiddleware(['PLATFORM_ADMIN']), handler)
 */
export function perfilMiddleware(perfisPermitidos: string[]) {

  return async function (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {

    try {
      const usuarioId = req.auth?.usuarioId;

      if (!usuarioId) {
        throw new HttpError(401, 'Sessao nao autenticada.');
      }

      if (perfisPermitidos.length === 0) {
        next();
        return;
      }

      const linhas = await sequelize.query<{ codigo: string }>(
        `
          SELECT pa.codigo
          FROM legio.usuario_perfil_global upg
          JOIN legio.perfil_acesso pa
            ON pa.id = upg.perfil_id
          WHERE upg.usuario_id = CAST(:usuarioId AS bigint)
            AND pa.ativo = TRUE

          UNION

          SELECT pa.codigo
          FROM legio.usuario_unidade_perfil uup
          JOIN legio.perfil_acesso pa
            ON pa.id = uup.perfil_id
          JOIN legio.unidade_legionaria ul
            ON ul.id = uup.unidade_id
          WHERE uup.usuario_id = CAST(:usuarioId AS bigint)
            AND uup.ativo = TRUE
            AND ul.ativo = TRUE
        `,
        {
          replacements: { usuarioId },
          type: QueryTypes.SELECT
        }
      );

      const possui = linhas.some(
        (linha) => perfisPermitidos.includes(linha.codigo)
      );

      if (!possui) {
        throw new HttpError(
          403,
          'Seu perfil nao permite analisar solicitacoes.'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
