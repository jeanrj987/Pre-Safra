// Todos os usuários veem todos os clientes. O que cada um faz:
// - agendar ou reagendar: qualquer cliente (ver podeAgendarCliente). Quem agenda escolhe como responsável um dos
//   dois atendentes da dupla da região do cliente (um pode agendar para o outro), o admin da região do cliente
//   ou ele mesmo (ver opcoesDeResponsavelAoAgendar e responsavelEscolhidoAoAgendar). Cliente sem dupla
//   cadastrada nem admin da região: quem agenda passa a ser o responsável (ver responsavelAoAgendar), mesmo que
//   o cliente fosse de outra pessoa. Agendar para o colega tira de quem agendou o direito de alterar o cliente
//   (próxima regra);
// - assumir um cliente que ainda não tem responsável: usuário com "nomeResponsavel" (podeAssumirCliente);
// - remover o agendamento, finalizar, reabrir e editar o registro: quem tem a permissão "todosClientes" (o admin tem),
//   o usuário cujo "nomeResponsavel" é o responsável do cliente e o admin da região do cliente
//   (podeAlterarCliente), porque isso mexe nos números do Painel e no histórico;
// - escolher ou trocar o responsável: quem tem a permissão "trocarResp" (o admin tem).
//
// Admin da região (Usuario.regioesAdmin, papel "regional"): conta ligada a uma ou mais regiões, no máximo um
// admin por região. Tem poder sobre os clientes das regiões dele (a região é comparada com normalizar, como os
// nomes) e é o responsável padrão deles: ao agendar um cliente sem responsável da região, a janela já traz o
// admin da região marcado (para qualquer usuário), e ele entra nas opções de quem escolhe na dupla. Quem agenda
// ainda pode indicar outro da dupla. O poder dele vale só na própria região; não há acesso à área Admin.
import { prisma } from "./db";
import { pode } from "./permissoes";
import { pessoasDaDupla } from "./painel";
import { normalizar } from "./texto";

export interface UsuarioParaPermissao {
  permissoes: readonly string[];
  nomeResponsavel: string | null;
  /** Nome da conta, gravado como autor da alteração quando existe. */
  nome?: string;
  /** Regiões de que a conta é admin regional (nomes como em Cliente.regiao). */
  regioesAdmin?: readonly string[];
}

const mesmoNome = (a: string, b: string) => normalizar(a.trim()) === normalizar(b.trim());

/** O usuário é admin regional da região deste cliente? Sem região (cliente sem cadastro ou sem região), nunca. */
export function ehAdminDaRegiao(usuario: UsuarioParaPermissao, regiao?: string | null): boolean {
  return !!regiao?.trim() && !!usuario.regioesAdmin?.some((r) => mesmoNome(r, regiao));
}

/**
 * O usuário pode alterar o cliente que tem este responsável e esta região? Quem altera qualquer cliente e o admin
 * da região do cliente podem. Os demais, só se são o responsável (sem ligação ou sem responsável, não).
 */
export function podeAlterarCliente(
  usuario: UsuarioParaPermissao,
  responsavel: string | null,
  regiao?: string | null,
): boolean {
  if (pode(usuario, "todosClientes")) return true;
  if (ehAdminDaRegiao(usuario, regiao)) return true;
  if (!usuario.nomeResponsavel || !responsavel?.trim()) return false;
  return mesmoNome(usuario.nomeResponsavel, responsavel);
}

/**
 * O usuário pode assumir o cliente? Só se ele tem ligação e o cliente ainda não tem responsável.
 * Quem escolhe o responsável (permissão "trocarResp") define o nome em vez de assumir. O admin da região
 * (que tem ligação, com o nome dele) cai na mesma regra, como qualquer usuário com ligação: a região não entra
 * aqui; ela vale para alterar e agendar (podeAlterarCliente) e para o responsável padrão.
 */
