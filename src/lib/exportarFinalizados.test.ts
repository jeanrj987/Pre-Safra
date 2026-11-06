import { describe, expect, it } from "vitest";
import { ITENS_FINALIZACAO } from "./finalizacao";
import { montarLinhasFinalizados, slugDaSafra, type RegistroFinalizacao } from "./exportarFinalizados";

function registro(nome: string, extra: Partial<RegistroFinalizacao> = {}): RegistroFinalizacao {
  return {
    clienteNomeManual: null,
    responsavel: "Maria",
    formato: "Online",
    dataPrevista: new Date("2026-03-10T00:00:00Z"),
    configuradoSistema: true,
    inativo: false,
    melhoriasApresentadas: false,
    sistemaAtualizado: false,
    safraFechada: false,
    safraNovaConfigurada: false,
    cliente: { nome, cidade: "Sorriso", uf: "MT", regiao: "Norte", consultor: "João" },
    conclusoes: [
      { observacao: " Tudo certo ", autor: "Jean", criadoEm: new Date("2026-03-12T15:00:00Z"), reabertoEm: null },
    ],
    ...extra,
  };
}

describe("montarLinhasFinalizados", () => {
  it("só inclui os Finalizados (configurados e não inativos)", () => {
    const linhas = montarLinhasFinalizados([
      registro("Fazenda A"),
      registro("Fazenda B", { configuradoSistema: false }),
      registro("Fazenda C", { configuradoSistema: false, formato: "Presencial" }),
    ]);
    expect(linhas.map((l) => l.cliente)).toEqual(["Fazenda A"]);
  });

  it("deixa de fora o inativo, mesmo configurado no sistema", () => {
    const linhas = montarLinhasFinalizados([registro("Fazenda A", { inativo: true }), registro("Fazenda B")]);
    expect(linhas.map((l) => l.cliente)).toEqual(["Fazenda B"]);
  });

  it("ordena por nome do cliente em pt-BR, ignorando acento na comparação", () => {
    const linhas = montarLinhasFinalizados([
      registro("Zé Agro"),
      registro("Árvore Verde"),
      registro("Boa Safra"),
    ]);
    expect(linhas.map((l) => l.cliente)).toEqual(["Árvore Verde", "Boa Safra", "Zé Agro"]);
  });

  it("converte os itens de conferência em Sim/Não na ordem de ITENS_FINALIZACAO", () => {
    const [linha] = montarLinhasFinalizados([
      registro("Fazenda A", { melhoriasApresentadas: true, safraFechada: true }),
    ]);
    expect(linha.itens).toHaveLength(ITENS_FINALIZACAO.length);
    expect(linha.itens).toEqual(["Sim", "Não", "Sim", "Não"]);
  });

  it("usa a conclusão em vigor mais recente (ignora reabertas) e calcula o atraso", () => {
    const [linha] = montarLinhasFinalizados([
      registro("Fazenda A", {
        conclusoes: [
          { observacao: "antiga", autor: "Ana", criadoEm: new Date("2026-03-20T15:00:00Z"), reabertoEm: new Date("2026-03-21T15:00:00Z") },
          { observacao: "  vigente ", autor: "Jean", criadoEm: new Date("2026-03-15T15:00:00Z"), reabertoEm: null },
          { observacao: "mais velha", autor: "Rui", criadoEm: new Date("2026-03-11T15:00:00Z"), reabertoEm: null },
        ],
      }),
    ]);
    expect(linha.finalizadoPor).toBe("Jean");
    expect(linha.observacao).toBe("vigente");
    expect(linha.atrasoDias).toBe(5);
  });

  it("não tem atraso quando finalizou no prazo e aceita cliente sem cadastro", () => {
    const [linha] = montarLinhasFinalizados([
      registro("x", {
        cliente: null,
        clienteNomeManual: "Cliente Avulso",
        conclusoes: [{ observacao: null, autor: null, criadoEm: new Date("2026-03-09T15:00:00Z"), reabertoEm: null }],
      }),
    ]);
    expect(linha.cliente).toBe("Cliente Avulso");
    expect(linha.cidade).toBeNull();
    expect(linha.atrasoDias).toBeNull();
    expect(linha.observacao).toBeNull();
  });

  it("devolve lista vazia quando não há finalizados", () => {
    expect(montarLinhasFinalizados([])).toEqual([]);
    expect(montarLinhasFinalizados([registro("A", { configuradoSistema: false })])).toEqual([]);
  });
});

describe("slugDaSafra", () => {
  it("tira acento, espaço e barra", () => {
    expect(slugDaSafra("Safra 2025/26")).toBe("safra-2025-26");
    expect(slugDaSafra("  Soja Açaí – Verão ")).toBe("soja-acai-verao");
  });

  it("não devolve vazio", () => {
    expect(slugDaSafra("///")).toBe("safra");
  });
});
