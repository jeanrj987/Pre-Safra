// Política de senha única do sistema: criar usuário, redefinir pelo admin, redefinir pelo link e o
// script criar-usuario usam esta mesma regra. Sem dependência do Next, então vale também em scripts (tsx).

export const SENHA_MIN = 10;
export const SENHA_MAX = 128;

export type CodigoErroSenha = "vazia" | "curta" | "longa" | "diferente";

export const MENSAGEM_ERRO_SENHA: Record<CodigoErroSenha, string> = {
  vazia: "A senha não pode ser só espaços.",
  curta: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`,
  longa: `A senha pode ter no máximo ${SENHA_MAX} caracteres.`,
  diferente: "A confirmação não é igual à senha.",
};

/** Devolve o código do problema da senha, ou null se ela atende à política. Não mexe nos espaços (não faz trim). */
export function validarSenha(senha: string): Exclude<CodigoErroSenha, "diferente"> | null {
  // Conta caracteres de verdade (um emoji vale 1), não unidades UTF-16.
  const tamanho = [...senha].length;
  if (tamanho < SENHA_MIN) return "curta";
  if (tamanho > SENHA_MAX) return "longa";
  if (senha.trim() === "") return "vazia";
  return null;
}

/** Valida a senha e, quando há campo de confirmação, confere se as duas são iguais. */
export function validarNovaSenha(senha: string, confirmacao?: string): CodigoErroSenha | null {
  const codigo = validarSenha(senha);
  if (codigo) return codigo;
  if (confirmacao !== undefined && confirmacao !== senha) return "diferente";
  return null;
}

/** Texto em português para o código; undefined se o código for desconhecido (ex.: vindo de uma URL). */
export function mensagemErroSenha(codigo: string | null | undefined): string | undefined {
  return codigo && Object.hasOwn(MENSAGEM_ERRO_SENHA, codigo)
    ? MENSAGEM_ERRO_SENHA[codigo as CodigoErroSenha]
    : undefined;
}
