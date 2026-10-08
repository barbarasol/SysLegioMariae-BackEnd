import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import {
  errorMiddleware
} from './middlewares/error.middleware.js';

dotenv.config();

const app = express();

const frontendUrl =
  process.env.FRONTEND_URL ||
  'http://localhost:4200';

app.use(
  cors({
    origin: frontendUrl,
    credentials: true
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'API Legio Mariae funcionando!'
  });
});

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  errorMiddleware
);

const PORT =
  Number(process.env.PORT) ||
  3000;

async function startServer() {
  try {
    await sequelize.authenticate();

    console.log(
      '✅ Conexão com PostgreSQL realizada com sucesso!'
    );

    app.listen(PORT, () => {
      console.log(
        `🚀 Servidor rodando na porta ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      '❌ Erro ao conectar com PostgreSQL:',
      error
    );
  }
}

startServer();
