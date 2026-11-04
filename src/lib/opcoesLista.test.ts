import { describe, expect, it } from "vitest";
import {
  NOME_OPCAO_MAXIMO,
  ehTipoOpcao,
  limparNomeOpcao,
  mesclarOpcoes,
  validarNomeOpcao,
} from "./opcoesLista";

describe("tipos de lista", () => {
  it("aceita só os três tipos conhecidos", () => {
    expect(ehTipoOpcao("regiao")).toBe(true);
    expect(ehTipoOpcao("consultor")).toBe(true);
    expect(ehTipoOpcao("responsavel")).toBe(true);
    expect(ehTipoOpcao("cidade")).toBe(false);
    expect(ehTipoOpcao("")).toBe(false);
    expect(ehTipoOpcao(undefined)).toBe(false);
    expect(ehTipoOpcao(3)).toBe(false);
  });
});

describe("limparNomeOpcao", () => {
  it("tira espaços das pontas e junta os repetidos", () => {
    expect(limparNomeOpcao("  Agro   Integra a SP/PR/SC \n")).toBe("Agro Integra a SP/PR/SC");
  });
});

describe("validarNomeOpcao", () => {
  it("devolve o nome limpo quando está certo", () => {
    expect(validarNomeOpcao("regiao", "  Nova  Região a SP ", [])).toEqual({ nome: "Nova Região a SP" });
  });
  it("recusa nome vazio ou só com espaços", () => {
    expect(validarNomeOpcao("consultor", "   ", [])).toEqual({ erro: "Digite o nome do consultor." });
    expect(validarNomeOpcao("regiao", "", [])).toEqual({ erro: "Digite o nome da região." });
  });
  it("recusa nome grande demais, mas aceita o limite exato", () => {
    expect(validarNomeOpcao("responsavel", "a".repeat(NOME_OPCAO_MAXIMO), [])).toEqual({
      nome: "a".repeat(NOME_OPCAO_MAXIMO),
    });
    expect(validarNomeOpcao("responsavel", "a".repeat(NOME_OPCAO_MAXIMO + 1), [])).toHaveProperty("erro");
  });
  it("recusa nome repetido, ignorando caixa, acento e espaços", () => {
    const feitas = ["São Paulo", "Cauê"];
    expect(validarNomeOpcao("regiao", "sao  paulo", feitas)).toEqual({ erro: "Já existe uma região com esse nome." });
    expect(validarNomeOpcao("consultor", " CAUE ", feitas)).toEqual({ erro: "Já existe um consultor com esse nome." });
    expect(validarNomeOpcao("consultor", "Cauê Silva", feitas)).toEqual({ nome: "Cauê Silva" });
  });
  it("recusa caracteres de controle", () => {
    expect(validarNomeOpcao("consultor", "Ana\u0000", [])).toHaveProperty("erro");
  });
});

describe("mesclarOpcoes", () => {
  it("junta as listas, sem repetir, em ordem alfabética", () => {
    expect(mesclarOpcoes(["Zeca", "Ana"], ["Bia", "Ana"])).toEqual(["Ana", "Bia", "Zeca"]);
  });
  it("ignora caixa, acento e espaços nas pontas, e vale a grafia da primeira lista", () => {
    expect(mesclarOpcoes(["José"], ["jose", " JOSÉ "], ["Maria"])).toEqual(["José", "Maria"]);
    expect(mesclarOpcoes(["jose"], ["José"])).toEqual(["jose"]);
  });
  it("descarta vazios e nulos", () => {
    expect(mesclarOpcoes([null, undefined, "", "  ", "Ana"])).toEqual(["Ana"]);
  });
  it("soma a lista cadastrada às que já existem (região nova entra junto das dos clientes)", () => {
    const dosClientes = ["Oeste MT a RO/AC", "Sorriso e Região"];
    const cadastradas = ["Nova Região a MG", "sorriso e regiao"];
    expect(mesclarOpcoes(cadastradas, dosClientes)).toEqual([
      "Nova Região a MG",
      "Oeste MT a RO/AC",
      "sorriso e regiao",
    ]);
  });
  it("sem nenhuma lista, devolve vazio", () => {
    expect(mesclarOpcoes()).toEqual([]);
  });
});
