import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ createMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tentativaAcesso: banco } }));

import {
  contarTentativas,
  LIMITE_LOGIN,
  limparTentativas,
  limparTentativasAntigas,
  limparTentativasLogin,
  registrarSeDentroDoLimite,
  registrarTentativaLogin,
  registrarTentativas,
  RETENCAO_MS,
} from "./limitador";

const SEGREDO = "segredo-de-teste";
const hmac = (t: string, segredo = SEGREDO) => createHmac("sha256", segredo).update(`limitador:${t}`).digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", SEGREDO);
  banco.createMany.mockResolvedValue({ count: 1 });
  banco.count.mockResolvedValue(0);
  banco.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("chave guardada como HMAC-SHA256 com AUTH_SECRET", () => {
  it("grava uma linha por tentativa, com a chave só em HMAC", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await registrarTentativas([
      { tipo: "login", chave: "a@b.com" },
      { tipo: "exemplo-ip", chave: "203.0.113.5" },
    ]);
    expect(banco.createMany).toHaveBeenCalledTimes(1);
    expect(banco.createMany).toHaveBeenCalledWith({
      data: [
        { tipo: "login", chave: hmac("a@b.com") },
        { tipo: "exemplo-ip", chave: hmac("203.0.113.5") },
      ],
    });
    expect(banco.deleteMany).not.toHaveBeenCalled();
  });

  it("segredos diferentes dão chaves diferentes (não é um SHA-256 puro)", async () => {
    await contarTentativas("login", "a@b.com", 1000);
    vi.stubEnv("AUTH_SECRET", "outro-segredo");
    await contarTentativas("login", "a@b.com", 1000);
    const [a, b] = banco.count.mock.calls.map(([arg]) => arg.where.chave);
    expect(a).toBe(hmac("a@b.com"));
    expect(b).toBe(hmac("a@b.com", "outro-segredo"));
    expect(a).not.toBe(b);
  });

  it("sem AUTH_SECRET falha de forma clara e não toca o banco", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    await expect(contarTentativas("login", "a@b.com", 1000)).rejects.toThrow("AUTH_SECRET não configurado");
    await expect(registrarTentativas([{ tipo: "login", chave: "a@b.com" }])).rejects.toThrow("AUTH_SECRET não configurado");
    await expect(limparTentativas("login", "a@b.com")).rejects.toThrow("AUTH_SECRET não configurado");
    expect(banco.count).not.toHaveBeenCalled();
    expect(banco.createMany).not.toHaveBeenCalled();
    expect(banco.deleteMany).not.toHaveBeenCalled();
  });
});

describe("registrarTentativas", () => {
  it("não vai ao banco sem tentativas", async () => {
    await registrarTentativas([]);
    expect(banco.createMany).not.toHaveBeenCalled();
  });

  it("às vezes limpa só as linhas vencidas (mais velhas que a retenção)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const antes = Date.now();
    await registrarTentativas([{ tipo: "login", chave: "a@b.com" }]);
    const { where } = banco.deleteMany.mock.calls[0][0];
    const corte = where.criadoEm.lt.getTime();
    expect(corte).toBeLessThanOrEqual(antes - RETENCAO_MS + 1000);
    expect(corte).toBeGreaterThan(antes - RETENCAO_MS - 5000);
  });

  it("falha na limpeza não derruba o registro", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "error").mockImplementation(() => {});
    banco.deleteMany.mockRejectedValue(new Error("x"));
    await expect(registrarTentativas([{ tipo: "login", chave: "a@b.com" }])).resolves.toBeUndefined();
  });
});

describe("contarTentativas", () => {
  it("conta só as da janela, pelo tipo e pela chave com HMAC", async () => {
    banco.count.mockResolvedValue(5);
    const antes = Date.now();
    expect(await contarTentativas("login", "a@b.com", 600_000)).toBe(5);
    const { where } = banco.count.mock.calls[0][0];
    expect(where.tipo).toBe("login");
    expect(where.chave).toBe(hmac("a@b.com"));
    expect(where.criadoEm.gte.getTime()).toBeGreaterThanOrEqual(antes - 600_000);
    expect(where.criadoEm.gte.getTime()).toBeLessThanOrEqual(Date.now() - 600_000 + 1);
  });
});

