import { Router } from 'express';
import {
  aprovar,
  buscarMembros,
  catalogos,
  criar,
  listar,
  rejeitar,
  resumo
} from '../controllers/solicitacao-oficial.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';
import {
  perfilMiddleware
} from '../middlewares/perfil.middleware.js';

const router = Router();

router.use(authMiddleware);

/** Catalogos e busca de membros: qualquer usuario autenticado. */
router.get('/catalogos', catalogos);
router.get('/membros', buscarMembros);

/** Criar proposta: qualquer usuario autenticado. */
router.post('/', criar);

/** Analise: apenas perfis autorizados. */
const PERFIS_ANALISE = [
  'PLATFORM_OWNER',
  'PLATFORM_ADMIN',
  'ADMIN_UNIDADE'
];

router.get('/', listar);
router.get('/resumo', resumo);

router.post(
  '/:id/aprovar',
  perfilMiddleware(PERFIS_ANALISE),
  aprovar
);

router.post(
  '/:id/rejeitar',
  perfilMiddleware(PERFIS_ANALISE),
  rejeitar
);

export default router;