export function podeAssumirCliente(usuario: UsuarioParaPermissao, responsavel: string | null): boolean {
  return !pode(usuario, "trocarResp") && !!usuario.nomeResponsavel && !responsavel?.trim();
}

/**
 * O usuário pode agendar o cliente? Qualquer um agenda cliente que já tem responsável. Sem
 * responsável, o agendamento exige um, então só quem pode assumir (quem escolhe o responsável define o nome)
 * e o admin da região do cliente (que escolhe na dupla ou assume).
 */
export function podeAgendarCliente(
  usuario: UsuarioParaPermissao,
  responsavel: string | null,
  regiao?: string | null,
): boolean {
  return (
    pode(usuario, "trocarResp") || !!responsavel?.trim() || !!usuario.nomeResponsavel || ehAdminDaRegiao(usuario, regiao)
  );
}

/**
 * Quem fica como responsável depois de o usuário agendar ou reagendar o cliente quando não há escolha
 * na janela (cliente sem dupla, ou nada informado; ver responsavelEscolhidoAoAgendar). Quem escolhe o
 * responsável (permissão "trocarResp") define o nome na janela, então aqui devolve null. Os demais assumem
 * o cliente ao agendar, mesmo que ele fosse de outra pessoa; sem nome ligado à conta, o responsável atual continua.
 */
export function responsavelAoAgendar(usuario: UsuarioParaPermissao, atual: string | null): string | null {
  if (pode(usuario, "trocarResp")) return null;
  return usuario.nomeResponsavel?.trim() || atual?.trim() || null;
}

/** Agendar vai trocar o responsável do cliente por este usuário? Usado pela janela para avisar antes de salvar. */
export function assumeAoAgendar(usuario: UsuarioParaPermissao, atual: string | null): boolean {
  const novo = responsavelAoAgendar(usuario, atual);
  return !!novo && !(atual?.trim() && mesmoNome(novo, atual));
}

/** O que a janela de agendar precisa saber do cliente para listar quem pode ser o responsável. */
export interface ClienteParaAgendar {
  /** Dupla de atendentes da região do cliente (ex.: "Maria e Jean"). */
  atendentes: string | null;
  /** Responsável do cliente antes de agendar. */
  responsavel: string | null;
  /** Nome (nomeResponsavel) do admin da região do cliente, o responsável padrão; null se a região não tem um. */
  adminRegional?: string | null;
}

/** Responsável padrão de um cliente sem responsável: o admin da região dele ("" se não há um ou se o cliente já tem responsável). */
export function responsavelPadraoDaRegiao(cliente: ClienteParaAgendar): string {
  return cliente.responsavel?.trim() ? "" : (cliente.adminRegional?.trim() ?? "");
}

const acharNome = (lista: readonly string[], nome: string | null | undefined) =>
  nome?.trim() ? lista.find((n) => mesmoNome(n, nome)) : undefined;

/**
 * Quem o usuário comum pode escolher como responsável ao agendar: os atendentes da dupla da região
 * do cliente (um agenda para o outro), o admin da região (se há um e não está na dupla) e, se o usuário não
 * está na lista, ele mesmo (assume, como antes).
 * Sem nome ligado à conta, o responsável atual também fica na lista, para não perdê-lo ao reagendar.
 * Devolve [] quando não há escolha: quem tem "trocarResp" (que usa a lista completa por região) e
 * cliente sem dupla cadastrada e sem admin da região (aí vale o comportamento de responsavelAoAgendar).
 */
export function opcoesDeResponsavelAoAgendar(usuario: UsuarioParaPermissao, cliente: ClienteParaAgendar): string[] {
  if (pode(usuario, "trocarResp")) return [];
  const opcoes = pessoasDaDupla(cliente.atendentes);
  const admin = cliente.adminRegional?.trim();
  if (admin && !acharNome(opcoes, admin)) opcoes.push(admin);
  if (opcoes.length === 0) return [];
  const extras = usuario.nomeResponsavel?.trim() ? [usuario.nomeResponsavel] : [cliente.responsavel];
  for (const extra of extras) {
    if (extra?.trim() && !acharNome(opcoes, extra)) opcoes.push(extra.trim());
  }
  return opcoes;
}

