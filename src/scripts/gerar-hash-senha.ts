import argon2 from 'argon2';

const senha = process.argv[2];

if (!senha) {
  console.error(
    'Uso: npm run senha:hash -- "SuaSenhaAqui"'
  );
  process.exit(1);
}

const hash = await argon2.hash(
  senha,
  {
    type: argon2.argon2id
  }
);

console.log(hash);
