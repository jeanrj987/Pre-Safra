import { describe, expect, it } from "vitest";
import {
  filtrarPermissoes,
  papelDe,
  pode,
  podeAcessarAdmin,
  permissoesEfetivas,
  TODAS_PERMISSOES,
} from "./permissoes";

const conta = (extra: Partial<{ admin: boolean; somentePainel: boolean; permissoes: string[] }> = {}) => ({
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
});
