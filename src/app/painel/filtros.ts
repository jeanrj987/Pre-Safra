import { chaveDe, type ClientePainel } from "@/lib/painel";

export const SEM_REGIAO = "Sem região";

export interface Filtros {
  regiao: string;
  responsavel: string;
  formato: string;
}

export const SEM_FILTROS: Filtros = { regiao: "", responsavel: "", formato: "" };

/** Aplica os filtros; `ignorar` deixa de fora um deles (o gráfico agrupa pela própria dimensão). */
export function aplicarFiltros(
  clientes: ClientePainel[],
  f: Filtros,
  ignorar?: keyof Filtros,
): ClientePainel[] {
  return clientes.filter(
    (c) =>
      (ignorar === "regiao" || !f.regiao || (c.regiao ?? SEM_REGIAO) === f.regiao) &&
      (ignorar === "responsavel" || !f.responsavel || chaveDe(c, "responsavel") === f.responsavel) &&
      (ignorar === "formato" || !f.formato || chaveDe(c, "formato") === f.formato),
  );
}
