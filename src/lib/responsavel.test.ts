import { describe, expect, it } from "vitest";
import { TODAS_PERMISSOES } from "./permissoes";
import {
  assumeAoAgendar,
  podeAgendarCliente,
  podeAlterarCliente,
  opcoesDeResponsavelAoAgendar,
  podeAssumirCliente,
  responsavelAoAgendar,
  responsavelEscolhidoAoAgendar,
  responsavelInicialAoAgendar,
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

describe("responsável ao agendar, escolhido na dupla do cliente", () => {
  const jean = { permissoes: [], nomeResponsavel: "Jean" };
  const admin = { permissoes: todas, nomeResponsavel: null };
  const daDupla = { atendentes: "Maria e Jean", responsavel: "Samuel" };
  const semDupla = { atendentes: null, responsavel: "Samuel" };

  it("lista os dois atendentes da dupla", () => {
    expect(opcoesDeResponsavelAoAgendar(jean, daDupla)).toEqual(["Maria", "Jean"]);
  });
  it("quem está fora da dupla também aparece, para poder assumir o cliente", () => {
    const consultor = { permissoes: [], nomeResponsavel: "André" };
    expect(opcoesDeResponsavelAoAgendar(consultor, daDupla)).toEqual(["Maria", "Jean", "André"]);
  });
  it("sem nome ligado à conta, o responsável atual continua na lista", () => {
    const semLigacao = { permissoes: [], nomeResponsavel: null };
    expect(opcoesDeResponsavelAoAgendar(semLigacao, daDupla)).toEqual(["Maria", "Jean", "Samuel"]);
    expect(opcoesDeResponsavelAoAgendar(semLigacao, { atendentes: "Maria e Jean", responsavel: null })).toEqual([
      "Maria",
      "Jean",
    ]);
  });
  it("cliente sem dupla e admin não têm escolha na dupla", () => {
    expect(opcoesDeResponsavelAoAgendar(jean, semDupla)).toEqual([]);
    expect(opcoesDeResponsavelAoAgendar(admin, daDupla)).toEqual([]);
  });

  it("o valor inicial é o responsável atual, se ele está nas opções (grafia da lista)", () => {
    expect(responsavelInicialAoAgendar(jean, { atendentes: "Maria e Jean", responsavel: "Maria" })).toBe("Maria");
    expect(responsavelInicialAoAgendar(jean, { atendentes: "Maria e Jean", responsavel: " maria " })).toBe("Maria");
    expect(responsavelInicialAoAgendar(jean, { atendentes: "Maria e Jean", responsavel: "Jean" })).toBe("Jean");
  });
  it("cliente sem responsável, ou com responsável fora das opções: o valor inicial é o usuário, se está na dupla", () => {
    expect(responsavelInicialAoAgendar(jean, { atendentes: "Maria e Jean", responsavel: null })).toBe("Jean");
    expect(responsavelInicialAoAgendar(jean, daDupla)).toBe("Jean");
    expect(responsavelInicialAoAgendar({ permissoes: [], nomeResponsavel: " jean " }, daDupla)).toBe("Jean");
  });
  it("fora da dupla, o valor inicial é o responsável atual se ele está na dupla; senão, vazio", () => {
    const consultor = { permissoes: [], nomeResponsavel: "André" };
    expect(responsavelInicialAoAgendar(consultor, { atendentes: "Maria e Jean", responsavel: "Maria" })).toBe("Maria");
    expect(responsavelInicialAoAgendar(consultor, daDupla)).toBe("");
    expect(responsavelInicialAoAgendar(consultor, semDupla)).toBe("");
  });

  it("escolhe o colega da dupla", () => {
    expect(responsavelEscolhidoAoAgendar(jean, daDupla, "Maria")).toBe("Maria");
    expect(responsavelEscolhidoAoAgendar(jean, daDupla, " maria ")).toBe("Maria");
  });
  it("escolhe a si mesmo", () => {
    expect(responsavelEscolhidoAoAgendar(jean, daDupla, "Jean")).toBe("Jean");
  });
  it("rejeita um nome fora da dupla", () => {
    expect(responsavelEscolhidoAoAgendar(jean, daDupla, "Samuel")).toBeNull();
    expect(responsavelEscolhidoAoAgendar(jean, daDupla, "Maria Silva")).toBeNull();
    expect(responsavelEscolhidoAoAgendar(jean, semDupla, "Maria")).toBeNull();
  });
  it("usuário fora da dupla escolhe um atendente ou ele mesmo, e nada além", () => {
    const consultor = { permissoes: [], nomeResponsavel: "André" };
    expect(responsavelEscolhidoAoAgendar(consultor, daDupla, "Maria")).toBe("Maria");
    expect(responsavelEscolhidoAoAgendar(consultor, daDupla, "André")).toBe("André");
    expect(responsavelEscolhidoAoAgendar(consultor, daDupla, "Samuel")).toBeNull();
  });
  it("cliente sem dupla: sem escolha, quem agenda assume (comportamento antigo)", () => {
    expect(responsavelEscolhidoAoAgendar(jean, semDupla, null)).toBe("Jean");
    expect(responsavelEscolhidoAoAgendar(jean, semDupla, "Jean")).toBe("Jean");
    expect(responsavelEscolhidoAoAgendar({ permissoes: [], nomeResponsavel: null }, semDupla, null)).toBe("Samuel");
  });
  it("campo vazio cai no comportamento antigo (assume quem agenda)", () => {
    expect(responsavelEscolhidoAoAgendar(jean, daDupla, "")).toBe("Jean");
  });
  it("o admin continua escolhendo qualquer nome, ou nenhum", () => {
    expect(responsavelEscolhidoAoAgendar(admin, daDupla, "Samuel")).toBe("Samuel");
    expect(responsavelEscolhidoAoAgendar(admin, daDupla, null)).toBeNull();
  });
  it("agendar para a colega tira do usuário o direito de alterar o cliente", () => {
    const novo = responsavelEscolhidoAoAgendar(jean, daDupla, "Maria");
    expect(podeAlterarCliente(jean, novo)).toBe(false);
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
