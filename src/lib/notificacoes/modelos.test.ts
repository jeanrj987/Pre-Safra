import { describe, expect, it } from "vitest";
import {
  eventoSugerido,
  htmlDaMensagem,
  montarDadosAviso,
  montarMensagem,
  montarPayloadWebhook,
  preencher,
  type DadosAviso,
} from "./modelos";

const dados = (p: Partial<DadosAviso> = {}): DadosAviso => ({
  nome: "FAZENDA BOA VISTA",
  telefone: "5566999998888",
  email: "contato@boavista.com.br",
  status: "A Fazer",
  motivo: null,
  dataFinalizacao: null,
  horario: null,
  formato: null,
  ...p,
});

describe("preencher", () => {
  it("troca as variáveis e apaga as desconhecidas", () => {
    expect(preencher("Oi {{nome}}{{x}}!", { nome: "Ana" })).toBe("Oi Ana!");
  });
});

describe("montarMensagem", () => {
  it("data alterada: inclui data, horário e formato", () => {
    const m = montarMensagem(
      "data-alterada",
      dados({ status: "Agendado Online", dataFinalizacao: "2026-10-28", horario: "09:00", formato: "Online" }),
    );
    expect(m.texto).toContain("Olá, FAZENDA BOA VISTA!");
    expect(m.texto).toContain("agendado para 28/10/2026 às 09:00 (Online).");
    expect(m.assunto).toMatch(/agendamento/);
  });
  it("data alterada sem horário nem formato não deixa buracos", () => {
    const m = montarMensagem("data-alterada", dados({ dataFinalizacao: "2026-10-28" }));
    expect(m.texto).toContain("agendado para 28/10/2026.");
    expect(m.texto).not.toMatch(/\s{2,}|\{\{/);
  });
  it("pendente: com e sem motivo e data", () => {
    const com = montarMensagem("pendente", dados({ motivo: "Não respondeu", dataFinalizacao: "2026-10-20" }));
    expect(com.texto).toContain("Pré-Safra, previsto para 20/10/2026. Situação: Não respondeu. Podemos");
    const sem = montarMensagem("pendente", dados());
    expect(sem.texto).toContain("realizar o seu Pré-Safra. Podemos combinar");
    expect(sem.texto).not.toMatch(/\{\{|\s{2,}/);
  });
});

describe("eventoSugerido", () => {
  it("agendados avisam a data; os demais lembram a pendência", () => {
    expect(eventoSugerido("Agendado Online")).toBe("data-alterada");
    expect(eventoSugerido("Agendado Presencial")).toBe("data-alterada");
    expect(eventoSugerido("A Fazer")).toBe("pendente");
    expect(eventoSugerido("Atrasado")).toBe("pendente");
  });
});

describe("montarPayloadWebhook", () => {
  it("leva os campos combinados mais evento e mensagem", () => {
    const payload = montarPayloadWebhook("pendente", {
      ...dados({ motivo: "Reagendando", dataFinalizacao: "2026-11-03" }),
      telefone: "5566999998888",
    });
    expect(payload).toMatchObject({
      nome: "FAZENDA BOA VISTA",
      telefone: "5566999998888",
      status: "A Fazer",
      motivo: "Reagendando",
      data_finalizacao: "2026-11-03",
      evento: "pendente",
    });
    expect(payload.mensagem).toContain("Situação: Reagendando.");
  });
});

describe("montarDadosAviso", () => {
  it("converte motivo em rótulo e a data em aaaa-mm-dd", () => {
    const d = montarDadosAviso({
      nome: "X",
      whatsapp: null,
      email: null,
      status: "Atrasado",
      motivoPendencia: "falta-comunicacao",
      dataPrevista: new Date("2026-10-20T00:00:00Z"),
      horario: null,
      formato: null,
    });
    expect(d.motivo).toBe("Falta de comunicação");
    expect(d.dataFinalizacao).toBe("2026-10-20");
  });
});

describe("htmlDaMensagem", () => {
  it("escapa o texto digitado", () => {
    expect(htmlDaMensagem("<b>oi</b> & tchau")).toContain("&lt;b&gt;oi&lt;/b&gt; &amp; tchau");
  });
});
