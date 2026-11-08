import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/unidade-institucional.controller.js';
const router = Router();
router.use(authMiddleware);
router.get('/:unidadeId', controller.obter);
router.put('/:unidadeId', controller.atualizar);
export default router;
