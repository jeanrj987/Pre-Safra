// Link de redefinição de senha gerado pelo ADMINISTRADOR: é o único caminho para quem esqueceu a senha.
// O admin gera o link, copia e o entrega à pessoa por WhatsApp/Teams; ela abre, escolhe a própria senha
// e o resto (validação do token, uso único, troca de senha) fica em /redefinir-senha (ver recuperacao.ts).
//
// Este arquivo NÃO envia e-mail e NUNCA registra o token em log. O token em claro só existe no link
// devolvido ao admin; no banco fica só o SHA-256.
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Limite } from "@/lib/limitador";
import { hashDoToken, invalidarTokensDoUsuario, urlBase } from "@/lib/recuperacao";

const UMA_HORA_MS = 60 * 60 * 1000;

// O link vai por chat (WhatsApp/Teams) e a pessoa pode demorar a abrir: por isso vale 24 horas.
// Continua sendo de uso único.
export const VALIDADE_LINK_ADMIN_HORAS = 24;
export const VALIDADE_LINK_ADMIN_MS = VALIDADE_LINK_ADMIN_HORAS * UMA_HORA_MS;

/** Teto de links gerados por hora para o mesmo usuário-alvo (chave = id do usuário). Evita abuso/loop. */
export const LIMITE_LINK_ADMIN: Limite = { tipo: "link-admin-alvo", max: 20, janelaMs: UMA_HORA_MS };

export const MENSAGEM_APP_URL =
  "Configure a variável APP_URL com o endereço público do sistema (em produção, começando com https://) para gerar o link.";

export type ResultadoLinkAdmin = { ok: true; link: string } | { ok: false; mensagem: string };

/**
 * Gera o link de redefinição para o usuário e cancela os links pendentes dele (na mesma transação).
 * As mensagens de erro vão direto ao admin autenticado, então podem ser específicas.
 */
export async function gerarLinkRedefinicaoAdmin(usuarioId: number): Promise<ResultadoLinkAdmin> {
  const base = urlBase();
  if (!base) return { ok: false, mensagem: MENSAGEM_APP_URL };

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, ativo: true, somentePainel: true },
  });
  if (!usuario) return { ok: false, mensagem: "Usuário não encontrado." };
  if (!usuario.ativo) return { ok: false, mensagem: "Este usuário está inativo. Reative a conta antes de gerar um link." };
  if (usuario.somentePainel) {
    return { ok: false, mensagem: "Contas do papel Painel (TV) não usam link de redefinição. Use \"Redefinir senha\"." };
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    invalidarTokensDoUsuario(usuario.id),
    prisma.tokenRecuperacao.create({
      data: { usuarioId: usuario.id, tokenHash: hashDoToken(token), expiraEm: new Date(Date.now() + VALIDADE_LINK_ADMIN_MS) },
    }),
  ]);

  return { ok: true, link: `${base}/redefinir-senha#token=${token}` };
}
