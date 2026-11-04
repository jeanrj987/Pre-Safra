import { describe, expect, it } from "vitest";
import {
  aplicarFiltros,
  lerFiltros,
  opcoesDaColuna,
  paresDosFiltros,
  resumoDoFiltro,
  situacaoDoCliente,
  temFiltroDeColuna,
  valorDaColuna,
  VALOR_VAZIO,
  type ClienteFiltravel,
} from "./filtroClientes";

const cliente = (nome: string, resto: Partial<ClienteFiltravel> = {}): ClienteFiltravel => ({
  nome,
  situacao: "Ativo",
  ...resto,
});

const clientes: ClienteFiltravel[] = [
  cliente("Ana", { cidade: "Sorriso", uf: "MT", regiao: "Sorriso e Região", consultor: "Cauê" }),
  cliente("Bruno", { cidade: "Sinop", uf: "MT", regiao: "Norte MT", consultor: "Caue" }),
  cliente("Carla", { cidade: "Água Boa", uf: "MT", regiao: null, situacao: "Inativo" }),
  cliente("Davi", { cidade: "Rio Verde", uf: "GO", regiao: "  ", consultor: "Zé", situacao: "Fora desta safra" }),
  cliente("Elisa", { cidade: "sorriso", uf: "MT", regiao: "Sorriso e Região" }),
];

describe("lerFiltros", () => {
  it("lê um parâmetro repetido por coluna", () => {
    expect(lerFiltros({ regiao: ["Norte MT", "Sorriso e Região"], uf: "MT" })).toEqual({
      regiao: ["Norte MT", "Sorriso e Região"],
      uf: ["MT"],
    });
  });

  it("mantém valores com vírgula e barra inteiros", () => {
    expect(lerFiltros({ cidade: ["Santa Fé, MT/GO"] })).toEqual({ cidade: ["Santa Fé, MT/GO"] });
  });

  it("ignora valores em branco, colunas desconhecidas e repetidos que diferem só em caixa/acento", () => {
    expect(lerFiltros({ uf: ["", "  "], foo: "x", cidade: ["Água Boa", "agua boa"] })).toEqual({
      cidade: ["Água Boa"],
    });
  });

  it("sem parâmetros, não há filtro", () => {
    expect(temFiltroDeColuna(lerFiltros({ q: "ana", pagina: "2" }))).toBe(false);
    expect(temFiltroDeColuna(lerFiltros({ uf: "MT" }))).toBe(true);
  });
});

describe("valorDaColuna", () => {
  it("tira espaços e devolve vazio para nulo", () => {
    expect(valorDaColuna(cliente("X", { regiao: "  " }), "regiao")).toBe("");
    expect(valorDaColuna(cliente("X", { atendente: " Dupla 1 " }), "atendimento")).toBe("Dupla 1");
    expect(valorDaColuna(clientes[0], "situacao")).toBe("Ativo");
  });
});

describe("situacaoDoCliente", () => {
  it("deriva a situação do Pré-Safra na safra", () => {
    expect(situacaoDoCliente(undefined)).toBe("Fora desta safra");
    expect(situacaoDoCliente({ inativo: true })).toBe("Inativo");
    expect(situacaoDoCliente({ inativo: false })).toBe("Ativo");
  });
});

