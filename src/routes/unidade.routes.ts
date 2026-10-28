import { Router } from 'express';
import {
  buscarCodigosPostais,
  criar,
  obterPorId,
  listarEstrutura,
  excluir,
  atualizar,
  criarCodigoPostal,
  criarIgreja,
  criarMunicipio,
  criarSubdivisaoLocal,
  criarUf,
  listar,
  listarIgrejas,
  listarDiasReuniao,
  listarFusosHorarios,
  listarMunicipios,
  listarPaises,
  listarSubdivisoesLocais,
  listarTipos,
  listarUfs
} from '../controllers/unidade.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/tipos', listarTipos);
router.get('/dias-reuniao', listarDiasReuniao);
router.get('/fusos-horarios', listarFusosHorarios);
router.get('/paises', listarPaises);

router.get('/ufs', listarUfs);
router.post('/ufs', criarUf);

router.get('/municipios', listarMunicipios);
router.post('/municipios', criarMunicipio);

router.get('/subdivisoes-locais', listarSubdivisoesLocais);
router.post('/subdivisoes-locais', criarSubdivisaoLocal);

router.get('/codigos-postais', buscarCodigosPostais);
router.post('/codigos-postais', criarCodigoPostal);

router.get('/igrejas', listarIgrejas);
router.post('/igrejas', criarIgreja);

router.get('/estrutura', listarEstrutura);
router.get('/:id', obterPorId);
router.put('/:id', atualizar);
router.delete('/:id', excluir);

router.get('/', listar);
router.post('/', criar);

export default router;
