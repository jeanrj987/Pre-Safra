import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({
  usuario: { findUnique: vi.fn() },
  tokenRecuperacao: { updateMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: banco }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import {
  gerarLinkRedefinicaoAdmin,
  LIMITE_LINK_ADMIN,
  MENSAGEM_APP_URL,
  VALIDADE_LINK_ADMIN_MS,
} from "./recuperacao-admin";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const usuarioAtivo = { id: 7, nome: "Maria da Silva", ativo: true, somentePainel: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("APP_URL", "https://app.exemplo.com/");
  banco.usuario.findUnique.mockResolvedValue(usuarioAtivo);
  banco.tokenRecuperacao.updateMany.mockReturnValue(Promise.resolve({ count: 1 }));
  banco.tokenRecuperacao.create.mockReturnValue(Promise.resolve({}));
  banco.$transaction.mockImplementation(async (arg: unknown) => Promise.all(arg as Promise<unknown>[]));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("gerarLinkRedefinicaoAdmin", () => {
  it("sucesso: devolve o link com fragmento e token de 43 caracteres base64url", async () => {
    const r = await gerarLinkRedefinicaoAdmin(7);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.link).toMatch(/^https:\/\/app\.exemplo\.com\/redefinir-senha#token=[A-Za-z0-9_-]{43}$/);
  });

  it("grava só o SHA-256 do token (nunca o token em claro)", async () => {
    const r = await gerarLinkRedefinicaoAdmin(7);
    if (!r.ok) throw new Error("esperava sucesso");
    const token = r.link.split("#token=")[1];
    const { data } = banco.tokenRecuperacao.create.mock.calls[0][0];
    expect(data.tokenHash).toBe(sha(token));
    expect(JSON.stringify(banco.tokenRecuperacao.create.mock.calls)).not.toContain(token);
    expect(data.usuarioId).toBe(7);
  });

  it("vale por 24 horas", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    try {
      await gerarLinkRedefinicaoAdmin(7);
      const { data } = banco.tokenRecuperacao.create.mock.calls[0][0];
      expect(VALIDADE_LINK_ADMIN_MS).toBe(24 * 60 * 60 * 1000);
      expect(data.expiraEm).toEqual(new Date("2026-01-11T12:00:00Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("invalida os links pendentes anteriores do usuário na mesma transação", async () => {
    await gerarLinkRedefinicaoAdmin(7);
    expect(banco.$transaction).toHaveBeenCalledTimes(1);
    expect(banco.tokenRecuperacao.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 7, usadoEm: null },
      data: { usadoEm: expect.any(Date) },
    });
    expect((banco.$transaction.mock.calls[0][0] as unknown[]).length).toBe(2);
  });

  it("o updateMany que invalida os anteriores acontece ANTES do create", async () => {
    await gerarLinkRedefinicaoAdmin(7);
    const [invalidar] = banco.tokenRecuperacao.updateMany.mock.invocationCallOrder;
    const [criar] = banco.tokenRecuperacao.create.mock.invocationCallOrder;
    expect(invalidar).toBeLessThan(criar);
    // E a ordem do array entregue à transação é a mesma (o Prisma a executa nessa ordem).
    expect((banco.$transaction.mock.calls[0][0] as unknown[]).length).toBe(2);
  });

  it("dois links seguidos têm tokens diferentes", async () => {
    const a = await gerarLinkRedefinicaoAdmin(7);
    const b = await gerarLinkRedefinicaoAdmin(7);
    expect(a).not.toEqual(b);
  });

  it("usuário inexistente: erro claro e nada gravado", async () => {
    banco.usuario.findUnique.mockResolvedValue(null);
    expect(await gerarLinkRedefinicaoAdmin(99)).toEqual({ ok: false, mensagem: "Usuário não encontrado." });
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it("usuário inativo: recusa, sem gravar nem cancelar links", async () => {
    banco.usuario.findUnique.mockResolvedValue({ ...usuarioAtivo, ativo: false });
    const r = await gerarLinkRedefinicaoAdmin(7);
    expect(r).toEqual({ ok: false, mensagem: expect.stringContaining("inativo") });
    expect(banco.$transaction).not.toHaveBeenCalled();
    expect(banco.tokenRecuperacao.updateMany).not.toHaveBeenCalled();
  });

  it("usuário só do Painel: recusa", async () => {
    banco.usuario.findUnique.mockResolvedValue({ ...usuarioAtivo, somentePainel: true });
    const r = await gerarLinkRedefinicaoAdmin(7);
    expect(r).toEqual({
      ok: false,
      mensagem: 'Contas do papel Painel (TV) não usam link de redefinição. Use "Redefinir senha".',
    });
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it.each([[""], ["não é url"], ["ftp://x.com"]])("APP_URL inválida ou ausente (%j): pede para configurar, sem tocar no banco", async (valor) => {
    vi.stubEnv("APP_URL", valor);
    const r = await gerarLinkRedefinicaoAdmin(7);
    expect(r).toEqual({ ok: false, mensagem: MENSAGEM_APP_URL });
    expect(MENSAGEM_APP_URL).toContain("APP_URL");
    expect(banco.usuario.findUnique).not.toHaveBeenCalled();
    expect(banco.$transaction).not.toHaveBeenCalled();
  });

  it("em produção, APP_URL com http:// é recusada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://app.exemplo.com");
    expect(await gerarLinkRedefinicaoAdmin(7)).toEqual({ ok: false, mensagem: MENSAGEM_APP_URL });
  });

  it("não escreve o token no log", async () => {
    const espioes = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "error"), vi.spyOn(console, "warn")];
    const r = await gerarLinkRedefinicaoAdmin(7);
    if (!r.ok) throw new Error("esperava sucesso");
    const token = r.link.split("#token=")[1];
    for (const e of espioes) expect(JSON.stringify(e.mock.calls)).not.toContain(token);
  });
});

describe("LIMITE_LINK_ADMIN", () => {
  it("20 por hora por usuário-alvo", () => {
    expect(LIMITE_LINK_ADMIN).toMatchObject({ max: 20, janelaMs: 60 * 60 * 1000 });
  });
});