describe("limpeza", () => {
  it("limparTentativas apaga as do tipo/chave", async () => {
    await limparTentativas("login", "a@b.com");
    expect(banco.deleteMany).toHaveBeenCalledWith({ where: { tipo: "login", chave: hmac("a@b.com") } });
  });

  it("limparTentativasAntigas apaga só o que passou da retenção", async () => {
    await limparTentativasAntigas();
    expect(banco.deleteMany.mock.calls[0][0].where.criadoEm.lt).toBeInstanceOf(Date);
  });
});

describe("registrarSeDentroDoLimite (conta primeiro, só grava se ainda couber)", () => {
  const porEmail = { tipo: "exemplo-email", max: 3, janelaMs: 3_600_000 };
  const porIp = { tipo: "exemplo-ip", max: 10, janelaMs: 3_600_000 };
  const itens = [
    { limite: porEmail, chave: "a@b.com" },
    { limite: porIp, chave: "203.0.113.5" },
  ];

  it("com folga em todos, grava uma tentativa por limite e devolve true", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    banco.count.mockResolvedValue(2);
    expect(await registrarSeDentroDoLimite(itens)).toBe(true);
    expect(banco.createMany).toHaveBeenCalledWith({
      data: [
        { tipo: "exemplo-email", chave: hmac("a@b.com") },
        { tipo: "exemplo-ip", chave: hmac("203.0.113.5") },
      ],
    });
  });

  it("a última tentativa permitida passa (max - 1 existentes) e a seguinte (max existentes) é barrada", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    banco.count.mockResolvedValue(2);
    expect(await registrarSeDentroDoLimite([itens[0]])).toBe(true);
    banco.createMany.mockClear();
    banco.count.mockResolvedValue(3);
    expect(await registrarSeDentroDoLimite([itens[0]])).toBe(false);
    expect(banco.createMany).not.toHaveBeenCalled();
  });

  it("se QUALQUER limite estourou, não grava nada (o bloqueio expira sozinho, a tabela não cresce)", async () => {
    banco.count.mockImplementation(async ({ where }: { where: { tipo: string } }) => (where.tipo === "exemplo-ip" ? 10 : 0));
    expect(await registrarSeDentroDoLimite(itens)).toBe(false);
    expect(banco.createMany).not.toHaveBeenCalled();
    expect(banco.deleteMany).not.toHaveBeenCalled();
  });

  it("conta cada limite com a sua própria janela", async () => {
    await registrarSeDentroDoLimite([
      { limite: { tipo: "x", max: 1, janelaMs: 60_000 }, chave: "k" },
      { limite: { tipo: "y", max: 1, janelaMs: 3_600_000 }, chave: "k" },
    ]);
    const janelas = Object.fromEntries(
      banco.count.mock.calls.map(([{ where }]) => [where.tipo, Math.round((Date.now() - where.criadoEm.gte.getTime()) / 1000)]),
    );
    expect(janelas.x).toBeGreaterThanOrEqual(59);
    expect(janelas.x).toBeLessThanOrEqual(61);
    expect(janelas.y).toBeGreaterThanOrEqual(3599);
    expect(janelas.y).toBeLessThanOrEqual(3601);
  });

  it("sem itens, devolve true e não vai ao banco", async () => {
    expect(await registrarSeDentroDoLimite([])).toBe(true);
    expect(banco.createMany).not.toHaveBeenCalled();
  });
});

describe("limite do login (8 tentativas em 10 minutos, por e-mail)", () => {
  it("regra e janela", () => {
    expect(LIMITE_LOGIN).toEqual({ tipo: "login", max: 8, janelaMs: 600_000 });
  });

  it("aceita com 7 tentativas na janela e bloqueia com 8", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    banco.count.mockResolvedValue(7);
    expect(await registrarTentativaLogin("a@b.com")).toBe(true);
    expect(banco.createMany).toHaveBeenCalledWith({ data: [{ tipo: "login", chave: hmac("a@b.com") }] });
    banco.createMany.mockClear();
    banco.count.mockResolvedValue(8);
    expect(await registrarTentativaLogin("a@b.com")).toBe(false);
    expect(banco.createMany).not.toHaveBeenCalled();
  });

  it("limparTentativasLogin apaga o tipo 'login' da chave", async () => {
    await limparTentativasLogin("a@b.com");
    expect(banco.deleteMany).toHaveBeenCalledWith({ where: { tipo: "login", chave: hmac("a@b.com") } });
  });
});
