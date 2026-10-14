import { bateFiltroResponsavel } from "@/lib/equipe";
import { chaveDe, pessoasDaDupla, type ClientePainel } from "@/lib/painel";
import { normalizar, semRepetir } from "@/lib/texto";

export const SEM_REGIAO = "Sem região";
export const SEM_RESPONSAVEL = "Sem responsável";

export interface Filtros {
  regiao: string;
  responsavel: string;
  formato: string;
}

export const SEM_FILTROS: Filtros = { regiao: "", responsavel: "", formato: "" };

/**
 * Cliente no filtro de responsável do Painel. "Sem responsável" pega só quem não tem ninguém;
 * uma pessoa pega os clientes dela e, enquanto o cliente não tem responsável, os da região em que
 * ela é atendente (a mesma regra da lista de Clientes, ver bateFiltroResponsavel).
 */
function bateResponsavel(c: ClientePainel, escolhido: string): boolean {
  if (escolhido === SEM_RESPONSAVEL) return !c.responsavel?.trim();
  return bateFiltroResponsavel(c, [escolhido]);
}

/** Aplica os filtros; `ignorar` deixa de fora um deles (o gráfico agrupa pela própria dimensão). */
export function aplicarFiltros(
  clientes: ClientePainel[],
  f: Filtros,
  ignorar?: keyof Filtros,
): ClientePainel[] {
  return clientes.filter(
    (c) =>
      (ignorar === "regiao" || !f.regiao || (c.regiao ?? SEM_REGIAO) === f.regiao) &&
      (ignorar === "responsavel" || !f.responsavel || bateResponsavel(c, f.responsavel)) &&
      (ignorar === "formato" || !f.formato || chaveDe(c, "formato") === f.formato),
  );
}

export interface GrupoPessoas {
  nome: string;
  pessoas: string[];
}

/**
 * Quem o filtro de responsável oferece: os atendentes de cada região (`regioes`, na ordem em que
 * o Painel as mostra) e, em "outros", quem já é responsável de algum cliente mas não está em
 * nenhuma dupla. Cada pessoa aparece uma vez só.
 */
export function pessoasParaFiltro(
  clientes: ClientePainel[],
  regioes: { curto: string; atendentes: string }[],
): { porRegiao: GrupoPessoas[]; outros: string[] } {
  const listadas = new Set<string>();
  const porRegiao = regioes.map((r) => ({
    nome: r.curto,
    pessoas: pessoasDaDupla(r.atendentes).filter((p) => {
      const chave = normalizar(p);
      if (listadas.has(chave)) return false;
      listadas.add(chave);
      return true;
    }),
  }));
  const outros = semRepetir(
    clientes
      .map((c) => c.responsavel?.trim())
      .filter((r): r is string => !!r && !listadas.has(normalizar(r)))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
  );
  return { porRegiao, outros };
}
