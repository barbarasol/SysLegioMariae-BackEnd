import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { atualizarIgreja } from '../controllers/igreja-edicao.controller.js';
const router = Router();
router.use(authMiddleware);
router.put('/:id', atualizarIgreja);
export default router;
