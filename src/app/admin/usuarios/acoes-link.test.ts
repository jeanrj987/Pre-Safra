import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ exigirAdmin: vi.fn() }));
const limitador = vi.hoisted(() => ({ registrarSeDentroDoLimite: vi.fn() }));
const base = vi.hoisted(() => ({ urlBase: vi.fn() }));
const servico = vi.hoisted(() => ({
  gerarLinkRedefinicaoAdmin: vi.fn(),
  MENSAGEM_APP_URL: "Configure a variável APP_URL (teste).",
  LIMITE_LINK_ADMIN: { tipo: "link-admin-alvo", max: 20, janelaMs: 3600000 },
}));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/limitador", () => limitador);
vi.mock("@/lib/recuperacao", () => base);
vi.mock("@/lib/recuperacao-admin", () => servico);

import { gerarLinkRedefinicao } from "./acoes-link";

const LINK = "https://app.exemplo.com/redefinir-senha#token=" + "A".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth.exigirAdmin.mockResolvedValue({ id: 1, admin: true });
  base.urlBase.mockReturnValue("https://app.exemplo.com");
  limitador.registrarSeDentroDoLimite.mockResolvedValue(true);
  servico.gerarLinkRedefinicaoAdmin.mockResolvedValue({ ok: true, link: LINK });
});

describe("gerarLinkRedefinicao", () => {
  it("sucesso: devolve ok e o link", async () => {
    expect(await gerarLinkRedefinicao(7)).toEqual({ ok: true, mensagem: "Link gerado.", link: LINK });
    expect(servico.gerarLinkRedefinicaoAdmin).toHaveBeenCalledWith(7);
  });

  it("exige admin: se não for admin, nada é gerado nem contado", async () => {
    auth.exigirAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(gerarLinkRedefinicao(7)).rejects.toThrow("NEXT_REDIRECT");
    expect(limitador.registrarSeDentroDoLimite).not.toHaveBeenCalled();
    expect(servico.gerarLinkRedefinicaoAdmin).not.toHaveBeenCalled();
  });

  it("não-admin com id inválido: exigirAdmin barra antes de qualquer outra coisa, e nada é gravado", async () => {
    auth.exigirAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(gerarLinkRedefinicao(-1)).rejects.toThrow("NEXT_REDIRECT");
    expect(base.urlBase).not.toHaveBeenCalled();
    expect(limitador.registrarSeDentroDoLimite).not.toHaveBeenCalled();
    expect(servico.gerarLinkRedefinicaoAdmin).not.toHaveBeenCalled();
  });

  it("ordem: exigirAdmin vem antes do limite e o limite antes de gerar o link", async () => {
    await gerarLinkRedefinicao(7);
    const ordem = (f: ReturnType<typeof vi.fn>) => f.mock.invocationCallOrder[0];
    expect(ordem(auth.exigirAdmin)).toBeLessThan(ordem(limitador.registrarSeDentroDoLimite));
    expect(ordem(limitador.registrarSeDentroDoLimite)).toBeLessThan(ordem(servico.gerarLinkRedefinicaoAdmin));
  });

  it("APP_URL ausente ou inválida: avisa o admin ANTES de gastar o limite e não gera link", async () => {
    base.urlBase.mockReturnValue(null);
    expect(await gerarLinkRedefinicao(7)).toEqual({ ok: false, mensagem: servico.MENSAGEM_APP_URL });
    expect(limitador.registrarSeDentroDoLimite).not.toHaveBeenCalled();
    expect(servico.gerarLinkRedefinicaoAdmin).not.toHaveBeenCalled();
  });

  it("limite por usuário-alvo: usa o limite persistente com o id como chave", async () => {
    await gerarLinkRedefinicao(7);
    expect(limitador.registrarSeDentroDoLimite).toHaveBeenCalledWith([{ limite: servico.LIMITE_LINK_ADMIN, chave: "7" }]);
  });

  it("limite estourado: recusa com mensagem e não gera link", async () => {
    limitador.registrarSeDentroDoLimite.mockResolvedValue(false);
    const r = await gerarLinkRedefinicao(7);
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain("Muitos links");
    expect(r.link).toBeUndefined();
    expect(servico.gerarLinkRedefinicaoAdmin).not.toHaveBeenCalled();
  });

  it("repassa o erro do serviço (ex.: usuário inativo) sem link", async () => {
    servico.gerarLinkRedefinicaoAdmin.mockResolvedValue({ ok: false, mensagem: "Este usuário está inativo." });
    expect(await gerarLinkRedefinicao(7)).toEqual({ ok: false, mensagem: "Este usuário está inativo." });
  });

  it.each([[0], [-1], [1.5], [Number.NaN], ["7" as unknown as number]])("id inválido (%j): recusa sem consultar nada", async (id) => {
    expect((await gerarLinkRedefinicao(id)).ok).toBe(false);
    expect(servico.gerarLinkRedefinicaoAdmin).not.toHaveBeenCalled();
    expect(limitador.registrarSeDentroDoLimite).not.toHaveBeenCalled();
  });

  it("falha inesperada: mensagem genérica, sem vazar detalhes", async () => {
    servico.gerarLinkRedefinicaoAdmin.mockRejectedValue(new Error("connection refused 10.0.0.5"));
    const r = await gerarLinkRedefinicao(7);
    expect(r).toEqual({ ok: false, mensagem: "Não foi possível gerar o link agora. Tente novamente." });
  });

  it("o log de auditoria traz só os ids, nunca o token ou o link", async () => {
    await gerarLinkRedefinicao(7);
    const log = JSON.stringify((console.info as ReturnType<typeof vi.fn>).mock.calls);
    expect(log).toContain("admin 1");
    expect(log).not.toContain("A".repeat(43));
    expect(log).not.toContain("redefinir-senha");
  });
});
