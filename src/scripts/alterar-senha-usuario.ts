import argon2 from 'argon2';
import { sequelize } from '../config/database.js';

const email = process.argv[2]?.trim().toLowerCase();
const senha = process.argv[3];

if (!email || !senha) {
  console.error(
    'Uso: npm run usuario:senha -- "email@usuario.com" "NovaSenha"'
  );
  process.exit(1);
}

if (senha.length < 8) {
  console.error('A senha deve possuir pelo menos 8 caracteres.');
  process.exit(1);
}

try {
  await sequelize.authenticate();

  const senhaHash = await argon2.hash(senha, {
    type: argon2.argon2id
  });

  const [resultado] = await sequelize.query(
    `
      UPDATE legio.usuario
         SET senha_hash = :senhaHash,
             tentativas_falhas = 0,
             bloqueado_ate = NULL,
             updated_at = CURRENT_TIMESTAMP
       WHERE lower(email) = lower(:email)
       RETURNING id::text, email
    `,
    {
      replacements: {
        email,
        senhaHash
      }
    }
  );

  const usuarios = resultado as Array<{
    id: string;
    email: string;
  }>;

  if (usuarios.length === 0) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ Senha atualizada para o usuário ${usuarios[0].email}.`);
  }
} catch (error) {
  console.error('❌ Erro ao alterar a senha do usuário:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
