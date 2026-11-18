import { HttpError } from '../utils/http-error.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SUPPORT = 'Entre em contato com o suporte: syslegiomariae@gmail.com.';

export function obterSiteKeyTurnstile(): string {
  return String(process.env.TURNSTILE_SITE_KEY ?? '').trim();
}

/** Falha fechada: nunca prosseguir sem chave ou sem resposta positiva da Cloudflare. */
export async function exigirTurnstile(tokenBruto: unknown): Promise<void> {
  const secret = String(process.env.TURNSTILE_SECRET_KEY ?? '').trim();
  const siteKey = obterSiteKeyTurnstile();
  if (!secret || !siteKey) {
    throw new HttpError(503, 'Verificação de segurança indisponível. ' + SUPPORT);
  }
  // As chaves públicas de teste não devem ser utilizadas em produção.
  if (process.env.NODE_ENV === 'production' &&
      (siteKey.startsWith('1x000000') || siteKey.startsWith('2x000000') ||
       siteKey.startsWith('3x000000') || secret.startsWith('1x000000') ||
       secret.startsWith('2x000000') || secret.startsWith('3x000000'))) {
    throw new HttpError(503, 'Chaves CAPTCHA de teste não são permitidas em produção. ' + SUPPORT);
  }
  const token = typeof tokenBruto === 'string' ? tokenBruto.trim() : '';
  if (!token || token.length > 2048) {
    throw new HttpError(400, 'Conclua a verificação de segurança para prosseguir.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch(SITEVERIFY, {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal
    });
    if (!response.ok) throw new HttpError(503, 'Serviço de verificação de segurança indisponível.');
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    if (result.success !== true) {
      throw new HttpError(403, 'Verificação de segurança inválida ou expirada. Faça a verificação novamente.');
    }
    const hostnames = String(process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
      .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    // Exigir a lista de hostnames confiáveis em produção; não confiar em valores do usuário.
    if (process.env.NODE_ENV === 'production' && hostnames.length === 0) {
      throw new HttpError(503, 'Configuração de segurança incompleta. ' + SUPPORT);
    }
    if (hostnames.length && !hostnames.includes(String(result.hostname ?? '').toLowerCase())) {
      throw new HttpError(403, 'Origem da verificação de segurança não autorizada.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Não foi possível validar a verificação de segurança. Tente novamente.');
  } finally {
    clearTimeout(timer);
  }
}
