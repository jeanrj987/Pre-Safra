import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { verificarSenha } from "@/lib/senha";
import { limparTentativasLogin, loginBloqueado, registrarFalhaLogin } from "@/lib/limitador";

const COOKIE = "presafra_sessao";
const SEIS_MESES = 60 * 60 * 24 * 180;

export interface UsuarioSessao {
  id: number;
  nome: string;
  email: string;
  admin: boolean;
  /** Conta restrita ao Painel (ex.: TV da sala) — ver exigirAcessoPainel/exigirAcessoCompleto. */
  somentePainel: boolean;
}

// A assinatura inclui o senhaHash atual: trocar a senha ou desativar o usuário invalida
// qualquer sessão antiga automaticamente, sem precisar de uma tabela de sessões revogadas.
function assinatura(id: number, senhaHash: string): string {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) throw new Error("AUTH_SECRET não configurado");
  return createHmac("sha256", segredo).update(`sessao-v2:${id}:${senhaHash}`).digest("hex");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function autenticar(email: string, senha: string) {
  const chave = email.trim().toLowerCase();
  // Bloqueia por e-mail (não por IP): mais simples e suficiente para uma equipe pequena
  // atrás de logins nominais — evita tentativa por força bruta contra uma conta específica.
  if (loginBloqueado(chave)) return null;

  const usuario = await prisma.usuario.findUnique({ where: { email: chave } });
  const valido = !!usuario?.ativo && (await verificarSenha(senha, usuario.senhaHash));
  if (!valido) {
    registrarFalhaLogin(chave);
    return null;
  }
  limparTentativasLogin(chave);
  return usuario;
}

export async function iniciarSessao(usuario: { id: number; senhaHash: string }) {
  (await cookies()).set(COOKIE, `${usuario.id}.${assinatura(usuario.id, usuario.senhaHash)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SEIS_MESES,
    path: "/",
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

// cache() evita bater no banco várias vezes no mesmo request (a página chama exigirLogin(),
// o Shell chama usuarioAtual() de novo para montar a navegação).
const carregarSessao = cache(async (): Promise<UsuarioSessao | null> => {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;
  const [idTexto, assinaturaRecebida] = valor.split(".");
  const id = Number(idTexto);
  if (!Number.isInteger(id) || !assinaturaRecebida) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario || !usuario.ativo) return null;
  if (!iguais(assinaturaRecebida, assinatura(usuario.id, usuario.senhaHash))) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    admin: usuario.admin,
    somentePainel: usuario.somentePainel,
  };
});

export const usuarioAtual = () => carregarSessao();

export async function logado(): Promise<boolean> {
  return (await usuarioAtual()) !== null;
}

// Use no topo de toda página e Server Action protegida.
export async function exigirLogin(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

// Use no topo de toda página e Server Action restrita a administradores.
export async function exigirAdmin(): Promise<UsuarioSessao> {
  const usuario = await exigirLogin();
  if (!usuario.admin) redirect("/");
  return usuario;
}

// Painel: liberado para admin e para a conta restrita "somente Painel" (ex.: TV da sala).
export async function exigirAcessoPainel(): Promise<UsuarioSessao> {
  const usuario = await exigirLogin();
  if (!usuario.admin && !usuario.somentePainel) redirect("/");
  return usuario;
}

// Use no topo das páginas que não são o Painel (Clientes, Novo cliente, registro de
// cliente): uma conta "somente Painel" tentando abrir qualquer uma delas volta pro Painel,
// em vez de ver a lista de clientes ou poder editar algo.
export async function exigirAcessoCompleto(): Promise<UsuarioSessao> {
  const usuario = await exigirLogin();
  if (usuario.somentePainel) redirect("/painel");
  return usuario;
}