/**
 * Responsável que a janela já traz marcado: o responsável atual do cliente, se está na lista (grafia da
 * lista), para reagendar não tirar o cliente de quem já cuida dele; senão, cliente sem responsável de uma
 * região com admin regional: o admin da região (o responsável padrão, para qualquer usuário); senão o próprio
 * usuário, se está na dupla; senão vazio (a pessoa precisa escolher). "" também quando não há escolha.
 */
export function responsavelInicialAoAgendar(usuario: UsuarioParaPermissao, cliente: ClienteParaAgendar): string {
  const opcoes = opcoesDeResponsavelAoAgendar(usuario, cliente);
  const atual = acharNome(opcoes, cliente.responsavel);
  if (atual) return atual;
  const padrao = acharNome(opcoes, responsavelPadraoDaRegiao(cliente));
  if (padrao) return padrao;
  const dupla = pessoasDaDupla(cliente.atendentes);
  const doUsuario = acharNome(dupla, usuario.nomeResponsavel);
  return (doUsuario && acharNome(opcoes, doUsuario)) || "";
}

/**
 * Responsável a gravar ao agendar, a partir do que veio no formulário (o servidor não confia na tela).
 * - Quem tem "trocarResp": o nome escolhido, como sempre (null se vazio).
 * - Os demais: só vale um nome da lista de opcoesDeResponsavelAoAgendar (dupla e admin da região) ou o próprio
 *   nome ligado à conta.
 *   Campo vazio (cliente sem dupla, janela que não mostrou a escolha): quem agenda assume, como em
 *   responsavelAoAgendar. Nome preenchido que não está na lista: null, e nada é gravado.
 */
export function responsavelEscolhidoAoAgendar(
  usuario: UsuarioParaPermissao,
  cliente: ClienteParaAgendar,
  escolhido: string | null,
): string | null {
  const nome = escolhido?.trim() ?? "";
  if (pode(usuario, "trocarResp")) return nome || null;
  if (!nome) return responsavelAoAgendar(usuario, cliente.responsavel);
  const valido = acharNome([...opcoesDeResponsavelAoAgendar(usuario, cliente), usuario.nomeResponsavel ?? ""], nome);
  return valido?.trim() || null;
}

/**
 * Coloca o usuário como responsável do cliente, se ele ainda não tem ninguém. A condição vai na
 * própria gravação: se outra pessoa assumiu no meio tempo, nada é sobrescrito. Devolve se gravou.
 */
export async function assumirCliente(usuario: UsuarioParaPermissao, id: number): Promise<boolean> {
  if (pode(usuario, "trocarResp") || !usuario.nomeResponsavel) return false;
  const { count } = await prisma.preSafra.updateMany({
    where: { id, inativo: false, OR: [{ responsavel: null }, { responsavel: "" }] },
    data: { responsavel: usuario.nomeResponsavel, ...(usuario.nome ? { atualizadoPor: usuario.nome } : {}) },
  });
  return count > 0;
}

/** Dos ids pedidos, só os que o usuário pode alterar (o servidor ignora os demais, como já faz com ids inválidos). */
export async function idsPermitidos(usuario: UsuarioParaPermissao, ids: number[]): Promise<number[]> {
  if (pode(usuario, "todosClientes")) return ids;
  if ((!usuario.nomeResponsavel && !usuario.regioesAdmin?.length) || ids.length === 0) return [];
  const registros = await prisma.preSafra.findMany({
    where: { id: { in: ids } },
    select: { id: true, responsavel: true, cliente: { select: { regiao: true } } },
  });
  return registros.filter((r) => podeAlterarCliente(usuario, r.responsavel, r.cliente?.regiao)).map((r) => r.id);
}
