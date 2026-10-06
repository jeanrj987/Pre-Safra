import { describe, expect, it } from "vitest";
import {
  DIA,
  SEMANA,
  agruparCarga,
  colunasVencimento,
  escalaAgradavel,
  listarRegioes,
  metricas,
  montarFila,
  nomeCurtoRegiao,
  pessoasDaDupla,
  situacao,
  type ClientePainel,
  type PeriodoSafra,
} from "./painel";

const HOJE = Date.UTC(2026, 8, 25);
const dia = (n: number) => HOJE + n * DIA;

// Mesmos valores que a antiga constante fixa SAFRA (antes de virar dado do banco).
const PERIODO: PeriodoSafra = {
  inicio: Date.UTC(2026, 7, 1),
  prazo: Date.UTC(2026, 10, 30),
  fim: Date.UTC(2026, 11, 31),
};

let seq = 0;
const cliente = (p: Partial<ClientePainel> = {}): ClientePainel => ({
  id: ++seq,
  nome: `Cliente ${seq}`,
  regiao: "Norte MT a PA/RR",
  atendentes: "Jéssica e Marcos",
  responsavel: null,
  formato: null,
  data: null,
  fin: null,
  melhorias: false,
  ...p,
});

describe("situacao", () => {
  it("Finalizado tem prioridade sobre qualquer data", () => {
    expect(situacao(cliente({ fin: dia(-3), data: dia(-30) }), HOJE)).toBe("F");
  });
  it("Sem agendamento quando não há data", () => {
    expect(situacao(cliente(), HOJE)).toBe("S");
  });
  it("Atrasado só quando a data é anterior a hoje", () => {
    expect(situacao(cliente({ data: dia(-1) }), HOJE)).toBe("T");
    expect(situacao(cliente({ data: dia(0) }), HOJE)).toBe("A");
    expect(situacao(cliente({ data: dia(30) }), HOJE)).toBe("A");
  });
});

describe("metricas", () => {
  const set = [
    cliente({ fin: dia(-2), melhorias: true, responsavel: "Marcos" }),
    cliente({ fin: dia(-10) }),
    cliente({ fin: dia(-20) }),
    cliente({ fin: dia(-27) }),
    cliente({ fin: dia(-40) }),
    cliente({ data: dia(-5), responsavel: "Jéssica" }),
    cliente({ data: dia(-1) }),
    cliente({ data: dia(6) }),
    cliente({ data: dia(7) }),
    cliente(),
  ];
  const m = metricas(set, HOJE, PERIODO);

  it("conta as quatro situações", () => {
    expect(m.por).toEqual({ F: 5, A: 2, T: 2, S: 1 });
    expect(m.n).toBe(10);
    expect(m.pct).toBe(0.5);
  });
  it("atrasos: maior e média em dias", () => {
    expect(m.maiorAtraso).toBe(5);
    expect(m.mediaAtraso).toBe(3);
  });
  it("vencem em 7 dias vai de hoje até hoje + 6", () => {
    expect(m.vencem7).toHaveLength(1);
    expect(m.proximoPrazo).toBe(dia(6));
  });
  it("ritmo usa as últimas 4 semanas (4 finalizações em 28 dias)", () => {
    expect(m.ritmo).toBe(1);
    expect(m.semana).toBe(1);
  });
  it("previsão = hoje + pendentes / ritmo semanas", () => {
    expect(m.pendentes).toBe(5);
    expect(m.previsao).toBe(HOJE + 5 * SEMANA);
  });
  it("sem ritmo não há previsão", () => {
    expect(metricas([cliente(), cliente()], HOJE, PERIODO).previsao).toBeNull();
  });
  it("cobertura de data e de responsável", () => {
    expect(m.comData).toBe(9);
    expect(m.comResponsavel).toBe(2);
    expect(m.semResponsavel).toBe(8);
    expect(m.comMelhorias).toBe(1);
  });
  it("meta de hoje fica entre 0 e 1", () => {
    expect(m.metaPct).toBeGreaterThan(0);
    expect(m.metaPct).toBeLessThan(1);
    expect(PERIODO.prazo).toBeGreaterThan(HOJE);
  });
});

