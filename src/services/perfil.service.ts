import argon2 from 'argon2';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { HttpError } from '../utils/http-error.js';

// Operações restritas ao usuário da sessão. Não aceita usuarioId do corpo.
interface UsuarioPerfilRow {
  usuario_id: string;
  pessoa_id: string;
  email: string;
  status: string;
  senha_hash: string;
  nome: string;
  nome_preferido: string | null;
  cpf: string | null;
  celular: string | null;
}

export interface AlterarDadosPerfilInput {
  nomePreferido?: unknown;
  celular?: unknown;
  email?: unknown;
  senhaAtual?: unknown;
}

export interface AlterarSenhaInput {
  senhaAtual?: unknown;
  novaSenha?: unknown;
}

export interface SalvarPreferenciasInput {
  notificacoesEmail?: unknown;
  notificacoesSistema?: unknown;
  modoEscuro?: unknown;
}

export interface PreferenciasUsuario {
  notificacoesEmail: boolean;
  notificacoesSistema: boolean;
  modoEscuro: boolean;
}

function normalizarEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizarOpcional(value: unknown, max: number): string | null {
  if (value != null && typeof value !== 'string') {
    throw new HttpError(400, 'Dados do perfil inválidos.');
  }
  const resultado = String(value ?? '').trim();
  if (resultado.length > max) {
    throw new HttpError(400, `O campo informado excede ${max} caracteres.`);
  }
  return resultado || null;
}

/** Atualiza exclusivamente o perfil do dono da sessão. */
export async function atualizarDados(
  usuarioId: string,
  input: AlterarDadosPerfilInput
) {
  return sequelize.transaction(async (transaction) => {
    const linhas = await sequelize.query<UsuarioPerfilRow>(
      `SELECT u.id::text AS usuario_id,
              u.pessoa_id::text AS pessoa_id,
              u.email, u.status, u.senha_hash,
              p.nome, p.nome_preferido, p.cpf, p.celular
         FROM legio.usuario u
         JOIN legio.pessoa p ON p.id = u.pessoa_id
        WHERE u.id = :usuarioId
        FOR UPDATE OF u, p`,
      { replacements: { usuarioId }, type: QueryTypes.SELECT, transaction }
    );
    const atual = linhas[0];
    if (!atual) throw new HttpError(404, 'Usuário autenticado não encontrado.');

    const email = input.email === undefined
      ? atual.email.toLowerCase()
      : normalizarEmail(input.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Informe um e-mail válido.');
    }

    const nomePreferido = input.nomePreferido === undefined
      ? atual.nome_preferido
      : normalizarOpcional(input.nomePreferido, 150);
    const celular = input.celular === undefined
      ? atual.celular
      : normalizarOpcional(input.celular, 25);
    const digitos = String(celular ?? '').replace(/\D/g, '');
    if (celular && (digitos.length < 10 || digitos.length > 15)) {
      throw new HttpError(400, 'Informe um telefone válido, com DDD.');
    }

    const alterouEmail = email !== atual.email.toLowerCase();
    if (alterouEmail) {
      const senhaAtual = typeof input.senhaAtual === 'string'
        ? input.senhaAtual
        : '';
      if (!senhaAtual || !(await argon2.verify(atual.senha_hash, senhaAtual))) {
        throw new HttpError(403, 'Senha atual incorreta. Ela é obrigatória para trocar o e-mail.');
      }

      const conflitos = await sequelize.query<{ id: string }>(
        `SELECT id::text FROM legio.usuario
          WHERE lower(email) = :email AND id <> :usuarioId LIMIT 1`,
        { replacements: { email, usuarioId }, type: QueryTypes.SELECT, transaction }
      );
      if (conflitos.length > 0) {
        throw new HttpError(409, 'Este e-mail já está associado a outro usuário.');
      }

      // E-mail da conta, não o e-mail de contato histórico do membro.
      await sequelize.query(
        `UPDATE legio.usuario SET email = :email WHERE id = :usuarioId`,
        { replacements: { email, usuarioId }, transaction }
      );
    }

    await sequelize.query(
      `UPDATE legio.pessoa
          SET nome_preferido = :nomePreferido,
              celular = :celular
        WHERE id = :pessoaId`,
      {
        replacements: { nomePreferido, celular, pessoaId: atual.pessoa_id },
        transaction
      }
    );

    return {
      usuario: { id: atual.usuario_id, email, status: atual.status },
      pessoa: {
        id: atual.pessoa_id,
        nome: atual.nome,
        nomePreferido,
        cpf: atual.cpf,
        celular
      }
    };
  });
}

