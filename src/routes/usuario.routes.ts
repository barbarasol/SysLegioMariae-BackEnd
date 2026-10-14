import {
  Router
} from 'express';

import {
  atualizar,
  criar,
  excluir,
  listar,
  listarPerfisGlobais
} from '../controllers/usuario.controller.js';

import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router =
  Router();

router.get(
  '/perfis-globais',
  authMiddleware,
  listarPerfisGlobais
);

router.get(
  '/',
  authMiddleware,
  listar
);

router.post(
  '/',
  authMiddleware,
  criar
);

router.put(
  '/:id',
  authMiddleware,
  atualizar
);

router.delete(
  '/:id',
  authMiddleware,
  excluir
);

export default router;
