// Todos os usuários veem todos os clientes. O que cada um faz:
// - agendar: qualquer cliente (ver podeAgendarCliente);
// - assumir um cliente que ainda não tem responsável: usuário com "nomeResponsavel" (podeAssumirCliente);
// - remover o agendamento, finalizar, reabrir e editar o registro: o admin e o usuário cujo "nomeResponsavel" é o responsável
//   do cliente (podeAlterarCliente), porque isso mexe nos números do Painel e no histórico;
// - trocar o responsável de quem já tem um: só o admin.
import { prisma } from "./db";
import { normalizar } from "./texto";

export interface UsuarioParaPermissao {
  admin: boolean;
  nomeResponsavel: string | null;
}

const mesmoNome = (a: string, b: string) => normalizar(a.trim()) === normalizar(b.trim());

/** O usuário pode alterar o cliente que tem este responsável? Sem ligação ou sem responsável, só o admin. */
export function podeAlterarCliente(usuario: UsuarioParaPermissao, responsavel: string | null): boolean {
  if (usuario.admin) return true;
  if (!usuario.nomeResponsavel || !responsavel?.trim()) return false;
  return mesmoNome(usuario.nomeResponsavel, responsavel);
}

/** O usuário pode assumir o cliente? Só se ele tem ligação e o cliente ainda não tem responsável. */
export function podeAssumirCliente(usuario: UsuarioParaPermissao, responsavel: string | null): boolean {
  return !usuario.admin && !!usuario.nomeResponsavel && !responsavel?.trim();
}

/**
 * O usuário pode agendar o cliente? Qualquer um agenda cliente que já tem responsável. Sem
 * responsável, o agendamento exige um, então só quem pode assumir (o admin escolhe o dele).
 */
export function podeAgendarCliente(usuario: UsuarioParaPermissao, responsavel: string | null): boolean {
  return usuario.admin || !!responsavel?.trim() || !!usuario.nomeResponsavel;
}

/**
 * Coloca o usuário como responsável do cliente, se ele ainda não tem ninguém. A condição vai na
 * própria gravação: se outra pessoa assumiu no meio tempo, nada é sobrescrito. Devolve se gravou.
 */
export async function assumirCliente(usuario: UsuarioParaPermissao, id: number): Promise<boolean> {
  if (usuario.admin || !usuario.nomeResponsavel) return false;
  const { count } = await prisma.preSafra.updateMany({
    where: { id, inativo: false, OR: [{ responsavel: null }, { responsavel: "" }] },
    data: { responsavel: usuario.nomeResponsavel },
  });
  return count > 0;
}

/** Dos ids pedidos, só os que o usuário pode alterar (o servidor ignora os demais, como já faz com ids inválidos). */
export async function idsPermitidos(usuario: UsuarioParaPermissao, ids: number[]): Promise<number[]> {
  if (usuario.admin) return ids;
  if (!usuario.nomeResponsavel || ids.length === 0) return [];
  const registros = await prisma.preSafra.findMany({
    where: { id: { in: ids } },
    select: { id: true, responsavel: true },
  });
  return registros.filter((r) => podeAlterarCliente(usuario, r.responsavel)).map((r) => r.id);
}