describe("montarFila", () => {
  it("ordena atrasados (maior atraso), depois vencem em 7 dias, depois sem data com responsável", () => {
    const a = cliente({ nome: "A", data: dia(-2) });
    const b = cliente({ nome: "B", data: dia(-9) });
    const c = cliente({ nome: "C", data: dia(3) });
    const d = cliente({ nome: "D" });
    const e = cliente({ nome: "E", responsavel: "Marcos" });
    const longe = cliente({ nome: "Longe", data: dia(30) });
    const feito = cliente({ nome: "Feito", fin: dia(-1) });
    const fila = montarFila([d, longe, c, feito, a, e, b], HOJE);
    expect(fila.map((i) => i.c.nome)).toEqual(["B", "A", "C", "E", "D"]);
    expect(fila.map((i) => i.motivo)).toEqual(["T", "T", "V", "S", "S"]);
  });
});

describe("agruparCarga", () => {
  it("agrupa por responsável, com 'Sem responsável' e a região mais comum", () => {
    const set = [
      cliente({ responsavel: "Marcos", data: dia(-1) }),
      cliente({ responsavel: "Marcos", fin: dia(-1) }),
      cliente({ responsavel: "Marcos", regiao: "Leste MT a TO/GO/MG" }),
      cliente(),
    ];
    const linhas = agruparCarga(set, "responsavel", HOJE);
    const marcos = linhas.find((l) => l.chave === "Marcos");
    expect(marcos?.total).toBe(3);
    expect(marcos?.pendentes).toBe(2);
    expect(marcos?.sub).toBe("Norte MT");
    expect(linhas.find((l) => l.chave === "Sem responsável")?.sub).toBe("");
  });
});

describe("colunasVencimento", () => {
  it("primeira coluna são os vencidos e as demais são semanas a partir de hoje", () => {
    const set = [cliente({ data: dia(-1) }), cliente({ data: dia(0) }), cliente({ data: dia(6) }), cliente({ data: dia(7) })];
    const cols = colunasVencimento(set, HOJE, PERIODO);
    expect(cols).toHaveLength(11);
    expect(cols[0]).toMatchObject({ rotulo: "Vencidos", qtd: 1, atrasado: true });
    expect(cols[1].qtd).toBe(2);
    expect(cols[2].qtd).toBe(1);
    expect(cols.filter((c) => c.temPrazoFinal)).toHaveLength(1);
  });
});

describe("regiões", () => {
  it("separa o nome curto da cobertura", () => {
    expect(nomeCurtoRegiao("Norte MT a PA/RR")).toEqual({ curto: "Norte MT", cobre: "PA/RR" });
    expect(nomeCurtoRegiao("Sorriso e Região")).toEqual({ curto: "Sorriso e Região", cobre: "" });
  });
  it("divide a dupla de atendentes", () => {
    expect(pessoasDaDupla("Amanda Albano e Cauê")).toEqual(["Amanda Albano", "Cauê"]);
    expect(pessoasDaDupla(null)).toEqual([]);
  });
  it("lista as regiões da maior para a menor e ignora clientes sem região", () => {
    const set = [
      cliente({ regiao: "A" }),
      cliente({ regiao: "B" }),
      cliente({ regiao: "B" }),
      cliente({ regiao: null }),
    ];
    expect(listarRegioes(set).map((r) => [r.nome, r.total])).toEqual([["B", 2], ["A", 1]]);
  });

  it("usa o consultor que mais aparece na região, sem contar clientes sem consultor", () => {
    const set = [
      cliente({ regiao: "A", consultor: "André" }),
      cliente({ regiao: "A", consultor: "André" }),
      cliente({ regiao: "A", consultor: "Cledinei" }),
      cliente({ regiao: "A", consultor: null }),
      cliente({ regiao: "B" }),
    ];
    const porNome = Object.fromEntries(listarRegioes(set).map((r) => [r.nome, r.consultor]));
    expect(porNome).toEqual({ A: "André", B: "" });
  });
});

describe("escalaAgradavel", () => {
  it("arredonda o topo para um valor limpo", () => {
    expect(escalaAgradavel(283)).toEqual({ max: 300, ticks: [0, 100, 200, 300] });
    expect(escalaAgradavel(24).max).toBe(30);
    expect(escalaAgradavel(0).max).toBe(1);
  });
});
