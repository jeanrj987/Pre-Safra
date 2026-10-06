import { describe, expect, it } from "vitest";
import { HORARIOS, horaAgora, horarioValido, motivoHorarioPassado } from "./horarios";

describe("horários de agendamento", () => {
  it("vai das 07:00 às 17:00, de 1 em 1 hora", () => {
    expect(HORARIOS[0]).toBe("07:00");
    expect(HORARIOS.at(-1)).toBe("17:00");
    expect(HORARIOS).toHaveLength(11);
  });

  it("só aceita horários da grade", () => {
    expect(horarioValido("09:00")).toBe(true);
    expect(horarioValido("09:30")).toBe(false);
    expect(horarioValido("18:00")).toBe(false);
    expect(horarioValido("")).toBe(false);
    expect(horarioValido(null)).toBe(false);
  });
});

describe("horário que já passou", () => {
  // 13:30 em Mato Grosso (UTC-4) = 17:30 UTC.
  const agora = new Date("2026-10-06T17:30:00Z");

  it("lê a hora no fuso de Mato Grosso", () => {
    expect(horaAgora(agora)).toBe("13:30");
    expect(horaAgora(new Date("2026-10-06T03:05:00Z"))).toBe("23:05");
  });
  it("hoje: recusa horário anterior ao atual e aceita os seguintes", () => {
    expect(motivoHorarioPassado("2026-10-06", "12:00", agora)).toMatch(/retroativo/);
    expect(motivoHorarioPassado("2026-10-06", "13:00", agora)).toMatch(/retroativo/);
    expect(motivoHorarioPassado("2026-10-06", "14:00", agora)).toBeNull();
  });
  it("dia futuro aceita qualquer horário da grade", () => {
    expect(motivoHorarioPassado("2026-10-07", "07:00", agora)).toBeNull();
  });
  it("sem data ou sem horário não há o que validar", () => {
    expect(motivoHorarioPassado("", "12:00", agora)).toBeNull();
    expect(motivoHorarioPassado("2026-10-06", "", agora)).toBeNull();
  });
});
