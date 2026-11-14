import { Router } from 'express';
import {
  catalogos,
  criar,
  listar,
  resumo,
  meuCadastro,
  atualizarMeuCadastro,
  listarPendentes,
  validarPendente
} from '../controllers/membro.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listar);

router.get('/resumo', resumo);

router.get('/catalogos', catalogos);

// Rotas fixas antes das parametrizadas. Validação de acesso feita no service.
router.get('/pendentes', listarPendentes);
router.post('/pendentes/:usuarioId/validar', validarPendente);

router.get('/me', meuCadastro);

router.patch('/me', atualizarMeuCadastro);

router.post('/', criar);

export default router;