import { beforeEach, describe, expect, it, vi } from "vitest";

const recuperacao = vi.hoisted(() => ({ redefinirComToken: vi.fn(), validarToken: vi.fn() }));
const ipCliente = vi.hoisted(() => ({ ipDoCliente: vi.fn() }));

vi.mock("@/lib/recuperacao", () => recuperacao);
vi.mock("@/lib/ip-cliente", () => ipCliente);

import { redefinirSenhaAcao, validarLinkAcao } from "./acoes";

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  recuperacao.redefinirComToken.mockResolvedValue({ ok: true });
  recuperacao.validarToken.mockResolvedValue("valido");
  ipCliente.ipDoCliente.mockResolvedValue("203.0.113.5");
});

describe("redefinirSenhaAcao", () => {
  it("sucesso: repassa token, senha, confirmação e IP e devolve a mensagem de sucesso", async () => {
    const r = await redefinirSenhaAcao(null, form({ token: "T", senha: "uma-senha-longa", confirmacao: "uma-senha-longa" }));
    expect(r).toEqual({ ok: true, mensagem: "Senha alterada. Entre com a nova senha." });
    expect(recuperacao.redefinirComToken).toHaveBeenCalledWith("T", "uma-senha-longa", "uma-senha-longa", "203.0.113.5");
  });

  it("repassa o erro do serviço (política de senha, limite...) sem alterá-lo", async () => {
    recuperacao.redefinirComToken.mockResolvedValue({ ok: false, mensagem: "A senha precisa ter pelo menos 10 caracteres." });
    expect(await redefinirSenhaAcao(null, form({ token: "T", senha: "curta", confirmacao: "curta" }))).toEqual({
      ok: false,
      mensagem: "A senha precisa ter pelo menos 10 caracteres.",
    });
  });

  it("link inválido: repassa a mensagem e marca linkInvalido para a tela mandar procurar o administrador", async () => {
    recuperacao.redefinirComToken.mockResolvedValue({
      ok: false,
      mensagem: "Link inválido ou expirado. Peça ao administrador um novo link.",
      linkInvalido: true,
    });
    expect(await redefinirSenhaAcao(null, form({ token: "T", senha: "x", confirmacao: "x" }))).toEqual({
      ok: false,
      mensagem: "Link inválido ou expirado. Peça ao administrador um novo link.",
      linkInvalido: true,
    });
  });

  it("os erros comuns não trazem linkInvalido", async () => {
    recuperacao.redefinirComToken.mockResolvedValue({ ok: false, mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    const r = await redefinirSenhaAcao(null, form({ token: "T", senha: "x", confirmacao: "x" }));
    expect(r).toEqual({ ok: false, mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    expect(r).not.toHaveProperty("linkInvalido");
  });

  it("campos ausentes viram texto vazio (nunca quebram)", async () => {
    await redefinirSenhaAcao(null, new FormData());
    expect(recuperacao.redefinirComToken).toHaveBeenCalledWith("", "", "", "203.0.113.5");
  });
});

describe("validarLinkAcao", () => {
  it("repassa o veredito do serviço com o IP", async () => {
    recuperacao.validarToken.mockResolvedValue("limitado");
    expect(await validarLinkAcao("T")).toBe("limitado");
    expect(recuperacao.validarToken).toHaveBeenCalledWith("T", "203.0.113.5");
  });

  it("token que não é texto: inválido, sem consultar o serviço", async () => {
    expect(await validarLinkAcao(123 as unknown as string)).toBe("invalido");
    expect(recuperacao.validarToken).not.toHaveBeenCalled();
  });
});
