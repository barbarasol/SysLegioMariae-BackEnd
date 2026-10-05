import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { sequelize } from './config/database.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'API Legio Mariae funcionando!'
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sequelize.authenticate();

    console.log('✅ Conexão com PostgreSQL realizada com sucesso!');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erro ao conectar com PostgreSQL:', error);
  }
}

startServer();