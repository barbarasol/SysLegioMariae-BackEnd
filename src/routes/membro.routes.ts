import { Router } from 'express';
import {
  catalogos,
  criar,
  listar,
  resumo
} from '../controllers/membro.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listar);

router.get('/resumo', resumo);

router.get('/catalogos', catalogos);

router.post('/', criar);

export default router;