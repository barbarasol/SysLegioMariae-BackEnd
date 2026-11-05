import { Router } from 'express';
import {
  login,
  logout,
  me,
  refresh
} from '../controllers/auth.controller.js';
import {
  atualizarMeuPerfil,
  alterarMinhaSenha,
  obterMinhasPreferencias,
  atualizarMinhasPreferencias
} from '../controllers/perfil.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
router.put('/me', authMiddleware, atualizarMeuPerfil);
router.put('/me/senha', authMiddleware, alterarMinhaSenha);
router.get('/me/preferencias', authMiddleware, obterMinhasPreferencias);
router.put('/me/preferencias', authMiddleware, atualizarMinhasPreferencias);

export default router;
