import { describe, expect, it } from "vitest";
import {
  calcularStatus,
  diasAtrasoNaConclusao,
  diasEmAtraso,
  mesPrevisto,
  podeFinalizarPeloStatus,
} from "./status";

const hoje = new Date("2026-09-25T15:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("calcularStatus", () => {
  it("Finalizado quando configurado, mesmo com data vencida", () => {
    expect(
      calcularStatus({ configuradoSistema: true, dataPrevista: d("2026-01-01") }, hoje),
    ).toBe("Finalizado");
  });
  it("Atrasado quando data anterior a hoje", () => {
    expect(
      calcularStatus({ configuradoSistema: false, dataPrevista: d("2026-09-24") }, hoje),
    ).toBe("Atrasado");
  });
  it("A Fazer quando data é hoje, futura ou ausente", () => {
    expect(
      calcularStatus({ configuradoSistema: false, dataPrevista: d("2026-09-25") }, hoje),
    ).toBe("A Fazer");
    expect(
      calcularStatus({ configuradoSistema: false, dataPrevista: null }, hoje),
    ).toBe("A Fazer");
  });
});

describe("Agendado", () => {
  it("Agendado Online/Presencial quando há previsão de formato e não está atrasado", () => {
    const base = { configuradoSistema: false, dataPrevista: d("2026-09-30") };
    expect(calcularStatus({ ...base, formato: "Online" }, hoje)).toBe("Agendado Online");
    expect(calcularStatus({ ...base, formato: "Presencial" }, hoje)).toBe("Agendado Presencial");
    expect(
      calcularStatus({ configuradoSistema: false, dataPrevista: null, formato: "Online" }, hoje),
    ).toBe("Agendado Online");
  });
  it("atraso, finalização e inativação prevalecem sobre a previsão", () => {
    expect(
      calcularStatus(
        { configuradoSistema: false, dataPrevista: d("2026-09-24"), formato: "Online" },
        hoje,
      ),
    ).toBe("Atrasado");
    expect(
      calcularStatus(
        { configuradoSistema: true, dataPrevista: d("2026-09-30"), formato: "Online" },
        hoje,
      ),
    ).toBe("Finalizado");
    expect(
      calcularStatus(
        { configuradoSistema: false, dataPrevista: null, formato: "Online", inativo: true },
        hoje,
      ),
    ).toBe("Inativo");
  });
});

describe("Inativo", () => {
  it("prevalece sobre qualquer outro status", () => {
    expect(
      calcularStatus(
        { configuradoSistema: true, dataPrevista: d("2026-01-01"), inativo: true },
        hoje,
      ),
    ).toBe("Inativo");
    expect(
      diasEmAtraso(
        { configuradoSistema: false, dataPrevista: d("2026-09-20"), inativo: true },
        hoje,
      ),
    ).toBeNull();
  });
});

describe("diasEmAtraso", () => {
  it("conta dias só quando atrasado", () => {
    expect(
      diasEmAtraso({ configuradoSistema: false, dataPrevista: d("2026-09-20") }, hoje),
    ).toBe(5);
    expect(
      diasEmAtraso({ configuradoSistema: true, dataPrevista: d("2026-09-20") }, hoje),
    ).toBeNull();
  });
});

describe("diasAtrasoNaConclusao", () => {
  it("conta os dias entre a data prevista e a finalização", () => {
    expect(diasAtrasoNaConclusao(d("2026-09-20"), hoje)).toBe(5);
  });
  it("é null no prazo, no próprio dia ou sem data", () => {
    expect(diasAtrasoNaConclusao(d("2026-09-25"), hoje)).toBeNull();
    expect(diasAtrasoNaConclusao(d("2026-10-01"), hoje)).toBeNull();
    expect(diasAtrasoNaConclusao(null, hoje)).toBeNull();
    expect(diasAtrasoNaConclusao(d("2026-09-20"), null)).toBeNull();
  });
  it("usa o dia de Mato Grosso: 01h UTC ainda é o dia anterior", () => {
    expect(
      diasAtrasoNaConclusao(d("2026-09-24"), new Date("2026-09-25T01:00:00Z")),
    ).toBeNull();
  });
});

describe("podeFinalizarPeloStatus", () => {
  it("vale para agendados e para atrasados", () => {
    expect(podeFinalizarPeloStatus("Agendado Online")).toBe(true);
    expect(podeFinalizarPeloStatus("Agendado Presencial")).toBe(true);
    expect(podeFinalizarPeloStatus("Atrasado")).toBe(true);
  });
  it("não vale para A Fazer, Finalizado e Inativo", () => {
    expect(podeFinalizarPeloStatus("A Fazer")).toBe(false);
    expect(podeFinalizarPeloStatus("Finalizado")).toBe(false);
    expect(podeFinalizarPeloStatus("Inativo")).toBe(false);
  });
  it("atrasado só com a data vencida (sem formato, como na importação) também pode ser finalizado", () => {
    const status = calcularStatus(
      { configuradoSistema: false, dataPrevista: d("2026-09-24"), formato: null },
      hoje,
    );
    expect(status).toBe("Atrasado");
    expect(podeFinalizarPeloStatus(status)).toBe(true);
  });
  it("combina com calcularStatus: data de ontem com formato é atrasado finalizável; hoje ainda é agendado", () => {
    const status = calcularStatus(
      { configuradoSistema: false, dataPrevista: d("2026-09-24"), formato: "Online" },
      hoje,
    );
    expect(podeFinalizarPeloStatus(status)).toBe(true);
    const hojeStatus = calcularStatus(
      { configuradoSistema: false, dataPrevista: d("2026-09-25"), formato: "Online" },
      hoje,
    );
    expect(hojeStatus).toBe("Agendado Online");
    expect(podeFinalizarPeloStatus(hojeStatus)).toBe(true);
  });
  it("sem data e sem formato continua A Fazer, que não é finalizável", () => {
    const status = calcularStatus({ configuradoSistema: false, dataPrevista: null, formato: null }, hoje);
    expect(podeFinalizarPeloStatus(status)).toBe(false);
  });
});

describe("mesPrevisto", () => {
  it("formata mmm/aaaa", () => {
    expect(mesPrevisto(d("2026-10-05"))).toBe("out/2026");
    expect(mesPrevisto(null)).toBeNull();
  });
});
