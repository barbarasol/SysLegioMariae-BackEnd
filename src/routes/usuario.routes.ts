import {
  Router
} from 'express';

import {
  adicionarAcessoUnidade,
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

const router =
  Router();

/*
 * Cadastro público:
 * pessoa + usuário PENDENTE_EMAIL,
 * sem perfil global e sem perfil de unidade.
 */
router.post(
  '/cadastro',
  cadastroPublico
);

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
