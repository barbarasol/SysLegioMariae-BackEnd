import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import * as controller from '../controllers/unidade-numeros.controller.js';

const router = Router();
router.use(authMiddleware);

// Rotas fixas ANTES das rotas com parâmetros.
router.get('/:unidadeId', controller.listarHistorico);
router.get('/:unidadeId/:ano/:mes', controller.obter);
router.put('/:unidadeId/:ano/:mes', controller.salvar);
router.post('/:unidadeId/:ano/:mes/confirmar', controller.confirmar);
router.post('/:unidadeId/:ano/:mes/reabrir', controller.reabrir);
router.post('/:unidadeId/:ano/:mes/copiar-anterior', controller.copiarAnterior);

export default router;
