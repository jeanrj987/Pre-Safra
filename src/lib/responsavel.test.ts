import { describe, expect, it } from "vitest";
import { podeAgendarCliente, podeAlterarCliente, podeAssumirCliente } from "./responsavel";

describe("podeAlterarCliente", () => {
  const maria = { admin: false, nomeResponsavel: "Maria" };
  const semLigacao = { admin: false, nomeResponsavel: null };
  const admin = { admin: true, nomeResponsavel: null };

  it("o usuário altera o cliente em que ele é o responsável", () => {
    expect(podeAlterarCliente(maria, "Maria")).toBe(true);
  });
  it("não altera o cliente de outro responsável", () => {
    expect(podeAlterarCliente(maria, "Jean")).toBe(false);
  });
  it("não altera cliente sem responsável", () => {
    expect(podeAlterarCliente(maria, null)).toBe(false);
  });
  it("ignora maiúsculas, acentos e espaços nas pontas ao comparar", () => {
    expect(podeAlterarCliente({ admin: false, nomeResponsavel: "José" }, " jose ")).toBe(true);
  });
  it("nome parecido não basta: tem que ser o mesmo", () => {
    expect(podeAlterarCliente(maria, "Maria Silva")).toBe(false);
  });
  it("usuário sem ligação só vê", () => {
    expect(podeAlterarCliente(semLigacao, "Maria")).toBe(false);
    expect(podeAlterarCliente(semLigacao, null)).toBe(false);
  });
  it("o admin altera qualquer cliente, com ou sem responsável", () => {
    expect(podeAlterarCliente(admin, "Maria")).toBe(true);
    expect(podeAlterarCliente(admin, null)).toBe(true);
  });
});

describe("podeAssumirCliente", () => {
  const maria = { admin: false, nomeResponsavel: "Maria" };

  it("assume o cliente que ainda não tem responsável", () => {
    expect(podeAssumirCliente(maria, null)).toBe(true);
    expect(podeAssumirCliente(maria, "  ")).toBe(true);
  });
  it("não toma o cliente de quem já é responsável, nem o que já é dele", () => {
    expect(podeAssumirCliente(maria, "Jean")).toBe(false);
    expect(podeAssumirCliente(maria, "Maria")).toBe(false);
  });
  it("sem ligação não assume; o admin escolhe o responsável em vez de assumir", () => {
    expect(podeAssumirCliente({ admin: false, nomeResponsavel: null }, null)).toBe(false);
    expect(podeAssumirCliente({ admin: true, nomeResponsavel: "Maria" }, null)).toBe(false);
  });
});

describe("podeAgendarCliente", () => {
  const maria = { admin: false, nomeResponsavel: "Maria" };
  const semLigacao = { admin: false, nomeResponsavel: null };

  it("qualquer usuário agenda cliente que já tem responsável, mesmo o de outra pessoa", () => {
    expect(podeAgendarCliente(maria, "Jean")).toBe(true);
    expect(podeAgendarCliente(semLigacao, "Jean")).toBe(true);
  });
  it("cliente sem responsável: agenda quem pode assumi-lo", () => {
    expect(podeAgendarCliente(maria, null)).toBe(true);
    expect(podeAgendarCliente(semLigacao, null)).toBe(false);
  });
  it("o admin agenda qualquer um", () => {
    expect(podeAgendarCliente({ admin: true, nomeResponsavel: null }, null)).toBe(true);
  });
});
