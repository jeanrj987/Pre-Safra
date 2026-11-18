import { describe, expect, it } from "vitest";
import {
  filtrarPermissoes,
  papelDe,
  pode,
  podeAcessarAdmin,
  ROTULO_PAPEL,
  permissoesEfetivas,
  TODAS_PERMISSOES,
} from "./permissoes";

const conta = (
  extra: Partial<{ admin: boolean; somentePainel: boolean; permissoes: string[]; regioesAdmin: string[] }> = {},
) => ({
  admin: false,
  somentePainel: false,
  permissoes: [] as string[],
  ...extra,
});

describe("filtrarPermissoes", () => {
  it("descarta chaves desconhecidas e repetidas", () => {
    expect(filtrarPermissoes(["safras", "inexistente", "safras", "backup"])).toEqual(["safras", "backup"]);
  });
});

describe("permissoesEfetivas", () => {
  it("o admin tem todas, mesmo sem nada salvo", () => {
    expect(permissoesEfetivas(conta({ admin: true }))).toEqual([...TODAS_PERMISSOES]);
  });
  it("a conta somente Painel não tem nenhuma", () => {
    expect(permissoesEfetivas(conta({ somentePainel: true, permissoes: ["safras"] }))).toEqual([]);
  });
  it("a conta comum tem só o que foi liberado e que existe", () => {
    expect(permissoesEfetivas(conta({ permissoes: ["clientes", "lixo"] }))).toEqual(["clientes"]);
  });
  it("o admin da região não tem permissões avulsas: os poderes dele vêm do escopo por região", () => {
    expect(permissoesEfetivas(conta({ regioesAdmin: ["Sorriso"], permissoes: ["clientes", "safras"] }))).toEqual([]);
  });
  it("sem região (ou só com nomes vazios), as permissões continuam valendo", () => {
    expect(permissoesEfetivas(conta({ regioesAdmin: [], permissoes: ["clientes"] }))).toEqual(["clientes"]);
    expect(permissoesEfetivas(conta({ regioesAdmin: ["  "], permissoes: ["clientes"] }))).toEqual(["clientes"]);
  });
  it("o admin total mantém todas, mesmo com regiões", () => {
    expect(permissoesEfetivas(conta({ admin: true, regioesAdmin: ["Sorriso"] }))).toEqual([...TODAS_PERMISSOES]);
  });
});

describe("pode", () => {
  it("confere a permissão na lista da sessão", () => {
    expect(pode({ permissoes: ["safras"] }, "safras")).toBe(true);
    expect(pode({ permissoes: ["safras"] }, "backup")).toBe(false);
  });
});

describe("podeAcessarAdmin", () => {
  it("o admin total entra", () => {
    expect(podeAcessarAdmin({ admin: true, permissoes: [] })).toBe(true);
  });
  it("entra quem tem alguma permissão de Administração", () => {
    expect(podeAcessarAdmin({ admin: false, permissoes: ["sugestoes"] })).toBe(true);
    expect(podeAcessarAdmin({ admin: false, permissoes: ["backup"] })).toBe(true);
  });
  it("o admin da região (sem permissões efetivas) não entra na Administração", () => {
    const efetivas = permissoesEfetivas(conta({ regioesAdmin: ["Sorriso"], permissoes: ["clientes", "backup"] }));
    expect(podeAcessarAdmin({ admin: false, permissoes: efetivas })).toBe(false);
  });
  it("permissões do dia a dia, sozinhas, não dão acesso à Administração", () => {
    expect(podeAcessarAdmin({ admin: false, permissoes: ["todosClientes", "trocarResp", "cadastrar", "atividades", "telao"] })).toBe(false);
  });
});

describe("papelDe", () => {
  it("deduz o papel dos campos salvos", () => {
    expect(papelDe(conta({ admin: true }))).toBe("admin");
    expect(papelDe(conta({ somentePainel: true }))).toBe("painel");
    expect(papelDe(conta({ permissoes: ["safras"] }))).toBe("personalizado");
    expect(papelDe(conta())).toBe("comum");
  });
  it("permissões inválidas não tornam a conta Personalizada", () => {
    expect(papelDe(conta({ permissoes: ["lixo"] }))).toBe("comum");
  });
  it("com ao menos uma região, a conta é Admin da região (vale mais que comum e personalizado)", () => {
    expect(papelDe(conta({ regioesAdmin: ["Sorriso"] }))).toBe("regional");
    expect(papelDe(conta({ regioesAdmin: ["Sorriso", "Sinop"], permissoes: ["safras"] }))).toBe("regional");
  });
  it("admin total e somente Painel valem mais que a região", () => {
    expect(papelDe(conta({ admin: true, regioesAdmin: ["Sorriso"] }))).toBe("admin");
    expect(papelDe(conta({ somentePainel: true, regioesAdmin: ["Sorriso"] }))).toBe("painel");
  });
  it("lista de regiões vazia, ausente ou só com nomes em branco não muda o papel", () => {
    expect(papelDe(conta({ regioesAdmin: [] }))).toBe("comum");
    expect(papelDe(conta({ regioesAdmin: ["  "], permissoes: ["safras"] }))).toBe("personalizado");
    expect(papelDe(conta())).toBe("comum");
  });
  it("o rótulo do papel regional é Admin da região", () => {
    expect(ROTULO_PAPEL.regional).toBe("Admin da região");
  });
});
