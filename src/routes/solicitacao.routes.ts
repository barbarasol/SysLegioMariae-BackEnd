import { Router } from 'express';
import {
  aprovar,
  listar,
  rejeitar,
  resumo
} from '../controllers/solicitacao.controller.js';
import { detalhar } from '../controllers/solicitacao-detalhe.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

// Todas as rotas de solicitações continuam protegidas por autenticação.
router.use(authMiddleware);

// Rotas GET estáticas devem ficar antes da rota parametrizada.
router.get('/', listar);
router.get('/resumo', resumo);

// Consulta dados reais de uma solicitação pelo ID, independentemente do status.
router.get('/:id', detalhar);

// Fluxos existentes de aprovação e rejeição permanecem inalterados.
router.post('/:id/aprovar', aprovar);
router.post('/:id/rejeitar', rejeitar);

export default router;
