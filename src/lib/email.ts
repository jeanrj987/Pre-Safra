// E-mail de contato do cliente: só confere o formato (um @ e um domínio com ponto), sem tentar
// adivinhar se a caixa existe. Guardado em minúsculas e sem espaços.

/** Devolve o e-mail limpo ou null se não parecer um e-mail. */
export function normalizarEmail(entrada: string): string | null {
  const email = entrada.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) ? email : null;
}
