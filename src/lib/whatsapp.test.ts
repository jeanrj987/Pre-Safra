import { describe, expect, it } from "vitest";
import { formatarWhatsapp, linkWhatsapp, mascararWhatsapp, normalizarWhatsapp } from "./whatsapp";

describe("normalizarWhatsapp", () => {
  it("aceita formatos comuns de digitação", () => {
    expect(normalizarWhatsapp("(66) 99999-8888")).toBe("5566999998888");
    expect(normalizarWhatsapp("66999998888")).toBe("5566999998888");
    expect(normalizarWhatsapp("+55 66 99999-8888")).toBe("5566999998888");
    expect(normalizarWhatsapp("55 (66) 99999-8888")).toBe("5566999998888");
  });
  it("aceita telefone fixo de 8 dígitos", () => {
    expect(normalizarWhatsapp("(65) 3321-4455")).toBe("556533214455");
  });
  it("não confunde DDD 55 (RS) com o DDI", () => {
    expect(normalizarWhatsapp("55 99999-8888")).toBe("5555999998888");
  });
  it("rejeita números incompletos, com DDD inválido ou celular sem o 9", () => {
    expect(normalizarWhatsapp("")).toBeNull();
    expect(normalizarWhatsapp("99998888")).toBeNull();
    expect(normalizarWhatsapp("(06) 99999-8888")).toBeNull();
    expect(normalizarWhatsapp("(10) 99999-8888")).toBeNull();
    expect(normalizarWhatsapp("(66) 89999-8888")).toBeNull();
    expect(normalizarWhatsapp("+1 415 555 2671")).toBeNull();
  });
  it("rejeita sequências repetidas de teste", () => {
    expect(normalizarWhatsapp("11111111111")).toBeNull();
    expect(normalizarWhatsapp("99999999999")).toBeNull();
  });
});

describe("formatarWhatsapp / linkWhatsapp", () => {
  it("formata celular e fixo", () => {
    expect(formatarWhatsapp("5566999998888")).toBe("(66) 99999-8888");
    expect(formatarWhatsapp("556533214455")).toBe("(65) 3321-4455");
  });
  it("monta o link wa.me", () => {
    expect(linkWhatsapp("5566999998888")).toBe("https://wa.me/5566999998888");
  });
});

describe("mascararWhatsapp", () => {
  it("aplica a máscara enquanto digita", () => {
    expect(mascararWhatsapp("")).toBe("");
    expect(mascararWhatsapp("6")).toBe("(6");
    expect(mascararWhatsapp("66")).toBe("(66");
    expect(mascararWhatsapp("669960")).toBe("(66) 9960");
    expect(mascararWhatsapp("66996060269")).toBe("(66) 99606-0269");
    expect(mascararWhatsapp("6633214455")).toBe("(66) 3321-4455");
  });
  it("aceita número colado com DDI, parênteses e traços", () => {
    expect(mascararWhatsapp("+55 (66) 99606-0269")).toBe("(66) 99606-0269");
  });
  it("não passa de 11 dígitos", () => {
    expect(mascararWhatsapp("669960602699999")).toBe("(66) 99606-0269");
  });
});
