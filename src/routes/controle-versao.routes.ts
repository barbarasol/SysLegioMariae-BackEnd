import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { exigirPlatformOwner } from '../middlewares/platform-owner.middleware.js';
import * as controller from '../controllers/controle-versao.controller.js';

const router = Router();
router.use(authMiddleware);

// Versão exibida abaixo do logotipo: qualquer usuário autenticado pode consultar.
router.get('/atual', controller.atual);

// CRUD E lista: somente PLATFORM_OWNER, validado em cada requisição.
router.use(exigirPlatformOwner);
router.get('/', controller.listar);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.excluir);

export default router;
