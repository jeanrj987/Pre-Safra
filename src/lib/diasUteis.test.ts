import { describe, expect, it } from "vitest";
import { motivoDiaBloqueado, nomeDoFeriado } from "./diasUteis";

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
