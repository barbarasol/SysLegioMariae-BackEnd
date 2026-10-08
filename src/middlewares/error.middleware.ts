import type {
  ErrorRequestHandler
} from 'express';
import { HttpError } from '../utils/http-error.js';

export const errorMiddleware: ErrorRequestHandler = (
  error,
  req,
  res,
  next
) => {

  if (error instanceof HttpError) {
    res.status(error.status).json({
      message: error.message
    });
    return;
  }

  console.error('❌ Erro não tratado:', error);

  res.status(500).json({
    message: 'Erro interno do servidor.'
  });
};
