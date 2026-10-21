import { describe, expect, it } from "vitest";
import { dataMinimaIso, erroDataPrevista, inicioDoAgendamento } from "./dataPrevista";

// Quarta-feira, meio-dia em Mato Grosso (UTC-4).
const AGORA = new Date("2026-10-21T16:00:00Z");

describe("inicioDoAgendamento", () => {
  it("usa o dia do agendamento no fuso de Mato Grosso", () => {
    // 01:00 UTC ainda é o dia anterior em Mato Grosso.
    expect(inicioDoAgendamento(new Date("2026-10-15T01:00:00Z"), new Date("2026-09-01T00:00:00Z"))).toBe("2026-10-14");
  });
  it("sem agendamento, usa o início da safra", () => {
    expect(inicioDoAgendamento(null, new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01");
  });
});

describe("dataMinimaIso", () => {
  it("é hoje quando o início já passou", () => {
    expect(dataMinimaIso("2026-09-01", AGORA)).toBe("2026-10-21");
  });
  it("é o início quando ele ainda não chegou", () => {
    expect(dataMinimaIso("2026-11-02", AGORA)).toBe("2026-11-02");
  });
});

describe("erroDataPrevista", () => {
  it("aceita um dia útil depois do início", () => {
    expect(erroDataPrevista("2026-10-23", "2026-10-15", AGORA)).toBeNull();
  });
  it("aceita o próprio dia do início quando ele é hoje", () => {
    expect(erroDataPrevista("2026-10-21", "2026-10-21", AGORA)).toBeNull();
  });
  it("recusa data anterior ao início", () => {
    expect(erroDataPrevista("2026-11-02", "2026-11-03", AGORA)).toBe("anterior");
  });
  it("recusa data que não existe ou está mal formada", () => {
    expect(erroDataPrevista("2026-02-31", "2026-01-01", AGORA)).toBe("invalida");
    expect(erroDataPrevista("", "2026-01-01", AGORA)).toBe("invalida");
    expect(erroDataPrevista("21/10/2026", "2026-01-01", AGORA)).toBe("invalida");
  });
  it("recusa data retroativa, distante, fim de semana e feriado", () => {
    expect(erroDataPrevista("2026-10-20", "2026-10-01", AGORA)).toBe("passada");
    expect(erroDataPrevista("2028-01-03", "2026-10-01", AGORA)).toBe("distante");
    expect(erroDataPrevista("2026-10-24", "2026-10-01", AGORA)).toBe("bloqueada"); // sábado
    expect(erroDataPrevista("2026-11-20", "2026-10-01", AGORA)).toBe("bloqueada"); // Consciência Negra
  });
});
