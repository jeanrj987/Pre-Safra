import { afterEach, describe, expect, it, vi } from "vitest";
import { emailSistemaConfigurado, enviarEmailSistema } from "./sistema";

const completo = { RESEND_API_KEY: "re_x", EMAIL_REMETENTE: "Pré-Safra <avisos@exemplo.com>" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("emailSistemaConfigurado", () => {
  it("com RESEND_API_KEY e EMAIL_REMETENTE: configurado", () => {
    expect(emailSistemaConfigurado(completo)).toBe(true);
  });

  it.each(["RESEND_API_KEY", "EMAIL_REMETENTE"])("sem %s (ausente ou vazio): não configurado", (chave) => {
    expect(emailSistemaConfigurado({ ...completo, [chave]: undefined })).toBe(false);
    expect(emailSistemaConfigurado({ ...completo, [chave]: "" })).toBe(false);
  });

  it("lê process.env por padrão", () => {
    vi.stubEnv("RESEND_API_KEY", "re_x");
    vi.stubEnv("EMAIL_REMETENTE", "a@b.com");
    expect(emailSistemaConfigurado()).toBe(true);
    vi.stubEnv("EMAIL_REMETENTE", "");
    expect(emailSistemaConfigurado()).toBe(false);
  });
});

describe("enviarEmailSistema", () => {
  it("não configurado: devolve false sem lançar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await enviarEmailSistema("a@b.com", { assunto: "x", texto: "y" }, {})).toBe(false);
  });
});
