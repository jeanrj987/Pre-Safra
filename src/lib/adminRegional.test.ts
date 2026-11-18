import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ usuario: { findMany: vi.fn() } }));
vi.mock("./db", () => ({ prisma: banco }));

import { adminDaRegiao, carregarAdminsPorRegiao, montarAdminsPorRegiao } from "./adminRegional";

describe("montarAdminsPorRegiao", () => {
  it("liga cada região ao nome do admin, comparando sem acento, caixa e espaços nas pontas", () => {
    const mapa = montarAdminsPorRegiao([{ nomeResponsavel: "Ana", regioesAdmin: ["Cuiabá", " Sorriso "] }]);
    expect(adminDaRegiao(mapa, "cuiaba")).toBe("Ana");
    expect(adminDaRegiao(mapa, "SORRISO")).toBe("Ana");
    expect(adminDaRegiao(mapa, "Sinop")).toBeNull();
  });
  it("conta sem nome ligado não vira responsável padrão", () => {
    const mapa = montarAdminsPorRegiao([{ nomeResponsavel: "  ", regioesAdmin: ["Sorriso"] }]);
    expect(adminDaRegiao(mapa, "Sorriso")).toBeNull();
  });
  it("região repetida entre contas: vale a primeira", () => {
    const mapa = montarAdminsPorRegiao([
      { nomeResponsavel: "Ana", regioesAdmin: ["Sorriso"] },
      { nomeResponsavel: "Bia", regioesAdmin: ["Sorriso", "Sinop"] },
    ]);
    expect(adminDaRegiao(mapa, "Sorriso")).toBe("Ana");
    expect(adminDaRegiao(mapa, "Sinop")).toBe("Bia");
  });
  it("ignora região em branco", () => {
    expect(montarAdminsPorRegiao([{ nomeResponsavel: "Ana", regioesAdmin: ["", "  "] }]).size).toBe(0);
  });
});

describe("adminDaRegiao", () => {
  it("cliente sem região não tem admin da região", () => {
    const mapa = montarAdminsPorRegiao([{ nomeResponsavel: "Ana", regioesAdmin: ["Sorriso"] }]);
    expect(adminDaRegiao(mapa, null)).toBeNull();
    expect(adminDaRegiao(mapa, undefined)).toBeNull();
    expect(adminDaRegiao(mapa, "  ")).toBeNull();
  });
});

describe("carregarAdminsPorRegiao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("faz uma única consulta só dos usuários ativos com região, e monta o mapa", async () => {
    banco.usuario.findMany.mockResolvedValue([{ nomeResponsavel: "Ana", regioesAdmin: ["Sorriso"] }]);
    const mapa = await carregarAdminsPorRegiao();
    expect(adminDaRegiao(mapa, "Sorriso")).toBe("Ana");
    expect(banco.usuario.findMany).toHaveBeenCalledTimes(1);
    expect(banco.usuario.findMany.mock.calls[0][0].where).toMatchObject({
      ativo: true,
      admin: false,
      somentePainel: false,
      nomeResponsavel: { not: null },
      NOT: { regioesAdmin: { isEmpty: true } },
    });
  });
});
