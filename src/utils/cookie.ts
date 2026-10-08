export function getCookie(
  cookieHeader: string | undefined,
  nome: string
): string | null {

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader
    .split(';')
    .map((item) => item.trim());

  for (const cookie of cookies) {
    const separador = cookie.indexOf('=');

    if (separador < 0) {
      continue;
    }

    const chave = cookie.slice(0, separador);
    const valor = cookie.slice(separador + 1);

    if (chave === nome) {
      return decodeURIComponent(valor);
    }
  }

  return null;
}
