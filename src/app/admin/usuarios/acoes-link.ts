"use server";
// Server Action do botão "Gerar link de redefinição" (só administrador total). Devolve o link ao
// admin para ele entregar à pessoa por WhatsApp/Teams; não envia o link por e-mail e não registra o token.
import { exigirAdmin } from "@/lib/auth";
import { registrarSeDentroDoLimite } from "@/lib/limitador";
import { urlBase } from "@/lib/recuperacao";
import { gerarLinkRedefinicaoAdmin, LIMITE_LINK_ADMIN, MENSAGEM_APP_URL } from "@/lib/recuperacao-admin";

/** Estado serializável devolvido à janela. `link` só existe quando `ok` é verdadeiro. */
export type EstadoLinkRedefinicao = { ok: boolean; mensagem: string; link?: string };

export async function gerarLinkRedefinicao(usuarioId: number): Promise<EstadoLinkRedefinicao> {
  const admin = await exigirAdmin();
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return { ok: false, mensagem: "Usuário não encontrado." };

  // APP_URL errada é problema de configuração, não de abuso: confere antes do limite, para os cliques
  // com a configuração errada não gastarem as 20 tentativas por hora do usuário.
  if (!urlBase()) return { ok: false, mensagem: MENSAGEM_APP_URL };

  try {
    if (!(await registrarSeDentroDoLimite([{ limite: LIMITE_LINK_ADMIN, chave: String(usuarioId) }]))) {
      return { ok: false, mensagem: "Muitos links foram gerados para este usuário na última hora. Aguarde um pouco e tente novamente." };
    }
    const resultado = await gerarLinkRedefinicaoAdmin(usuarioId);
    if (!resultado.ok) return resultado;
    // Auditoria mínima no log do servidor: só os ids, nunca o token nem o link.
    console.info(`Link de redefinição de senha gerado pelo admin ${admin.id} para o usuário ${usuarioId}.`);
    return { ok: true, mensagem: "Link gerado.", link: resultado.link };
  } catch {
    // Sem detalhes no log: o erro pode carregar dados da conta.
    console.error("Falha ao gerar o link de redefinição de senha.");
    return { ok: false, mensagem: "Não foi possível gerar o link agora. Tente novamente." };
  }
}
