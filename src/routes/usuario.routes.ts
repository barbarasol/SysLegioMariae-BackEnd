import { Router } from 'express';
import {
  criar
} from '../controllers/usuario.controller.js';
import {
  authMiddleware
} from '../middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  criar
);

export default router;