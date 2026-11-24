import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { paises, unidades, opcoes } from '../controllers/mapa-mundial.controller.js';
const router = Router();
router.use(authMiddleware);
router.get('/paises', paises);
router.get('/unidades', unidades);
router.get('/opcoes', opcoes);
export default router;
