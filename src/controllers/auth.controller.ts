import type {
  NextFunction,
  Request,
  Response
} from 'express';
import * as authService from '../services/auth.service.js';
import type {
  AuthenticatedRequest
} from '../middlewares/auth.middleware.js';
import { getCookie } from '../utils/cookie.js';
import { HttpError } from '../utils/http-error.js';

const REFRESH_COOKIE = 'legio_refresh_token';

function cookieOptions() {
  const days = Number(
    process.env.REFRESH_TOKEN_DAYS ?? 30
  );

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: days * 24 * 60 * 60 * 1000
  };
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      email,
      senha
    } = req.body ?? {};

    const resultado = await authService.login(
      String(email ?? ''),
      String(senha ?? ''),
      req.ip,
      req.get('user-agent')
    );

    res.cookie(
      REFRESH_COOKIE,
      resultado.refreshToken,
      cookieOptions()
    );

    res.json({
      accessToken: resultado.accessToken,
      expiresIn: resultado.expiresIn
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = getCookie(
      req.headers.cookie,
      REFRESH_COOKIE
    );

    if (!refreshToken) {
      throw new HttpError(
        401,
        'Sessão expirada ou inválida.'
      );
    }

    const resultado = await authService.refresh(
      refreshToken,
      req.ip,
      req.get('user-agent')
    );

    res.cookie(
      REFRESH_COOKIE,
      resultado.refreshToken,
      cookieOptions()
    );

    res.json({
      accessToken: resultado.accessToken,
      expiresIn: resultado.expiresIn
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = getCookie(
      req.headers.cookie,
      REFRESH_COOKIE
    );

    await authService.logout(
      refreshToken
    );

    res.clearCookie(
      REFRESH_COOKIE,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth'
      }
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function me(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuarioId = req.auth?.usuarioId;

    if (!usuarioId) {
      throw new HttpError(
        401,
        'Sessão não autenticada.'
      );
    }

    const contexto = await authService.me(
      usuarioId
    );

    res.json(contexto);
  } catch (error) {
    next(error);
  }
}
