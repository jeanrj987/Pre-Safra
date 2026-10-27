"use server";
// Server Actions PÚBLICAS (a pessoa chega por um link gerado pelo administrador): não chamam exigirLogin.
// O token vem do fragmento da URL (#token=...), lido no cliente, e chega aqui por POST.
import { ipDoCliente } from "@/lib/ip-cliente";
import { redefinirComToken, validarToken } from "@/lib/recuperacao";

/** Estado para useActionState. `null` (ou ausente) = ainda não enviou. */
// `linkInvalido`: o servidor recusou o link (usado, vencido ou desconhecido); a tela manda procurar o administrador.
export type EstadoRedefinicao = { ok: boolean; mensagem: string; linkInvalido?: boolean } | null;

const texto = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** FormData: `token`, `senha`, `confirmacao`. Sucesso = { ok: true }; NÃO inicia sessão (mande a pessoa para /login). */
export async function redefinirSenhaAcao(_anterior: EstadoRedefinicao, formData: FormData): Promise<EstadoRedefinicao> {
  const resultado = await redefinirComToken(
    texto(formData.get("token")),
    texto(formData.get("senha")),
    texto(formData.get("confirmacao")),
    await ipDoCliente(),
  );
  return resultado.ok
    ? { ok: true, mensagem: "Senha alterada. Entre com a nova senha." }
    : { ok: false, mensagem: resultado.mensagem, ...(resultado.linkInvalido && { linkInvalido: true }) };
}

/** Opcional: a página chama ao abrir (com o token do fragmento) para só mostrar o formulário se o link servir. */
export async function validarLinkAcao(token: string): Promise<"valido" | "invalido" | "limitado"> {
  if (typeof token !== "string") return "invalido";
  return validarToken(token, await ipDoCliente());
}
