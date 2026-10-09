import { describe, expect, it } from "vitest";
import { nomeMaiusculo } from "./texto";

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
