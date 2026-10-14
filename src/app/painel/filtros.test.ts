import { describe, expect, it } from "vitest";
import { SEM_FILTROS, SEM_REGIAO, SEM_RESPONSAVEL, aplicarFiltros, pessoasParaFiltro } from "./filtros";
import { listarRegioes, type ClientePainel } from "@/lib/painel";

let seq = 0;
const cliente = (p: Partial<ClientePainel> = {}): ClientePainel => ({
  id: ++seq,
  nome: `Cliente ${seq}`,
  regiao: "Oeste MT a RO/AC",
  atendentes: "Amanda Albano e Cauê",
  responsavel: null,
  formato: null,
  data: null,
  fin: null,
  melhorias: false,
  ...p,
});

const oeste = (p: Partial<ClientePainel> = {}) => cliente(p);
const leste = (p: Partial<ClientePainel> = {}) =>
  cliente({ regiao: "Leste MT a TO/GO/MG", atendentes: "Gabriel e Samuel", ...p });

describe("filtro de responsável do Painel", () => {
  it("sem responsável gravado, a pessoa pega os clientes da região em que é atendente", () => {
    const clientes = [oeste(), oeste(), leste()];
    const r = aplicarFiltros(clientes, { ...SEM_FILTROS, responsavel: "Amanda Albano" });
    expect(r).toEqual([clientes[0], clientes[1]]);
  });

  it("com responsável gravado, vale só ele", () => {
    const meu = oeste({ responsavel: "Jean" });
    const doOutro = oeste({ responsavel: "Cauê" });
    expect(aplicarFiltros([meu, doOutro], { ...SEM_FILTROS, responsavel: "Jean" })).toEqual([meu]);
    // Amanda é da dupla da região, mas esses clientes já têm dono.
    expect(aplicarFiltros([meu, doOutro], { ...SEM_FILTROS, responsavel: "Amanda Albano" })).toEqual([]);
  });

  it('"Sem responsável" pega só quem não tem responsável', () => {
    const sem = oeste();
    const semEmBranco = oeste({ responsavel: "  " });
    const com = oeste({ responsavel: "Jean" });
    expect(aplicarFiltros([sem, semEmBranco, com], { ...SEM_FILTROS, responsavel: SEM_RESPONSAVEL })).toEqual([
      sem,
      semEmBranco,
    ]);
  });

  it("ignora caixa e acento", () => {
    const c = oeste({ responsavel: "Cauê" });
    expect(aplicarFiltros([c], { ...SEM_FILTROS, responsavel: "caue" })).toEqual([c]);
  });

  it("combina com região e formato", () => {
    const a = oeste({ formato: "Online" });
    const b = oeste({ formato: "Presencial" });
    const c = leste({ formato: "Online" });
    const f = { regiao: "Oeste MT a RO/AC", responsavel: "Cauê", formato: "Online" };
    expect(aplicarFiltros([a, b, c], f)).toEqual([a]);
  });

  it("cliente sem região entra em 'Sem região'", () => {
    const c = cliente({ regiao: null, atendentes: null });
    expect(aplicarFiltros([c, oeste()], { ...SEM_FILTROS, regiao: SEM_REGIAO })).toEqual([c]);
  });
});

describe("opções do filtro de responsável do Painel", () => {
  // O erro que não pode voltar: o filtro oferecer uma pessoa e, ao escolhê-la, não vir nenhum
  // cliente, mesmo havendo cliente dela (como responsável ou como atendente da região).
  const cenarios: Record<string, ClientePainel[]> = {
    "safra nova, ninguém é responsável ainda": [oeste(), oeste(), leste(), leste()],
    "todos agendados com responsável": [
      oeste({ responsavel: "Jean" }),
      oeste({ responsavel: "Amanda Albano" }),
      oeste({ responsavel: "Cauê" }),
      leste({ responsavel: "Gabriel" }),
      leste({ responsavel: "Samuel" }),
      leste({ responsavel: "Fulano de Fora" }),
    ],
    "mistura": [oeste(), oeste({ responsavel: "Cauê" }), leste({ responsavel: "Beltrano" }), leste()],
    "cliente sem região": [cliente({ regiao: null, atendentes: null, responsavel: "Jean" }), oeste()],
  };

  for (const [nome, clientes] of Object.entries(cenarios)) {
    it(`toda pessoa oferecida devolve clientes — ${nome}`, () => {
      const { porRegiao, outros } = pessoasParaFiltro(clientes, listarRegioes(clientes));
      const oferecidas = [...porRegiao.flatMap((g) => g.pessoas), ...outros];
      expect(oferecidas.length).toBeGreaterThan(0);
      for (const pessoa of oferecidas) {
        const achados = aplicarFiltros(clientes, { ...SEM_FILTROS, responsavel: pessoa });
        expect(achados.length, `"${pessoa}" não devolveu nenhum cliente`).toBeGreaterThan(0);
      }
    });
  }

  it("não oferece a mesma pessoa duas vezes, nem com grafia diferente", () => {
    const clientes = [
      oeste({ responsavel: "amanda albano" }),
      oeste({ responsavel: "Jean" }),
      oeste({ responsavel: " Jean " }),
      leste({ atendentes: "Cauê e Samuel" }),
    ];
    const { porRegiao, outros } = pessoasParaFiltro(clientes, listarRegioes(clientes));
    const todas = [...porRegiao.flatMap((g) => g.pessoas), ...outros];
    expect(todas.filter((p) => p.toLowerCase().includes("amanda"))).toHaveLength(1);
    expect(todas.filter((p) => p.trim() === "Jean")).toHaveLength(1);
    expect(todas.filter((p) => p.toLowerCase().includes("cauê"))).toHaveLength(1);
  });

  it("quem é responsável mas não está em nenhuma dupla vai para 'outros'", () => {
    const clientes = [oeste({ responsavel: "Fulano de Fora" })];
    const { outros } = pessoasParaFiltro(clientes, listarRegioes(clientes));
    expect(outros).toEqual(["Fulano de Fora"]);
  });
});
