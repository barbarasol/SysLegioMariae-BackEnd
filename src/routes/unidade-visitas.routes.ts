import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/unidade-visitas.controller.js';

const router = Router();
router.use(authMiddleware);
router.get('/:unidadeId', controller.listar);
router.post('/:unidadeId', controller.criar);
router.put('/:unidadeId/:visitaId', controller.atualizar);
router.delete('/:unidadeId/:visitaId', controller.excluir);
export default router;