describe("aplicarFiltros", () => {
  it("combina colunas com E e valores da mesma coluna com OU", () => {
    const r = aplicarFiltros(clientes, { uf: ["MT"], regiao: ["Norte MT", "Sorriso e Região"] });
    expect(r.map((c) => c.nome)).toEqual(["Ana", "Bruno", "Elisa"]);
  });

  it("compara ignorando caixa e acento", () => {
    expect(aplicarFiltros(clientes, { cidade: ["SORRISO"] }).map((c) => c.nome)).toEqual(["Ana", "Elisa"]);
    expect(aplicarFiltros(clientes, { cidade: ["agua boa"] }).map((c) => c.nome)).toEqual(["Carla"]);
  });

  it("filtra as células vazias (nulas ou só espaços)", () => {
    expect(aplicarFiltros(clientes, { regiao: [VALOR_VAZIO] }).map((c) => c.nome)).toEqual(["Carla", "Davi"]);
    expect(aplicarFiltros(clientes, { consultor: [VALOR_VAZIO, "Zé"] }).map((c) => c.nome)).toEqual([
      "Carla",
      "Davi",
      "Elisa",
    ]);
  });

  it("filtra pela situação", () => {
    expect(aplicarFiltros(clientes, { situacao: ["Inativo", "Fora desta safra"] }).map((c) => c.nome)).toEqual([
      "Carla",
      "Davi",
    ]);
  });

  it("sem filtros devolve todos, e `ignorar` deixa uma coluna de fora", () => {
    expect(aplicarFiltros(clientes, {})).toBe(clientes);
    const r = aplicarFiltros(clientes, { uf: ["GO"], regiao: ["Norte MT"] }, "uf");
    expect(r.map((c) => c.nome)).toEqual(["Bruno"]);
  });
});

describe("opcoesDaColuna", () => {
  it("lista os distintos em ordem alfabética pt-BR sem considerar acento, com contagem", () => {
    const o = opcoesDaColuna(clientes, {}, "cidade");
    expect(o.map((x) => [x.rotulo, x.quantidade])).toEqual([
      ["Água Boa", 1],
      ["Rio Verde", 1],
      ["Sinop", 1],
      ["Sorriso", 2], // "Sorriso" e "sorriso" viram um valor só
    ]);
  });

  it("põe as vazias por último, com o rótulo da coluna", () => {
    const regioes = opcoesDaColuna(clientes, {}, "regiao");
    expect(regioes.map((x) => x.rotulo)).toEqual(["Norte MT", "Sorriso e Região", "Sem região"]);
    expect(regioes.at(-1)).toMatchObject({ valor: VALOR_VAZIO, quantidade: 2 });
    expect(opcoesDaColuna(clientes, {}, "consultor").at(-1)?.rotulo).toBe("(Vazias)");
  });

  it("ordena sem tratar acento como letra diferente", () => {
    const o = opcoesDaColuna(clientes, {}, "consultor");
    expect(o.map((x) => x.rotulo)).toEqual(["Cauê", "Zé", "(Vazias)"]);
    expect(o[0].quantidade).toBe(2);
  });

  it("considera só os clientes que passam pelos OUTROS filtros", () => {
    const o = opcoesDaColuna(clientes, { uf: ["GO"] }, "cidade");
    expect(o.map((x) => x.rotulo)).toEqual(["Rio Verde"]);
  });

  it("não aplica o filtro da própria coluna (para poder marcar mais valores)", () => {
    const o = opcoesDaColuna(clientes, { uf: ["GO"] }, "uf");
    expect(o.map((x) => [x.rotulo, x.marcada])).toEqual([
      ["GO", true],
      ["MT", false],
    ]);
  });

  it("mantém na lista, com quantidade 0, o valor marcado que sumiu por causa de outro filtro", () => {
    const o = opcoesDaColuna(clientes, { uf: ["GO"], regiao: ["Norte MT"] }, "regiao");
    expect(o.find((x) => x.valor === "Norte MT")).toMatchObject({ quantidade: 0, marcada: true });
  });

  it("lista os três valores de situação", () => {
    expect(opcoesDaColuna(clientes, {}, "situacao").map((x) => x.rotulo)).toEqual([
      "Ativo",
      "Fora desta safra",
      "Inativo",
    ]);
  });
});

describe("paresDosFiltros e resumoDoFiltro", () => {
  it("transforma os filtros em pares nome/valor na ordem das colunas", () => {
    expect(paresDosFiltros({ regiao: ["A", "B"], nome: ["Ana"] })).toEqual([
      ["nome", "Ana"],
      ["regiao", "A"],
      ["regiao", "B"],
    ]);
  });

  it("resume os valores e troca o valor vazio pelo rótulo", () => {
    expect(resumoDoFiltro(["A", VALOR_VAZIO], "regiao")).toBe("A, Sem região");
    expect(resumoDoFiltro(["A", "B", "C", "D"], "cidade")).toBe("A, B e mais 2");
  });
});
