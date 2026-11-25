import { describe, expect, it } from "vitest";
import { diaParaArquivo, estiloImpressao, nomeArquivoRelatorio, textoCss } from "./impressaoRelatorio";

// 25/11/2026 às 22h em Cuiabá (UTC-4) já é dia 26 em UTC.
const agora = new Date("2026-11-26T02:00:00Z");
const base = { rotulo: "Situação da safra", safra: "Safra 26/27", regioes: [], responsaveis: [], agora };

describe("diaParaArquivo", () => {
  it("usa o dia no fuso da equipe, com hífens", () => {
    expect(diaParaArquivo(agora)).toBe("25-11-2026");
  });
});

describe("nomeArquivoRelatorio", () => {
  it("sem filtros: rótulo, safra (com hífen no lugar da barra) e data", () => {
    expect(nomeArquivoRelatorio(base)).toBe("Situação da safra - Safra 26-27 - 25-11-2026");
  });

  it("com uma ou duas regiões, mostra os nomes", () => {
    expect(nomeArquivoRelatorio({ ...base, regioes: ["Sorriso e Região"] })).toBe(
      "Situação da safra - Safra 26-27 - Sorriso e Região - 25-11-2026",
    );
    expect(nomeArquivoRelatorio({ ...base, regioes: ["Norte", "Sul"] })).toBe(
      "Situação da safra - Safra 26-27 - Norte e Sul - 25-11-2026",
    );
  });

  it("com três ou mais, mostra só a quantidade; o responsável segue a mesma regra", () => {
    expect(
      nomeArquivoRelatorio({
        ...base,
        rotulo: "Por pessoa",
        regioes: ["A", "B", "C"],
        responsaveis: ["Ana"],
      }),
    ).toBe("Por pessoa - Safra 26-27 - 3 regiões - Ana - 25-11-2026");
    expect(nomeArquivoRelatorio({ ...base, responsaveis: ["Ana", "Bia", "Caio", "Davi"] })).toBe(
      "Situação da safra - Safra 26-27 - 4 responsáveis - 25-11-2026",
    );
  });

  it("inclui o filtro de status pela mesma regra", () => {
    expect(nomeArquivoRelatorio({ ...base, status: ["A Fazer", "Atrasado"] })).toBe(
      "Situação da safra - Safra 26-27 - A Fazer e Atrasado - 25-11-2026",
    );
    expect(
      nomeArquivoRelatorio({
        ...base,
        regioes: ["Sorriso e Região"],
        status: ["A Fazer", "Finalizado", "Agendado Online", "Agendado Presencial"],
      }),
    ).toBe("Situação da safra - Safra 26-27 - Sorriso e Região - 4 status - 25-11-2026");
    expect(nomeArquivoRelatorio({ ...base, status: [] })).toBe("Situação da safra - Safra 26-27 - 25-11-2026");
  });

  it("tira os caracteres inválidos em nome de arquivo", () => {
    expect(
      nomeArquivoRelatorio({ ...base, safra: 'Soja: 26/27 "nova"', regioes: ["Norte/Sul*", "Leste?<>|\\"] }),
    ).toBe("Situação da safra - Soja 26-27 nova - NorteSul e Leste - 25-11-2026");
  });
});

describe("textoCss", () => {
  it("põe entre aspas e escapa barra invertida, aspas e quebras de linha", () => {
    expect(textoCss('Safra "26\\27"\nnova')).toBe('"Safra \\"26\\\\27\\" nova"');
  });

  it("não deixa o texto fechar a tag <style>", () => {
    expect(textoCss("</style>")).not.toContain("<");
    expect(textoCss("</style>")).toBe('"\\3C /style\\3E "');
  });
});

describe("estiloImpressao", () => {
  it("mantém A4 deitado e 12 mm, com o rodapé próprio", () => {
    const css = estiloImpressao("Situação da safra · Safra 26/27");
    expect(css).toContain("size: A4 landscape");
    expect(css).toContain("margin: 12mm");
    expect(css).toContain('@bottom-left { content: "Situação da safra · Safra 26/27";');
    expect(css).toContain('content: "Página " counter(page) " de " counter(pages)');
  });
});
