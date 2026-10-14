import { describe, expect, it } from "vitest";
import { contemNome, nomeMaiusculo, semRepetir } from "./texto";

describe("nomeMaiusculo", () => {
  it("passa para maiúsculas, mantendo os acentos", () => {
    expect(nomeMaiusculo("Agrícola Grão de Ouro")).toBe("AGRÍCOLA GRÃO DE OURO");
  });

  it("tira espaços das pontas e repetidos no meio", () => {
    expect(nomeMaiusculo("  fazenda   são  joão ")).toBe("FAZENDA SÃO JOÃO");
  });

  it("devolve vazio para texto em branco", () => {
    expect(nomeMaiusculo("   ")).toBe("");
  });
});

describe("semRepetir", () => {
  it("tira repetidos que diferem só em caixa, acento e espaços, mantendo a primeira grafia", () => {
    expect(semRepetir(["José", "jose", " JOSÉ ", "Maria"])).toEqual(["José", "Maria"]);
  });

  it("descarta nomes vazios", () => {
    expect(semRepetir(["", "  ", "Ana"])).toEqual(["Ana"]);
  });
});

describe("contemNome", () => {
  it("acha o nome ignorando caixa, acento e espaços nas pontas", () => {
    expect(contemNome(["Amanda Albano", "Cauê"], " caue ")).toBe(true);
  });

  it("não acha nome que não está na lista", () => {
    expect(contemNome(["Amanda Albano"], "Amanda")).toBe(false);
  });
});
