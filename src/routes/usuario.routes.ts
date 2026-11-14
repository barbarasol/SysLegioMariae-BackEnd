import {
  Router
} from 'express';

import {
  adicionarAcessoUnidade,
  aprovarSolicitacao,
  catalogosCadastro,
  alterarAcessoUnidade,
  atualizar,
  cadastroPublico,
  criar,
  excluir,
  listar,
  listarAcessosUnidade,
  listarPerfisGlobais,
  listarPerfisUnidade,
  listarUnidadesDisponiveis,
  removerAcessoUnidade
} from '../controllers/usuario.controller.js';

import {
  authMiddleware
} from '../middlewares/auth.middleware.js';
import { exigirGestorUsuarios } from '../middlewares/gestao-usuarios.middleware.js';

const router =
  Router();

/*
 * Cadastro público:
 * pessoa + usuário PENDENTE_EMAIL,
 * sem perfil global e sem perfil de unidade.
 */
router.get('/catalogos-cadastro', catalogosCadastro);

router.post(
  '/cadastro',
  cadastroPublico
);

// Todas as operações administrativas abaixo exigem PLATFORM_OWNER ou PLATFORM_ADMIN, além da autenticação.
router.use(authMiddleware, exigirGestorUsuarios);

router.get(
  '/perfis-globais',
  authMiddleware,
  listarPerfisGlobais
);

router.get(
  '/perfis-unidade',
  authMiddleware,
  listarPerfisUnidade
);

router.get(
  '/unidades-disponiveis',
  authMiddleware,
  listarUnidadesDisponiveis
);

router.post('/:id/aprovar-solicitacao', authMiddleware, aprovarSolicitacao);

router.get(
  '/:id/acessos-unidade',
  authMiddleware,
  listarAcessosUnidade
);

router.post(
  '/:id/acessos-unidade',
  authMiddleware,
  adicionarAcessoUnidade
);

router.put(
  '/:id/acessos-unidade/:unidadeId/:perfilCodigo',
  authMiddleware,
  alterarAcessoUnidade
);

router.delete(
  '/:id/acessos-unidade/:unidadeId/:perfilCodigo',
  authMiddleware,
  removerAcessoUnidade
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
