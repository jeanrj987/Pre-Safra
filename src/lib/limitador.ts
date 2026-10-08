// Limitador de tentativas de login em memória. ATENÇÃO: na Vercel cada instância serverless
// tem o seu próprio Map, que zera a cada cold start — então isto só freia ataques que caem
// na mesma instância. A proteção de verdade contra força bruta deve ficar na borda (regra de
// rate limit do Vercel Firewall no POST /login) ou num store compartilhado (tabela no banco,
// Redis); trocar o Map por um deles não exige mudar quem chama estas três funções.
const tentativas = new Map<string, { n: number; expiraEm: number }>();
const JANELA_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 8;
// A chave vem do que a pessoa digitou no campo de e-mail: sem teto, o Map cresceria sem fim.
const MAX_CHAVES = 5000;

function podar(agora: number): void {
  for (const [chave, t] of tentativas) if (t.expiraEm <= agora) tentativas.delete(chave);
  // Ainda cheio depois de remover as vencidas: descarta as mais antigas (ordem de inserção).
  for (const chave of tentativas.keys()) {
    if (tentativas.size <= MAX_CHAVES) break;
    tentativas.delete(chave);
  }
}

export function loginBloqueado(chave: string): boolean {
  const t = tentativas.get(chave);
  return !!t && t.n >= MAX_TENTATIVAS && t.expiraEm > Date.now();
}

export function registrarFalhaLogin(chave: string): void {
  const agora = Date.now();
  const t = tentativas.get(chave);
  if (!t || t.expiraEm < agora) {
    if (tentativas.size >= MAX_CHAVES) podar(agora);
    tentativas.set(chave, { n: 1, expiraEm: agora + JANELA_MS });
  } else {
    t.n++;
  }
}

export function limparTentativasLogin(chave: string): void {
  tentativas.delete(chave);
}
