import { describe, expect, it } from "vitest";
import { rankingPorPessoa } from "./sugestoes";

const s = (id: number, tipo: string, nome: string, whatsapp: string) => ({ id, tipo, nome, whatsapp });

describe("rankingPorPessoa", () => {
  const itens = [
    s(1, "faq", "Ana", "5566111"),
    s(2, "faq", "Bia", "5566222"),
    s(3, "faq", "Bia Souza", "5566222"),
    s(4, "melhoria", "Ana", "5566111"),
    s(5, "melhoria", "Ana", "5566111"),
    s(6, "melhoria", "Caio", "5566333"),
    s(7, "faq", "Caio", "5566333"),
  ];

  it("separa FAQ e melhorias", () => {
    expect(rankingPorPessoa(itens, "faq").map((p) => [p.whatsapp, p.quantas])).toEqual([
      ["5566222", 2],
      ["5566111", 1],
      ["5566333", 1],
    ]);
    expect(rankingPorPessoa(itens, "melhoria").map((p) => [p.whatsapp, p.quantas])).toEqual([
      ["5566111", 2],
      ["5566333", 1],
    ]);
  });

  it("agrupa pelo WhatsApp e usa o nome do envio mais recente", () => {
    expect(rankingPorPessoa(itens, "faq")[0].nome).toBe("Bia Souza");
  });

  it("no empate, quem enviou primeiro fica na frente", () => {
    const empate = [s(5, "faq", "Dani", "2"), s(3, "faq", "Edu", "1")];
    expect(rankingPorPessoa(empate, "faq").map((p) => p.nome)).toEqual(["Edu", "Dani"]);
  });

  it("respeita o limite e devolve vazio sem envios do tipo", () => {
    expect(rankingPorPessoa(itens, "faq", 1)).toHaveLength(1);
    expect(rankingPorPessoa([s(1, "faq", "Ana", "1")], "melhoria")).toEqual([]);
  });
});
