import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { obterConcilium } from '../controllers/dashboard.controller.js';

const router = Router();
router.use(authMiddleware);
router.get('/concilium', obterConcilium);
export default router;
