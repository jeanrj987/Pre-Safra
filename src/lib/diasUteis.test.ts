import { describe, expect, it } from "vitest";
import { hojeIso, motivoDataIndisponivel, motivoDataPassada, motivoDiaBloqueado, nomeDoFeriado } from "./diasUteis";

describe("motivoDiaBloqueado", () => {
  it("bloqueia sábado e domingo", () => {
    expect(motivoDiaBloqueado("2026-10-03")).toMatch(/sábado/);
    expect(motivoDiaBloqueado("2026-10-04")).toMatch(/domingo/);
  });
  it("libera dia útil comum", () => {
    expect(motivoDiaBloqueado("2026-10-01")).toBeNull();
    expect(motivoDiaBloqueado("2026-10-05")).toBeNull();
  });
  it("bloqueia feriado nacional fixo em dia útil", () => {
    expect(motivoDiaBloqueado("2026-09-07")).toMatch(/Independência/); // segunda
    expect(motivoDiaBloqueado("2026-11-20")).toMatch(/Consciência Negra/); // sexta
    expect(motivoDiaBloqueado("2026-12-25")).toMatch(/Natal/); // sexta
  });
  it("ignora valor vazio ou inválido (quem decide é outra validação)", () => {
    expect(motivoDiaBloqueado("")).toBeNull();
    expect(motivoDiaBloqueado("2026-02-31")).toBeNull();
  });
});

describe("nomeDoFeriado — feriados móveis", () => {
  it("calcula a partir da Páscoa (2026: 5 de abril)", () => {
    expect(nomeDoFeriado("2026-02-16")).toBe("Carnaval");
    expect(nomeDoFeriado("2026-02-17")).toBe("Carnaval");
    expect(nomeDoFeriado("2026-04-03")).toBe("Sexta-feira Santa");
    expect(nomeDoFeriado("2026-06-04")).toBe("Corpus Christi");
  });
  it("calcula a Páscoa de outro ano (2027: 28 de março)", () => {
    expect(nomeDoFeriado("2027-03-26")).toBe("Sexta-feira Santa");
  });
  it("não marca dia comum", () => {
    expect(nomeDoFeriado("2026-04-06")).toBeNull();
  });
});

describe("data passada", () => {
  // 12h em Brasília (15h UTC): ainda é o mesmo dia no Brasil.
  const agora = new Date("2026-10-06T15:00:00Z");

  it("recusa dia anterior a hoje, mas aceita hoje e o futuro", () => {
    expect(motivoDataPassada("2026-10-05", agora)).toMatch(/já passou/);
    expect(motivoDataPassada("2026-10-06", agora)).toBeNull();
    expect(motivoDataPassada("2026-10-07", agora)).toBeNull();
  });
  it("usa o dia do Brasil, não o do servidor em UTC", () => {
    // 01h UTC de 07/10 ainda é 22h de 06/10 em Brasília.
    const virada = new Date("2026-10-07T01:00:00Z");
    expect(hojeIso(virada)).toBe("2026-10-06");
    expect(motivoDataPassada("2026-10-06", virada)).toBeNull();
  });
  it("ignora valor vazio ou inválido", () => {
    expect(motivoDataPassada("", agora)).toBeNull();
    expect(motivoDataPassada("2026-02-31", agora)).toBeNull();
  });
  it("junta com sábado, domingo e feriado", () => {
    expect(motivoDataIndisponivel("2026-10-03", agora)).toMatch(/já passou/);
    expect(motivoDataIndisponivel("2026-10-10", agora)).toMatch(/sábado/);
    expect(motivoDataIndisponivel("2026-10-08", agora)).toBeNull();
  });
});
