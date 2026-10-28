import { describe, expect, it } from "vitest";
import { TODAS_PERMISSOES } from "./permissoes";
import {
  assumeAoAgendar,
  podeAgendarCliente,
  podeAlterarCliente,
  podeAssumirCliente,
  responsavelAoAgendar,
} from "./responsavel";

const todas = [...TODAS_PERMISSOES];

describe("podeAlterarCliente", () => {
  const maria = { permissoes: [], nomeResponsavel: "Maria" };
  const semLigacao = { permissoes: [], nomeResponsavel: null };
  const admin = { permissoes: todas, nomeResponsavel: null };

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
    expect(podeAlterarCliente({ permissoes: [], nomeResponsavel: "José" }, " jose ")).toBe(true);
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
  const maria = { permissoes: [], nomeResponsavel: "Maria" };

  it("assume o cliente que ainda não tem responsável", () => {
    expect(podeAssumirCliente(maria, null)).toBe(true);
    expect(podeAssumirCliente(maria, "  ")).toBe(true);
  });
  it("não toma o cliente de quem já é responsável, nem o que já é dele", () => {
    expect(podeAssumirCliente(maria, "Jean")).toBe(false);
    expect(podeAssumirCliente(maria, "Maria")).toBe(false);
  });
  it("sem ligação não assume; o admin escolhe o responsável em vez de assumir", () => {
    expect(podeAssumirCliente({ permissoes: [], nomeResponsavel: null }, null)).toBe(false);
    expect(podeAssumirCliente({ permissoes: todas, nomeResponsavel: "Maria" }, null)).toBe(false);
  });
});

describe("podeAgendarCliente", () => {
  const maria = { permissoes: [], nomeResponsavel: "Maria" };
  const semLigacao = { permissoes: [], nomeResponsavel: null };

  it("qualquer usuário agenda cliente que já tem responsável, mesmo o de outra pessoa", () => {
    expect(podeAgendarCliente(maria, "Jean")).toBe(true);
    expect(podeAgendarCliente(semLigacao, "Jean")).toBe(true);
  });
  it("cliente sem responsável: agenda quem pode assumi-lo", () => {
    expect(podeAgendarCliente(maria, null)).toBe(true);
    expect(podeAgendarCliente(semLigacao, null)).toBe(false);
  });
  it("o admin agenda qualquer um", () => {
    expect(podeAgendarCliente({ permissoes: todas, nomeResponsavel: null }, null)).toBe(true);
  });
});

describe("responsavelAoAgendar", () => {
  const maria = { permissoes: [], nomeResponsavel: "Maria" };
  const semLigacao = { permissoes: [], nomeResponsavel: null };

  it("quem agenda assume o cliente sem responsável", () => {
    expect(responsavelAoAgendar(maria, null)).toBe("Maria");
    expect(responsavelAoAgendar(maria, "  ")).toBe("Maria");
  });
  it("quem agenda ou reagenda assume o cliente que era de outra pessoa", () => {
    expect(responsavelAoAgendar(maria, "Samuel")).toBe("Maria");
  });
  it("sem nome ligado à conta, o responsável atual continua", () => {
    expect(responsavelAoAgendar(semLigacao, "Samuel")).toBe("Samuel");
    expect(responsavelAoAgendar(semLigacao, null)).toBeNull();
  });
  it("quem escolhe o responsável define o nome na janela: nada é assumido", () => {
    expect(responsavelAoAgendar({ permissoes: todas, nomeResponsavel: "Maria" }, "Samuel")).toBeNull();
  });
});

describe("assumeAoAgendar", () => {
  const maria = { permissoes: [], nomeResponsavel: "Maria" };

  it("avisa quando o cliente é de outra pessoa ou está sem responsável", () => {
    expect(assumeAoAgendar(maria, "Samuel")).toBe(true);
    expect(assumeAoAgendar(maria, null)).toBe(true);
  });
  it("não avisa quando o cliente já é do próprio usuário", () => {
    expect(assumeAoAgendar(maria, "Maria")).toBe(false);
    expect(assumeAoAgendar(maria, " maria ")).toBe(false);
  });
  it("não avisa para quem escolhe o responsável nem para quem não tem nome ligado", () => {
    expect(assumeAoAgendar({ permissoes: todas, nomeResponsavel: "Maria" }, "Samuel")).toBe(false);
    expect(assumeAoAgendar({ permissoes: [], nomeResponsavel: null }, "Samuel")).toBe(false);
  });
});

describe("permissões soltas", () => {
  it("todosClientes sozinha deixa alterar o cliente de qualquer responsável", () => {
    const u = { permissoes: ["todosClientes"], nomeResponsavel: null };
    expect(podeAlterarCliente(u, "Jean")).toBe(true);
    expect(podeAlterarCliente(u, null)).toBe(true);
  });
  it("trocarResp sozinha não dá acesso aos clientes dos outros", () => {
    const u = { permissoes: ["trocarResp"], nomeResponsavel: "Maria" };
    expect(podeAlterarCliente(u, "Jean")).toBe(false);
  });
  it("quem escolhe o responsável agenda cliente sem responsável e não assume", () => {
    const u = { permissoes: ["trocarResp"], nomeResponsavel: null };
    expect(podeAgendarCliente(u, null)).toBe(true);
    expect(podeAssumirCliente({ permissoes: ["trocarResp"], nomeResponsavel: "Maria" }, null)).toBe(false);
  });
});
