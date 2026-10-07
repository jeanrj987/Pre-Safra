import { describe, expect, it } from "vitest";
import {
  chaveMes,
  mesDe,
  mesVizinho,
  motivoDataAtividade,
  motivoHorarioAtividade,
  proximoDiaLivre,
  semanasDoMes,
} from "./calendario";

describe("mesDe", () => {
  it("usa o mês da URL quando é válido", () => {
    expect(mesDe("2026-11", "2026-10-07")).toEqual({ ano: 2026, mes: 11 });
  });
  it("cai no mês de hoje quando falta ou é inválido", () => {
    expect(mesDe(undefined, "2026-10-07")).toEqual({ ano: 2026, mes: 10 });
    expect(mesDe("2026-13", "2026-10-07")).toEqual({ ano: 2026, mes: 10 });
    expect(mesDe("abc", "2026-10-07")).toEqual({ ano: 2026, mes: 10 });
    expect(mesDe("0002-05", "2026-10-07")).toEqual({ ano: 2026, mes: 10 });
  });
});

describe("mesVizinho", () => {
  it("passa de dezembro para janeiro e vice-versa", () => {
    expect(mesVizinho({ ano: 2026, mes: 12 }, 1)).toEqual({ ano: 2027, mes: 1 });
    expect(mesVizinho({ ano: 2026, mes: 1 }, -1)).toEqual({ ano: 2025, mes: 12 });
    expect(mesVizinho({ ano: 2026, mes: 10 }, 1)).toEqual({ ano: 2026, mes: 11 });
  });
  it("chaveMes tem sempre dois dígitos no mês", () => {
    expect(chaveMes({ ano: 2026, mes: 3 })).toBe("2026-03");
  });
});

describe("semanasDoMes", () => {
  it("outubro de 2026 começa na quinta: a grade abre no domingo 27/09 e fecha no sábado 31/10", () => {
    const semanas = semanasDoMes({ ano: 2026, mes: 10 });
    expect(semanas).toHaveLength(5);
    expect(semanas[0][0]).toBe("2026-09-27");
    expect(semanas[0][4]).toBe("2026-10-01");
    expect(semanas[4][6]).toBe("2026-10-31");
  });
  it("mês que começa no domingo não ganha dias do mês anterior", () => {
    const semanas = semanasDoMes({ ano: 2026, mes: 3 }); // 1º de março de 2026 é domingo
    expect(semanas[0][0]).toBe("2026-03-01");
  });
  it("toda semana tem 7 dias", () => {
    for (let mes = 1; mes <= 12; mes++) {
      for (const semana of semanasDoMes({ ano: 2026, mes })) expect(semana).toHaveLength(7);
    }
  });
});

// Quarta-feira, 7/10/2026, 11:00 em Mato Grosso (15:00 UTC). 12/10 (segunda) é feriado.
const agora = new Date("2026-10-07T15:00:00Z");

describe("motivoDataAtividade (mesmas regras do agendamento de clientes)", () => {
  it("exige a data", () => {
    expect(motivoDataAtividade("")).toBe("Informe a data.");
  });
  it("libera dia útil de hoje em diante", () => {
    expect(motivoDataAtividade("2026-10-07", undefined, agora)).toBeNull();
    expect(motivoDataAtividade("2026-10-08", undefined, agora)).toBeNull();
  });
  it("barra data passada, fim de semana, feriado, data distante e data inexistente", () => {
    expect(motivoDataAtividade("2026-10-06", undefined, agora)).toMatch(/retroativa/);
    expect(motivoDataAtividade("2026-10-10", undefined, agora)).toMatch(/sábado/);
    expect(motivoDataAtividade("2026-10-11", undefined, agora)).toMatch(/domingo/);
    expect(motivoDataAtividade("2026-10-12", undefined, agora)).toMatch(/feriado/);
    expect(motivoDataAtividade("2028-01-03", undefined, agora)).toMatch(/um ano/);
    expect(motivoDataAtividade("2026-02-31", undefined, agora)).toMatch(/válida/);
  });
  it("não barra de novo a data que já estava salva, mas barra se ela mudou", () => {
    expect(motivoDataAtividade("2026-10-06", "2026-10-06", agora)).toBeNull();
    expect(motivoDataAtividade("2026-10-05", "2026-10-06", agora)).toMatch(/retroativa/);
  });
});

describe("motivoHorarioAtividade", () => {
  it("exige o horário", () => {
    expect(motivoHorarioAtividade("2026-10-08", "", undefined, agora)).toBe("Informe o horário.");
  });
  it("aceita qualquer hh:mm do dia, não só a grade de hora em hora", () => {
    expect(motivoHorarioAtividade("2026-10-08", "09:00", undefined, agora)).toBeNull();
    expect(motivoHorarioAtividade("2026-10-08", "09:30", undefined, agora)).toBeNull();
    expect(motivoHorarioAtividade("2026-10-08", "14:45", undefined, agora)).toBeNull();
    expect(motivoHorarioAtividade("2026-10-08", "23:59", undefined, agora)).toBeNull();
  });
  it("recusa horário que não existe", () => {
    for (const h of ["24:00", "09:60", "7:30", "09h30", "abc"]) {
      expect(motivoHorarioAtividade("2026-10-08", h, undefined, agora)).toMatch(/válido/);
    }
  });
  it("hoje só vale de agora em diante", () => {
    expect(motivoHorarioAtividade("2026-10-07", "09:00", undefined, agora)).toMatch(/retroativo/);
    expect(motivoHorarioAtividade("2026-10-07", "13:00", undefined, agora)).toBeNull();
    expect(motivoHorarioAtividade("2026-10-07", "10:59", undefined, agora)).toMatch(/retroativo/);
    expect(motivoHorarioAtividade("2026-10-07", "11:30", undefined, agora)).toBeNull();
  });
  it("não barra de novo o horário que já estava salvo, mas barra se a data ou o horário mudou", () => {
    const original = { data: "2026-10-07", horario: "09:00" };
    expect(motivoHorarioAtividade("2026-10-07", "09:00", original, agora)).toBeNull();
    expect(motivoHorarioAtividade("2026-10-07", "08:00", original, agora)).toMatch(/retroativo/);
    expect(motivoHorarioAtividade("2026-10-07", "09:00", { data: "2026-10-06", horario: "09:00" }, agora)).toMatch(/retroativo/);
  });
});

describe("proximoDiaLivre", () => {
  it("devolve o próprio dia quando ele está livre", () => {
    expect(proximoDiaLivre("2026-10-07", agora)).toBe("2026-10-07");
  });
  it("pula fim de semana e feriado", () => {
    expect(proximoDiaLivre("2026-10-10", agora)).toBe("2026-10-13"); // sáb, dom e o feriado de segunda
  });
});
