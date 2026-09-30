// Limitador de tentativas de login em memória. Simples de propósito: o app roda numa
// instância só (ver next.config.ts), então não há necessidade de um store compartilhado
// (Redis etc.) — se isso mudar no futuro, troque o Map por um store externo.
const tentativas = new Map<string, { n: number; expiraEm: number }>();
const JANELA_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 8;

export function loginBloqueado(chave: string): boolean {
  const t = tentativas.get(chave);
  return !!t && t.n >= MAX_TENTATIVAS && t.expiraEm > Date.now();
}

export function registrarFalhaLogin(chave: string): void {
  const agora = Date.now();
  const t = tentativas.get(chave);
  if (!t || t.expiraEm < agora) {
    tentativas.set(chave, { n: 1, expiraEm: agora + JANELA_MS });
  } else {
    t.n++;
  }
}

export function limparTentativasLogin(chave: string): void {
  tentativas.delete(chave);
}
