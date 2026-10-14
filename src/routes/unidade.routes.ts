import { Router } from 'express';
import {
  criar,
  listar
} from '../controllers/unidade.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listar);

router.post('/', criar);

export default router;
