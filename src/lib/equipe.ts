import { nomeCurtoRegiao, pessoasDaDupla } from "./painel";
import { normalizar } from "./texto";

// Quem atende cada região, para montar a lista de responsável: os atendentes (dupla), o
// consultor e o comercial. A lista mostra primeiro a equipe da região do cliente ("Da região")
// e depois cada uma das outras regiões, com as pessoas dela.

// Comercial de cada região, conforme a coluna "Comercial" da planilha "Consultor vs Clientes":
// uma pessoa por região. A chave é o nome curto da região (sem o número e sem o "a PA/RR").
// Se uma região nova aparecer, é só acrescentar aqui.
export const COMERCIAL_POR_REGIAO: Record<string, string> = {
  "Sorriso e Região": "Sidinei",
  "Norte MT": "Sidinei",
  "Leste MT": "Gilberto",
  "Oeste MT": "Pablo",
};

export interface EquipeCliente {
  atendentes: string | null;
  consultor: string | null;
  regiao: string | null;
  /** Comercial cadastrado no cliente; sem ele, vale o comercial da região. */
  comercial?: string | null;
}

/** Uma pessoa e o que ela é na região: "Atendente", "Consultor", "Comercial" (ou combinados). */
export interface PessoaEquipe {
  nome: string;
  papel: string;
}

/** Título do grupo com a equipe da região do próprio cliente (os indicados). */
export const TITULO_DA_REGIAO = "Da região";

export interface GrupoEquipe {
  titulo: string;
  pessoas: PessoaEquipe[];
}

type Papel = "Atendente" | "Consultor" | "Comercial";
const ORDEM_PAPEIS: Papel[] = ["Atendente", "Consultor", "Comercial"];

export function comercialDaRegiao(regiao: string | null): string | null {
  return regiao ? (COMERCIAL_POR_REGIAO[nomeCurtoRegiao(regiao).curto] ?? null) : null;
}

/** Atendentes, consultor e comercial do cliente, sem repetir; quem tem dois papéis aparece uma vez. */
export function equipeDoCliente(c: EquipeCliente): PessoaEquipe[] {
  const pares: [string | null | undefined, Papel][] = [
    ...pessoasDaDupla(c.atendentes).map((p): [string, Papel] => [p, "Atendente"]),
    [c.consultor, "Consultor"],
    [c.comercial?.trim() || comercialDaRegiao(c.regiao), "Comercial"],
  ];
  const papeis = new Map<string, Set<Papel>>();
  for (const [bruto, papel] of pares) {
    const nome = bruto?.trim();
    if (!nome) continue;
    papeis.set(nome, (papeis.get(nome) ?? new Set()).add(papel));
  }
  return [...papeis].map(([nome, set]) => ({
    nome,
    papel: ORDEM_PAPEIS.filter((p) => set.has(p)).join(" · "),
  }));
}

/**
 * Regiões em que a pessoa é atendente, isto é, em que o nome dela está na dupla. Quem não tem
 * nome ligado, ou não aparece em nenhuma dupla (admin, consultor, comercial), não tem região.
 */
export function regioesDoAtendente(nome: string | null, clientes: Pick<EquipeCliente, "atendentes" | "regiao">[]): Set<string> {
  const regioes = new Set<string>();
  if (!nome?.trim()) return regioes;
  for (const c of clientes) {
    if (c.regiao && pessoasDaDupla(c.atendentes).some((p) => normalizar(p) === normalizar(nome.trim()))) {
      regioes.add(c.regiao);
    }
  }
  return regioes;
}

/**
 * A equipe de cada região que aparece nos clientes, da maior para a menor. O consultor e o
 * comercial são os que mais se repetem entre os clientes da região (na planilha é um só por região).
 */
export function equipesPorRegiao(clientes: EquipeCliente[]): GrupoEquipe[] {
  const maisComum = (contagem: Map<string, number>) =>
    [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0]?.[0] ?? null;
  const regioes = new Map<
    string,
    { total: number; atendentes: string | null; consultores: Map<string, number>; comerciais: Map<string, number> }
  >();
  for (const c of clientes) {
    if (!c.regiao) continue;
    const r = regioes.get(c.regiao) ?? {
      total: 0,
      atendentes: c.atendentes,
      consultores: new Map(),
      comerciais: new Map(),
    };
    r.total++;
    r.atendentes ??= c.atendentes;
    const consultor = c.consultor?.trim();
    if (consultor) r.consultores.set(consultor, (r.consultores.get(consultor) ?? 0) + 1);
    const comercial = c.comercial?.trim();
    if (comercial) r.comerciais.set(comercial, (r.comerciais.get(comercial) ?? 0) + 1);
    regioes.set(c.regiao, r);
  }
  return [...regioes]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "pt-BR"))
    .map(([regiao, r]) => ({
      titulo: regiao,
      pessoas: equipeDoCliente({
        atendentes: r.atendentes,
        consultor: maisComum(r.consultores),
        comercial: maisComum(r.comerciais),
        regiao,
      }),
    }));
}

/**
 * Grupos da lista de responsável de um cliente: "Da região" (a equipe da região dele) e, depois,
 * cada uma das outras regiões com a equipe completa dela. Quem atende mais de uma região (como o
 * consultor André, de Leste e Oeste) aparece em cada uma, inclusive em "Da região".
 */
export function gruposDeResponsavel(cliente: EquipeCliente, regioes: GrupoEquipe[]): GrupoEquipe[] {
  const daRegiao = equipeDoCliente(cliente);
  const outras = regioes.filter((g) => g.titulo !== cliente.regiao && g.pessoas.length > 0);
  return [...(daRegiao.length ? [{ titulo: TITULO_DA_REGIAO, pessoas: daRegiao }] : []), ...outras];
}