export async function alterarSenha(usuarioId: string, input: AlterarSenhaInput) {
  const atual = typeof input.senhaAtual === 'string' ? input.senhaAtual : '';
  const nova = typeof input.novaSenha === 'string' ? input.novaSenha : '';
  if (!atual) throw new HttpError(400, 'Informe sua senha atual.');
  if (nova.length < 8 || nova.length > 128) {
    throw new HttpError(400, 'A nova senha deve ter entre 8 e 128 caracteres.');
  }
  if (nova === atual) {
    throw new HttpError(400, 'A nova senha deve ser diferente da atual.');
  }

  return sequelize.transaction(async transaction => {
    const linhas = await sequelize.query<{ senha_hash: string }>(
      `SELECT senha_hash FROM legio.usuario WHERE id = :usuarioId FOR UPDATE`,
      { replacements: { usuarioId }, type: QueryTypes.SELECT, transaction }
    );
    if (!linhas[0]) throw new HttpError(404, 'Usuário autenticado não encontrado.');
    if (!(await argon2.verify(linhas[0].senha_hash, atual))) {
      throw new HttpError(403, 'Senha atual incorreta.');
    }
    const senhaHash = await argon2.hash(nova, { type: argon2.argon2id });
    await sequelize.query(
      `UPDATE legio.usuario
          SET senha_hash = :senhaHash,
              tentativas_falhas = 0,
              bloqueado_ate = NULL
        WHERE id = :usuarioId`,
      { replacements: { senhaHash, usuarioId }, transaction }
    );
    // Os tokens de renovação de outras sessões são revogados por segurança.
    // O access token já emitido pode continuar válido até o vencimento.
    await sequelize.query(
      `UPDATE legio.usuario_refresh_token
          SET revogado_em = CURRENT_TIMESTAMP
        WHERE usuario_id = :usuarioId AND revogado_em IS NULL`,
      { replacements: { usuarioId }, transaction }
    );
    return { message: 'Senha alterada com sucesso. Faça login novamente ao encerrar esta sessão.' };
  });
}

function mapearPreferencias(row?: {
  notificacoes_email: boolean;
  notificacoes_sistema: boolean;
  modo_escuro: boolean;
}): PreferenciasUsuario {
  return {
    notificacoesEmail: row?.notificacoes_email ?? true,
    notificacoesSistema: row?.notificacoes_sistema ?? true,
    modoEscuro: row?.modo_escuro ?? false
  };
}

export async function consultarPreferencias(usuarioId: string): Promise<PreferenciasUsuario> {
  const rows = await sequelize.query<{
    notificacoes_email: boolean;
    notificacoes_sistema: boolean;
    modo_escuro: boolean;
  }>(
    `SELECT notificacoes_email, notificacoes_sistema, modo_escuro
       FROM legio.usuario_preferencias WHERE usuario_id = :usuarioId`,
    { replacements: { usuarioId }, type: QueryTypes.SELECT }
  );
  return mapearPreferencias(rows[0]);
}

export async function salvarPreferencias(
  usuarioId: string,
  input: SalvarPreferenciasInput
): Promise<PreferenciasUsuario> {
  if (
    typeof input.notificacoesEmail !== 'boolean' ||
    typeof input.notificacoesSistema !== 'boolean' ||
    typeof input.modoEscuro !== 'boolean'
  ) {
    throw new HttpError(400, 'As preferências devem possuir valores booleanos.');
  }
  const rows = await sequelize.query<{
    notificacoes_email: boolean;
    notificacoes_sistema: boolean;
    modo_escuro: boolean;
  }>(
    `INSERT INTO legio.usuario_preferencias
       (usuario_id, notificacoes_email, notificacoes_sistema, modo_escuro)
     VALUES (:usuarioId, :notificacoesEmail, :notificacoesSistema, :modoEscuro)
     ON CONFLICT (usuario_id) DO UPDATE
       SET notificacoes_email = EXCLUDED.notificacoes_email,
           notificacoes_sistema = EXCLUDED.notificacoes_sistema,
           modo_escuro = EXCLUDED.modo_escuro,
           updated_at = CURRENT_TIMESTAMP
     RETURNING notificacoes_email, notificacoes_sistema, modo_escuro`,
    {
      replacements: {
        usuarioId,
        notificacoesEmail: input.notificacoesEmail,
        notificacoesSistema: input.notificacoesSistema,
        modoEscuro: input.modoEscuro
      },
      type: QueryTypes.SELECT
    }
  );
  return mapearPreferencias(rows[0]);
}
