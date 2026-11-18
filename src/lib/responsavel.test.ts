import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ preSafra: { findMany: vi.fn(), updateMany: vi.fn() } }));
vi.mock("./db", () => ({ prisma: banco }));

import { TODAS_PERMISSOES } from "./permissoes";
import {
  assumeAoAgendar,
  assumirCliente,
  ehAdminDaRegiao,
  idsPermitidos,
  responsavelPadraoDaRegiao,
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

describe("admin da região", () => {
  const ana = { permissoes: [], nomeResponsavel: "Ana", regioesAdmin: ["Sorriso", "Lucas do Rio Verde"] };
  const maria = { permissoes: [], nomeResponsavel: "Maria" };

  describe("podeAlterarCliente", () => {
    it("altera cliente da região dele, de qualquer responsável ou sem responsável", () => {
      expect(podeAlterarCliente(ana, "Maria", "Sorriso")).toBe(true);
      expect(podeAlterarCliente(ana, null, "Sorriso")).toBe(true);
      expect(podeAlterarCliente(ana, "Maria", "Lucas do Rio Verde")).toBe(true);
    });
    it("não altera cliente de outra região, nem sem região, se o responsável é outro", () => {
      expect(podeAlterarCliente(ana, "Maria", "Sinop")).toBe(false);
      expect(podeAlterarCliente(ana, null, "Sinop")).toBe(false);
      expect(podeAlterarCliente(ana, "Maria", null)).toBe(false);
      expect(podeAlterarCliente(ana, "Maria")).toBe(false);
      expect(podeAlterarCliente(ana, "Maria", "  ")).toBe(false);
    });
    it("em outra região continua alterando o cliente em que ele mesmo é o responsável", () => {
      expect(podeAlterarCliente(ana, "ana", "Sinop")).toBe(true);
    });
    it("compara a região ignorando maiúsculas, acentos e espaços nas pontas", () => {
      const u = { permissoes: [], nomeResponsavel: "Ana", regioesAdmin: ["Cuiabá"] };
      expect(podeAlterarCliente(u, "Maria", " cuiaba ")).toBe(true);
      expect(podeAlterarCliente(u, "Maria", "Cuiabá Norte")).toBe(false);
    });
    it("funciona mesmo sem nome ligado à conta", () => {
      const semNome = { permissoes: [], nomeResponsavel: null, regioesAdmin: ["Sorriso"] };
      expect(podeAlterarCliente(semNome, "Maria", "Sorriso")).toBe(true);
    });
    it("quem não é admin regional não ganha nada com a região do cliente", () => {
      expect(podeAlterarCliente(maria, "Jean", "Sorriso")).toBe(false);
      expect(podeAlterarCliente({ ...maria, regioesAdmin: [] }, "Jean", "Sorriso")).toBe(false);
    });
    it("o admin total continua alterando tudo", () => {
      expect(podeAlterarCliente({ permissoes: todas, nomeResponsavel: null }, "Maria", "Sinop")).toBe(true);
    });
  });

  it("ehAdminDaRegiao exige região e conta ligada a ela", () => {
    expect(ehAdminDaRegiao(ana, "Sorriso")).toBe(true);
    expect(ehAdminDaRegiao(ana, "Sinop")).toBe(false);
    expect(ehAdminDaRegiao(ana, null)).toBe(false);
    expect(ehAdminDaRegiao(maria, "Sorriso")).toBe(false);
  });

  describe("podeAgendarCliente e assumir", () => {
    it("agenda cliente sem responsável da região dele, mesmo sem nome ligado à conta", () => {
      const semNome = { permissoes: [], nomeResponsavel: null, regioesAdmin: ["Sorriso"] };
      expect(podeAgendarCliente(semNome, null, "Sorriso")).toBe(true);
      expect(podeAgendarCliente(semNome, null, "Sinop")).toBe(false);
    });
    it("agenda qualquer cliente que já tem responsável, como todos", () => {
      expect(podeAgendarCliente(ana, "Jean", "Sinop")).toBe(true);
    });
    it("assume, com o nome dele, o cliente sem responsável; não toma o de outra pessoa", () => {
      expect(podeAssumirCliente(ana, null)).toBe(true);
      expect(podeAssumirCliente(ana, "Maria")).toBe(false);
    });
  });

  describe("responsável padrão ao agendar", () => {
    const jean = { permissoes: [], nomeResponsavel: "Jean" };
    const daRegiao = { atendentes: "Maria e Jean", responsavel: null, adminRegional: "Ana" };

    it("o admin da região entra nas opções de quem escolhe na dupla", () => {
      expect(opcoesDeResponsavelAoAgendar(jean, daRegiao)).toEqual(["Maria", "Jean", "Ana"]);
    });
    it("não repete o admin que já está na dupla (nem pela grafia)", () => {
      expect(opcoesDeResponsavelAoAgendar(jean, { ...daRegiao, adminRegional: " maria " })).toEqual(["Maria", "Jean"]);
    });
    it("cliente sem dupla mas com admin da região tem escolha; sem os dois, não", () => {
      expect(opcoesDeResponsavelAoAgendar(jean, { atendentes: null, responsavel: null, adminRegional: "Ana" })).toEqual([
        "Ana",
        "Jean",
      ]);
      expect(opcoesDeResponsavelAoAgendar(jean, { atendentes: null, responsavel: null, adminRegional: null })).toEqual([]);
      expect(opcoesDeResponsavelAoAgendar(jean, { atendentes: null, responsavel: null, adminRegional: "  " })).toEqual([]);
    });
    it("quem escolhe o responsável (admin total) segue sem lista de dupla", () => {
      expect(opcoesDeResponsavelAoAgendar({ permissoes: todas, nomeResponsavel: null }, daRegiao)).toEqual([]);
    });

    it("qualquer usuário agendando cliente sem responsável da região traz o admin da região marcado", () => {
      const consultor = { permissoes: [], nomeResponsavel: "André" };
      const semLigacao = { permissoes: [], nomeResponsavel: null };
      expect(responsavelInicialAoAgendar(jean, daRegiao)).toBe("Ana");
      expect(responsavelInicialAoAgendar(consultor, daRegiao)).toBe("Ana");
      expect(responsavelInicialAoAgendar(semLigacao, daRegiao)).toBe("Ana");
      expect(responsavelInicialAoAgendar(ana, daRegiao)).toBe("Ana");
    });
    it("usa a grafia da lista para o admin", () => {
      expect(responsavelInicialAoAgendar(jean, { ...daRegiao, adminRegional: " maria " })).toBe("Maria");
    });
    it("cliente que já tem responsável nas opções mantém esse responsável (reagendar não troca)", () => {
      expect(responsavelInicialAoAgendar(jean, { ...daRegiao, responsavel: "Maria" })).toBe("Maria");
    });
    it("cliente com responsável fora das opções não vira do admin da região: vale a regra antiga", () => {
      expect(responsavelInicialAoAgendar(jean, { ...daRegiao, responsavel: "Samuel" })).toBe("Jean");
    });
    it("região sem admin: o padrão antigo (o próprio usuário, se está na dupla)", () => {
      expect(responsavelInicialAoAgendar(jean, { ...daRegiao, adminRegional: null })).toBe("Jean");
    });

    it("responsavelPadraoDaRegiao só vale para cliente sem responsável e com admin da região", () => {
      expect(responsavelPadraoDaRegiao(daRegiao)).toBe("Ana");
      expect(responsavelPadraoDaRegiao({ ...daRegiao, responsavel: "Maria" })).toBe("");
      expect(responsavelPadraoDaRegiao({ ...daRegiao, adminRegional: null })).toBe("");
      expect(responsavelPadraoDaRegiao({ atendentes: null, responsavel: "  ", adminRegional: "Ana" })).toBe("Ana");
    });

    it("quem agenda pode indicar o admin da região, o colega da dupla ou a si mesmo", () => {
      expect(responsavelEscolhidoAoAgendar(jean, daRegiao, "Ana")).toBe("Ana");
      expect(responsavelEscolhidoAoAgendar(jean, daRegiao, " ana ")).toBe("Ana");
      expect(responsavelEscolhidoAoAgendar(jean, daRegiao, "Maria")).toBe("Maria");
      expect(responsavelEscolhidoAoAgendar(jean, daRegiao, "Jean")).toBe("Jean");
    });
    it("o servidor não confia na tela: nome fora das opções é rejeitado", () => {
      expect(responsavelEscolhidoAoAgendar(jean, daRegiao, "Samuel")).toBeNull();
      expect(responsavelEscolhidoAoAgendar(jean, daRegiao, "Ana Paula")).toBeNull();
    });
    it("cliente de região sem admin: o nome do admin de outra região é rejeitado", () => {
      expect(responsavelEscolhidoAoAgendar(jean, { ...daRegiao, adminRegional: null }, "Ana")).toBeNull();
    });
    it("o admin da região agenda para si mesmo e para a dupla", () => {
      expect(responsavelEscolhidoAoAgendar(ana, daRegiao, "Ana")).toBe("Ana");
      expect(responsavelEscolhidoAoAgendar(ana, daRegiao, "Jean")).toBe("Jean");
      expect(responsavelEscolhidoAoAgendar(ana, daRegiao, "Samuel")).toBeNull();
    });
    it("o admin total continua escolhendo qualquer nome", () => {
      const admin = { permissoes: todas, nomeResponsavel: null };
      expect(responsavelEscolhidoAoAgendar(admin, daRegiao, "Samuel")).toBe("Samuel");
    });
  });

  describe("idsPermitidos", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      banco.preSafra.findMany.mockResolvedValue([
        { id: 1, responsavel: "Maria", cliente: { regiao: "Sorriso" } },
        { id: 2, responsavel: null, cliente: { regiao: "Sorriso" } },
        { id: 3, responsavel: "Maria", cliente: { regiao: "Sinop" } },
        { id: 4, responsavel: "Ana", cliente: { regiao: "Sinop" } },
        { id: 5, responsavel: "Maria", cliente: null },
      ]);
    });

    it("o admin da região mantém os clientes da região dele (e os que são dele), descarta o resto", async () => {
      expect(await idsPermitidos(ana, [1, 2, 3, 4, 5])).toEqual([1, 2, 4]);
      expect(banco.preSafra.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3, 4, 5] } },
        select: { id: true, responsavel: true, cliente: { select: { regiao: true } } },
      });
    });
    it("admin da região sem nome ligado à conta também vale pela região", async () => {
      const semNome = { permissoes: [], nomeResponsavel: null, regioesAdmin: ["Sorriso"] };
      expect(await idsPermitidos(semNome, [1, 2, 3])).toEqual([1, 2]);
    });
    it("usuário comum continua só com os clientes dele", async () => {
      expect(await idsPermitidos(maria, [1, 2, 3, 4, 5])).toEqual([1, 3, 5]);
    });
    it("sem ligação nem região, nada (e sem consultar o banco); o admin total passa tudo direto", async () => {
      expect(await idsPermitidos({ permissoes: [], nomeResponsavel: null }, [1, 2])).toEqual([]);
      expect(await idsPermitidos({ permissoes: todas, nomeResponsavel: null }, [1, 2])).toEqual([1, 2]);
      expect(banco.preSafra.findMany).not.toHaveBeenCalled();
    });
  });

  describe("assumirCliente", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      banco.preSafra.updateMany.mockResolvedValue({ count: 1 });
    });
    it("o admin da região assume, com o nome dele, o cliente sem responsável", async () => {
      expect(await assumirCliente({ ...ana, nome: "Ana Souza" }, 9)).toBe(true);
      expect(banco.preSafra.updateMany).toHaveBeenCalledWith({
        where: { id: 9, inativo: false, OR: [{ responsavel: null }, { responsavel: "" }] },
        data: { responsavel: "Ana", atualizadoPor: "Ana Souza" },
      });
    });
    it("sem nome ligado à conta não assume", async () => {
      const semNome = { permissoes: [], nomeResponsavel: null, regioesAdmin: ["Sorriso"] };
      expect(await assumirCliente(semNome, 9)).toBe(false);
    });
  });
});
