import { describe, expect, it } from "vitest";
import { mensagemErroSenha, SENHA_MAX, SENHA_MIN, validarNovaSenha, validarSenha } from "./politica-senha";

describe("validarSenha", () => {
  it("aceita de 10 a 128 caracteres", () => {
    expect(validarSenha("a".repeat(SENHA_MIN))).toBeNull();
    expect(validarSenha("a".repeat(SENHA_MAX))).toBeNull();
  });

  it("recusa senha curta e longa demais", () => {
    expect(validarSenha("a".repeat(SENHA_MIN - 1))).toBe("curta");
    expect(validarSenha("")).toBe("curta");
    expect(validarSenha("a".repeat(SENHA_MAX + 1))).toBe("longa");
  });

  it("conta caracteres, não unidades UTF-16 (emoji vale 1)", () => {
    expect(validarSenha("😀".repeat(SENHA_MIN))).toBeNull();
    expect(validarSenha("😀".repeat(SENHA_MAX))).toBeNull();
  });

  it("recusa senha só de espaços, mas aceita espaços no meio e não faz trim", () => {
    expect(validarSenha(" ".repeat(12))).toBe("vazia");
    expect(validarSenha("uma frase longa")).toBeNull();
    expect(validarSenha("   abc   ")).toBe("curta");
  });
});

describe("validarNovaSenha", () => {
  it("confere a confirmação", () => {
    expect(validarNovaSenha("senha-bem-longa", "senha-bem-longa")).toBeNull();
    expect(validarNovaSenha("senha-bem-longa", "outra-senha-longa")).toBe("diferente");
  });

  it("sem confirmação, vale só a política", () => {
    expect(validarNovaSenha("senha-bem-longa")).toBeNull();
    expect(validarNovaSenha("curta", "curta")).toBe("curta");
  });
});

describe("mensagemErroSenha", () => {
  it("devolve texto em português para códigos conhecidos", () => {
    expect(mensagemErroSenha("curta")).toBe("A senha precisa ter pelo menos 10 caracteres.");
    expect(mensagemErroSenha("longa")).toBe("A senha pode ter no máximo 128 caracteres.");
  });

  it("ignora códigos desconhecidos (ex.: vindos da URL)", () => {
    expect(mensagemErroSenha("senha")).toBeUndefined();
    expect(mensagemErroSenha("__proto__")).toBeUndefined();
    expect(mensagemErroSenha(undefined)).toBeUndefined();
  });
});
