import { Router } from 'express';
import {
  aniversariantes,
  cargos,
  encerrar,
  listar,
  resumo,
  unidadesAcessiveis,
  tiposUnidades,
  obter,
  atualizar
} from '../controllers/oficial.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listar);

router.get('/aniversariantes', aniversariantes);

router.get('/resumo', resumo);

router.get('/cargos', cargos);

router.get('/unidades-acessiveis', unidadesAcessiveis);
router.get('/tipos-unidades', tiposUnidades);
router.get('/:id', obter);
router.put('/:id', atualizar);

router.delete('/:id', encerrar);

export default router;
