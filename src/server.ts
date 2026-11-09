import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import {
  errorMiddleware
} from './middlewares/error.middleware.js';
import usuarioRoutes from './routes/usuario.routes.js';
import unidadeRoutes from './routes/unidade.routes.js';
import solicitacaoRoutes from './routes/solicitacao.routes.js';
import membroRoutes from './routes/membro.routes.js';
import oficialRoutes from './routes/oficial.routes.js';
import solicitacaoOficialRoutes from './routes/solicitacao-oficial.routes.js';
import unidadeNumerosRouter from './routes/unidade-numeros.routes.js';
import unidadeVisitasRouter from './routes/unidade-visitas.routes.js';
import unidadeInstitucionalRouter from './routes/unidade-institucional.routes.js';
import igrejaEdicaoRouter from './routes/igreja-edicao.routes.js';
import controleVersaoRouter from './routes/controle-versao.routes.js';


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
  '/api/controle-versao', 
  controleVersaoRouter
);

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/usuarios',
  usuarioRoutes
)

app.use(
  '/api/unidades/igrejas', 
  igrejaEdicaoRouter
);

app.use(
  '/api/unidades',
  unidadeRoutes
)

app.use(
  '/api/solicitacoes-unidades',
  solicitacaoRoutes
)

app.use(
  '/api/membros',
  membroRoutes
)

app.use(
  '/api/oficiais',
  oficialRoutes
);

app.use(
  '/api/solicitacoes-oficiais', 
  solicitacaoOficialRoutes
);

app.use('/api/unidade-numeros', unidadeNumerosRouter);
app.use('/api/unidade-visitas', unidadeVisitasRouter);
app.use('/api/unidade-institucional', unidadeInstitucionalRouter);

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
