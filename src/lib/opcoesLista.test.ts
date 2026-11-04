import { describe, expect, it } from "vitest";
import {
  NOME_OPCAO_MAXIMO,
  TEXTOS_OPCAO,
  TIPOS_OPCAO,
  ehTipoOpcao,
  limparNomeOpcao,
  mesclarOpcoes,
  validarNomeOpcao,
} from "./opcoesLista";

describe("tipos de lista", () => {
  it("aceita só os cinco tipos conhecidos", () => {
    expect(ehTipoOpcao("regiao")).toBe(true);
    expect(ehTipoOpcao("consultor")).toBe(true);
    expect(ehTipoOpcao("responsavel")).toBe(true);
    expect(ehTipoOpcao("atendimento")).toBe(true);
    expect(ehTipoOpcao("comercial")).toBe(true);
    expect(ehTipoOpcao("cidade")).toBe(false);
    expect(ehTipoOpcao("")).toBe(false);
    expect(ehTipoOpcao(undefined)).toBe(false);
    expect(ehTipoOpcao(3)).toBe(false);
  });
});

describe("textos das listas", () => {
  it("todo tipo tem textos, e os títulos são únicos (o backup usa o título como rótulo)", () => {
    expect(TIPOS_OPCAO).toEqual(["regiao", "consultor", "responsavel", "atendimento", "comercial"]);
    const titulos = TIPOS_OPCAO.map((t) => TEXTOS_OPCAO[t].titulo);
    expect(new Set(titulos).size).toBe(TIPOS_OPCAO.length);
    expect(titulos).toContain("Atendimento");
    expect(titulos).toContain("Comercial");
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

describe("validarNomeOpcao: comercial", () => {
  it("aceita um nome simples e recusa vazio ou repetido", () => {
    expect(validarNomeOpcao("comercial", " Sidinei ", [])).toEqual({ nome: "Sidinei" });
    expect(validarNomeOpcao("comercial", "  ", [])).toEqual({ erro: "Digite o nome do comercial." });
    expect(validarNomeOpcao("comercial", "sidinei", ["Sidinei"])).toEqual({
      erro: "Já existe um comercial com esse nome.",
    });
  });
});

describe("validarNomeOpcao: atendimento (um atendente ou dupla)", () => {
  const erroFormato = { erro: 'Escreva um nome ou dois nomes separados por "e". Ex.: Maria ou Maria e Jean.' };

  it("aceita duas pessoas separadas por e, limpando os espaços", () => {
    expect(validarNomeOpcao("atendimento", "  Maria   e  Jean ", [])).toEqual({ nome: "Maria e Jean" });
    expect(validarNomeOpcao("atendimento", "Marcos e Jéssica", [])).toEqual({ nome: "Marcos e Jéssica" });
  });
  it("recusa nome vazio", () => {
    expect(validarNomeOpcao("atendimento", "", [])).toEqual({
      erro: "Digite o nome do atendente ou os nomes da dupla de atendimento.",
    });
    expect(validarNomeOpcao("atendimento", "   ", [])).toHaveProperty("erro");
  });
  it("aceita um atendente só, limpando os espaços", () => {
    expect(validarNomeOpcao("atendimento", "Maria", [])).toEqual({ nome: "Maria" });
    expect(validarNomeOpcao("atendimento", "  Maria   Eduarda ", [])).toEqual({ nome: "Maria Eduarda" });
    expect(validarNomeOpcao("atendimento", "Eduardo", [])).toEqual({ nome: "Eduardo" });
  });
  it("recusa dupla com uma das partes vazia", () => {
    expect(validarNomeOpcao("atendimento", "Maria e", [])).toEqual(erroFormato);
    expect(validarNomeOpcao("atendimento", "e Jean", [])).toEqual(erroFormato);
    expect(validarNomeOpcao("atendimento", "e", [])).toEqual(erroFormato);
    expect(validarNomeOpcao("atendimento", "Maria e e Jean", [])).toEqual(erroFormato);
  });
  it("recusa três ou mais pessoas", () => {
    expect(validarNomeOpcao("atendimento", "Ana e Bia e Caio", [])).toEqual(erroFormato);
    expect(validarNomeOpcao("atendimento", "Ana e Bia e Caio e Dani", [])).toEqual(erroFormato);
  });
  it("recusa atendimento repetido, ignorando caixa e acento (dupla ou nome único)", () => {
    expect(validarNomeOpcao("atendimento", "marcos e jessica", ["Marcos e Jéssica"])).toEqual({
      erro: "Já existe um atendimento com esse nome ou com esses nomes.",
    });
    expect(validarNomeOpcao("atendimento", " JESSICA ", ["Jéssica"])).toEqual({
      erro: "Já existe um atendimento com esse nome ou com esses nomes.",
    });
  });
  it("não exige o formato de dupla nos outros tipos", () => {
    expect(validarNomeOpcao("consultor", "Maria", [])).toEqual({ nome: "Maria" });
    expect(validarNomeOpcao("responsavel", "Maria", [])).toEqual({ nome: "Maria" });
    expect(validarNomeOpcao("regiao", "Norte MT", [])).toEqual({ nome: "Norte MT" });
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
  it("duplas cadastradas entram junto das que vêm dos clientes", () => {
    expect(mesclarOpcoes(["Nova e Dupla"], ["Maria e Jean", "nova e dupla"])).toEqual(["Maria e Jean", "Nova e Dupla"]);
  });
  it("sem nenhuma lista, devolve vazio", () => {
    expect(mesclarOpcoes()).toEqual([]);
  });
});
