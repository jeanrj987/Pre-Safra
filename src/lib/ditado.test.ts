import { describe, expect, it } from "vitest";
import { juntarDitado } from "./ditado";

describe("juntarDitado", () => {
  it("começa o campo vazio com letra maiúscula", () => {
    expect(juntarDitado("", "preciso emitir nota fiscal")).toBe("Preciso emitir nota fiscal");
    expect(juntarDitado("   ", "olá")).toBe("Olá");
  });

  it("continua a frase em andamento sem maiúscula", () => {
    expect(juntarDitado("Preciso emitir", "nota fiscal")).toBe("Preciso emitir nota fiscal");
  });

  it("começa frase nova com maiúscula depois de ponto final", () => {
    expect(juntarDitado("Tenho uma dúvida.", "como emito a nota")).toBe("Tenho uma dúvida. Como emito a nota");
  });

  it("não duplica o espaço quando o texto já termina com espaço", () => {
    expect(juntarDitado("Tenho uma dúvida ", "sobre estoque")).toBe("Tenho uma dúvida sobre estoque");
  });

  it("mantém o texto quando nada foi falado", () => {
    expect(juntarDitado("Olá", "  ")).toBe("Olá");
  });

  it("acentua a primeira letra corretamente", () => {
    expect(juntarDitado("", "érica pediu")).toBe("Érica pediu");
  });
});
