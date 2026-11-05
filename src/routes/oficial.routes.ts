import { Router } from 'express';
import {
  aniversariantes,
  cargos,
  listar,
  resumo
} from '../controllers/oficial.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listar);

router.get('/aniversariantes', aniversariantes);

router.get('/resumo', resumo);

router.get('/cargos', cargos);

export default router;
