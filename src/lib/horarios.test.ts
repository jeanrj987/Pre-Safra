import { describe, expect, it } from "vitest";
import { HORARIOS, horarioValido } from "./horarios";

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
