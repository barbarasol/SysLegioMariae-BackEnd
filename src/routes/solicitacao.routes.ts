import { Router } from 'express';
import {
  aprovar,
  listar,
  rejeitar,
  resumo
} from '../controllers/solicitacao.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listar);

router.get('/resumo', resumo);

router.post('/:id/aprovar', aprovar);

router.post('/:id/rejeitar', rejeitar);

export default router;