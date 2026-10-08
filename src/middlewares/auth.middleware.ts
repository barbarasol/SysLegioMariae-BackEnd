import type {
  NextFunction,
  Request,
  Response
} from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from '../utils/http-error.js';

export interface AuthenticatedRequest extends Request {
  auth?: {
    usuarioId: string;
    email: string;
  };
}

type JwtPayloadLegio = {
  sub: string;
  email: string;
};

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {

  const authorization = req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith('Bearer ')
  ) {
    next(new HttpError(401, 'Sessão não autenticada.'));
    return;
  }

  const token = authorization.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    next(new HttpError(
      500,
      'JWT_SECRET não configurado no servidor.'
    ));
    return;
  }

  try {
    const payload = jwt.verify(
      token,
      secret
    ) as JwtPayloadLegio;

    if (!payload.sub || !payload.email) {
      throw new Error('Payload JWT inválido.');
    }

    req.auth = {
      usuarioId: String(payload.sub),
      email: String(payload.email)
    };

    next();
  } catch {
    next(new HttpError(
      401,
      'Sessão expirada ou inválida.'
    ));
  }
}
