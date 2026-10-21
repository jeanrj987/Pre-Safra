import { describe, expect, it } from "vitest";
import { normalizarEmail } from "./email";

describe("normalizarEmail", () => {
  it("aceita e limpa e-mails comuns", () => {
    expect(normalizarEmail("  Fulano@Fazenda.com.br ")).toBe("fulano@fazenda.com.br");
    expect(normalizarEmail("a.b+c@dominio.com")).toBe("a.b+c@dominio.com");
  });
  it("recusa o que não parece e-mail", () => {
    expect(normalizarEmail("")).toBeNull();
    expect(normalizarEmail("semarroba.com")).toBeNull();
    expect(normalizarEmail("a@b")).toBeNull();
    expect(normalizarEmail("a b@c.com")).toBeNull();
    expect(normalizarEmail("a@@c.com")).toBeNull();
    expect(normalizarEmail("a@c..com")).toBeNull();
  });
});
