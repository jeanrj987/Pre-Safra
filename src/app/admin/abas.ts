import { pode } from "@/lib/permissoes";

// Abas da Administração e a permissão de cada uma. "Usuários" é só do administrador total.
const ABAS = [
  { href: "/admin/clientes", rotulo: "Clientes", libera: (u: Quem) => pode(u, "clientes") },
  { href: "/admin/safras", rotulo: "Safras", libera: (u: Quem) => pode(u, "safras") },
  { href: "/admin/usuarios", rotulo: "Usuários", libera: (u: Quem) => u.admin },
  { href: "/admin/sugestoes", rotulo: "Sugestões", libera: (u: Quem) => pode(u, "sugestoes") },
];

type Quem = { admin: boolean; permissoes: readonly string[] };

/** As abas que esta pessoa pode abrir, na ordem em que aparecem. */
export function abasDoUsuario(usuario: Quem): { href: string; rotulo: string }[] {
  return ABAS.filter((a) => a.libera(usuario)).map(({ href, rotulo }) => ({ href, rotulo }));
}

/** Para onde /admin leva: Safras (como sempre foi) se puder, senão a primeira aba liberada. */
export function abaInicial(usuario: Quem): string | null {
  const abas = abasDoUsuario(usuario);
  return (abas.find((a) => a.href === "/admin/safras") ?? abas[0])?.href ?? null;
}
