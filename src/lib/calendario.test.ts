import { describe, expect, it } from "vitest";
import {
  agendamentosDoCalendario,
  chaveMes,
  mesDe,
  mesVizinho,
  motivoDataAtividade,
  motivoHorarioAtividade,
  podeAlterarAtividade,
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

describe("motivoDataAtividade (como o agendamento de clientes, mas aceita fim de semana e feriado)", () => {
  it("exige a data", () => {
    expect(motivoDataAtividade("")).toBe("Informe a data.");
  });
  it("libera de hoje em diante", () => {
    expect(motivoDataAtividade("2026-10-07", undefined, agora)).toBeNull();
    expect(motivoDataAtividade("2026-10-08", undefined, agora)).toBeNull();
  });
  it("libera sábado, domingo e feriado", () => {
    expect(motivoDataAtividade("2026-10-10", undefined, agora)).toBeNull();
    expect(motivoDataAtividade("2026-10-11", undefined, agora)).toBeNull();
    expect(motivoDataAtividade("2026-10-12", undefined, agora)).toBeNull();
  });
  it("barra data passada, data distante e data inexistente", () => {
    expect(motivoDataAtividade("2026-10-06", undefined, agora)).toMatch(/retroativa/);
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

describe("agendamentosDoCalendario", () => {
  const base = {
    nome: "Cliente",
    horario: null,
    formato: null,
    configuradoSistema: false,
    inativo: false,
    responsavel: null,
  };
  const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it("mostra agendados (online e presencial), atrasados e finalizados, cada um com o seu status", () => {
    const lista = agendamentosDoCalendario(
      [
        { ...base, id: 1, dataPrevista: dia("2026-10-08"), formato: "Online" },
        { ...base, id: 2, dataPrevista: dia("2026-10-09"), formato: "Presencial" },
        { ...base, id: 3, dataPrevista: dia("2026-10-05") }, // data passada, sem finalizar
        { ...base, id: 4, dataPrevista: dia("2026-10-02"), formato: "Online", configuradoSistema: true },
      ],
      agora,
    );
    expect(lista.map((a) => [a.id, a.status])).toEqual([
      [4, "Finalizado"],
      [3, "Atrasado"],
      [1, "Agendado Online"],
      [2, "Agendado Presencial"],
    ]);
  });

  it("não mostra A Fazer, inativos nem clientes sem data", () => {
    const lista = agendamentosDoCalendario(
      [
        { ...base, id: 1, dataPrevista: dia("2026-10-08") }, // com data mas sem formato: A Fazer
        { ...base, id: 2, dataPrevista: dia("2026-10-08"), formato: "Online", inativo: true },
        { ...base, id: 3, dataPrevista: null, formato: "Online" },
        { ...base, id: 4, dataPrevista: null, configuradoSistema: true },
      ],
      agora,
    );
    expect(lista).toEqual([]);
  });

  it("agendado para hoje continua agendado; vira atrasado só no dia seguinte", () => {
    const [hoje] = agendamentosDoCalendario([{ ...base, id: 1, dataPrevista: dia("2026-10-07"), formato: "Online" }], agora);
    expect(hoje.status).toBe("Agendado Online");
    const [amanha] = agendamentosDoCalendario(
      [{ ...base, id: 1, dataPrevista: dia("2026-10-07"), formato: "Online" }],
      new Date("2026-10-08T15:00:00Z"),
    );
    expect(amanha.status).toBe("Atrasado");
  });

  it("ordena por data, depois horário (sem horário primeiro) e nome", () => {
    const lista = agendamentosDoCalendario(
      [
        { ...base, id: 1, nome: "B", dataPrevista: dia("2026-10-08"), horario: "09:00", formato: "Online" },
        { ...base, id: 2, nome: "A", dataPrevista: dia("2026-10-08"), horario: "08:00", formato: "Online" },
        { ...base, id: 3, nome: "C", dataPrevista: dia("2026-10-08"), horario: null, formato: "Online" },
        { ...base, id: 4, nome: "D", dataPrevista: dia("2026-10-07"), horario: "16:00", formato: "Online" },
      ],
      agora,
    );
    expect(lista.map((a) => a.id)).toEqual([4, 3, 2, 1]);
  });
});

describe("podeAlterarAtividade", () => {
  const maria = { id: 1, nome: "Maria", admin: false };
  const admin = { id: 9, nome: "Chefe", admin: true };

  it("o dono altera a própria atividade", () => {
    expect(podeAlterarAtividade(maria, { criadoPorId: 1, criadoPor: "Maria" })).toBe(true);
  });
  it("outro usuário comum não altera a atividade do colega", () => {
    expect(podeAlterarAtividade(maria, { criadoPorId: 2, criadoPor: "Jean" })).toBe(false);
  });
  it("o admin altera a de qualquer pessoa", () => {
    expect(podeAlterarAtividade(admin, { criadoPorId: 2, criadoPor: "Jean" })).toBe(true);
    expect(podeAlterarAtividade(admin, { criadoPorId: null, criadoPor: null })).toBe(true);
  });
  it("com o id do dono gravado, o nome igual não basta", () => {
    expect(podeAlterarAtividade(maria, { criadoPorId: 2, criadoPor: "Maria" })).toBe(false);
  });
  it("nas atividades antigas (sem id) vale o nome, sem diferenciar maiúsculas", () => {
    expect(podeAlterarAtividade(maria, { criadoPorId: null, criadoPor: " maria " })).toBe(true);
    expect(podeAlterarAtividade(maria, { criadoPorId: null, criadoPor: "Jean" })).toBe(false);
  });
  it("atividade antiga sem dono nenhum só o admin altera", () => {
    expect(podeAlterarAtividade(maria, { criadoPorId: null, criadoPor: null })).toBe(false);
  });
});
