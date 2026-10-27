import { describe, expect, it } from "vitest";
import type { Linha } from "./dados";
import { marcasVazias } from "./finalizacao";
import {
  agruparPor,
  conferir,
  contarPorStatus,
  DIA,
  filtrarLinhas,
  lerDiaIso,
  opcoesDeFiltro,
  pendenciasPorMotivo,
  periodoEvolucao,
  resumir,
  ROTULO_SEM_RESPONSAVEL,
  SEM_FILTROS,
  serieEvolucao,
  tipoValido,
} from "./relatorios";

let proximo = 1;
const linha = (extra: Partial<Linha> = {}): Linha => ({
  id: proximo++,
  nome: `Cliente ${proximo}`,
  semCadastro: false,
  responsavel: "Ana",
  atendentes: null,
  cidade: null,
  uf: null,
  regiao: "Norte",
  consultor: "Caio",
  whatsapp: null,
  dataPrevista: null,
  horario: null,
  formato: null,
  observacao: null,
  motivoPendencia: null,
  observacaoPendencia: null,
  status: "A Fazer",
  dias: null,
  atrasoNaConclusao: null,
  mes: null,
  ...extra,
});

describe("tipoValido", () => {
  it("cai na situação quando o tipo é desconhecido", () => {
    expect(tipoValido("pessoas")).toBe("pessoas");
    expect(tipoValido("lixo")).toBe("situacao");
    expect(tipoValido(undefined)).toBe("situacao");
  });
});

describe("filtrarLinhas", () => {
  const linhas = [
    linha({ regiao: "Norte", responsavel: "Ana", status: "Finalizado" }),
    linha({ regiao: "Sul", responsavel: "Bia", status: "Atrasado" }),
    linha({ regiao: null, responsavel: null, status: "A Fazer" }),
  ];
  it("sem filtros devolve tudo", () => {
    expect(filtrarLinhas(linhas, SEM_FILTROS)).toHaveLength(3);
  });
  it("filtra por região ignorando caixa e acento", () => {
    expect(filtrarLinhas(linhas, { ...SEM_FILTROS, regioes: ["sul"] })).toHaveLength(1);
  });
  it("encontra os clientes sem responsável pelo rótulo", () => {
    const r = filtrarLinhas(linhas, { ...SEM_FILTROS, responsaveis: [ROTULO_SEM_RESPONSAVEL] });
    expect(r).toHaveLength(1);
    expect(r[0].responsavel).toBeNull();
  });
  it("combina os filtros", () => {
    expect(filtrarLinhas(linhas, { regioes: ["Norte"], responsaveis: ["Ana"], status: ["Atrasado"] })).toHaveLength(0);
    expect(filtrarLinhas(linhas, { regioes: ["Norte"], responsaveis: ["Ana"], status: ["Finalizado"] })).toHaveLength(1);
  });
});

describe("opcoesDeFiltro", () => {
  it("lista sem repetir, em ordem, com o rótulo de vazio no fim", () => {
    const o = opcoesDeFiltro([
      { regiao: "Sul", responsavel: "bia" },
      { regiao: "norte", responsavel: "Bia " },
      { regiao: "Norte", responsavel: null },
    ]);
    expect(o.regioes).toEqual(["norte", "Sul"]);
    expect(o.responsaveis).toEqual(["bia", ROTULO_SEM_RESPONSAVEL]);
  });
});

describe("pendenciasPorMotivo", () => {
  it("conta só pendentes e deixa o sem motivo por último", () => {
    const r = pendenciasPorMotivo([
      linha({ status: "Atrasado", motivoPendencia: "nao-respondeu" }),
      linha({ status: "A Fazer", motivoPendencia: "nao-respondeu" }),
      linha({ status: "A Fazer", motivoPendencia: null }),
      linha({ status: "Finalizado", motivoPendencia: null }),
    ]);
    expect(r.map((m) => [m.rotulo, m.total, m.atrasados, m.aFazer])).toEqual([
      ["Não respondeu", 2, 1, 1],
      ["Sem motivo definido", 1, 0, 1],
    ]);
  });
});

describe("resumir", () => {
  it("ignora inativos e calcula percentual, formato e atraso médio", () => {
    const r = resumir("Ana", [
      linha({ status: "Finalizado", formato: "Online", atrasoNaConclusao: 2 }),
      linha({ status: "Finalizado", formato: "Presencial", atrasoNaConclusao: 4 }),
      linha({ status: "Finalizado", formato: "Online", atrasoNaConclusao: null }),
      linha({ status: "Agendado Online", formato: "Online" }),
      linha({ status: "Atrasado" }),
      linha({ status: "Inativo" }),
    ]);
    expect(r).toMatchObject({
      total: 5,
      finalizados: 3,
      agendados: 1,
      atrasados: 1,
      aFazer: 0,
      pct: 60,
      online: 3,
      presencial: 1,
      concluidosComAtraso: 2,
      atrasoMedio: 3,
    });
  });
  it("sem finalizados com atraso, a média é nula", () => {
    expect(resumir("x", [linha({ status: "Finalizado" })]).atrasoMedio).toBeNull();
  });
});

describe("agruparPor", () => {
  const linhas = [
    linha({ responsavel: "Ana", status: "Finalizado" }),
    linha({ responsavel: "ana ", status: "A Fazer" }),
    linha({ responsavel: "Bia", status: "A Fazer" }),
    linha({ responsavel: "Bia", status: "Atrasado" }),
    linha({ responsavel: null, status: "A Fazer" }),
  ];
  it("junta nomes iguais, ordena por pendências e põe o sem responsável por último", () => {
    const r = agruparPor(linhas, "responsavel");
    expect(r.map((g) => g.nome)).toEqual(["Bia", "Ana", ROTULO_SEM_RESPONSAVEL]);
    expect(r[1]).toMatchObject({ total: 2, finalizados: 1, pct: 50 });
  });
  it("agrupa por região e por consultor", () => {
    expect(agruparPor([linha({ regiao: "Sul" }), linha({ regiao: null })], "regiao").map((g) => g.nome)).toEqual([
      "Sul",
      "Sem região",
    ]);
    expect(agruparPor([linha({ consultor: null })], "consultor")[0].nome).toBe("Sem consultor");
  });
  it("descarta grupos só com inativos", () => {
    expect(agruparPor([linha({ status: "Inativo" })], "responsavel")).toEqual([]);
  });
});

describe("conferir", () => {
  it("conta os itens marcados e lista os finalizados incompletos", () => {
    const a = linha({ status: "Finalizado", nome: "A" });
    const b = linha({ status: "Finalizado", nome: "B" });
    const c = linha({ status: "A Fazer", nome: "C" });
    const marcas = new Map([
      [a.id, { ...marcasVazias(), sistemaAtualizado: true, safraFechada: true, melhoriasApresentadas: true, safraNovaConfigurada: true }],
      [b.id, { ...marcasVazias(), sistemaAtualizado: true }],
      [c.id, marcasVazias()],
    ]);
    const r = conferir([a, b, c], marcas);
    expect(r.total).toBe(2);
    expect(r.itens.find((i) => i.chave === "sistemaAtualizado")).toMatchObject({ marcados: 2, pct: 100 });
    expect(r.itens.find((i) => i.chave === "safraFechada")).toMatchObject({ marcados: 1, pct: 50 });
    expect(r.incompletos.map((x) => x.nome)).toEqual(["B"]);
    expect(r.incompletos[0].faltam).toEqual(["melhoriasApresentadas", "safraFechada", "safraNovaConfigurada"]);
  });
});

describe("serieEvolucao", () => {
  const d1 = Date.UTC(2026, 9, 1);
  const d2 = d1 + DIA;
  const fotos = [
    { dia: d2, status: "Finalizado", responsavel: "Ana", regiao: "Norte" },
    { dia: d1, status: "Atrasado", responsavel: "Ana", regiao: "Norte" },
    { dia: d1, status: "Finalizado", responsavel: "Bia", regiao: "Sul" },
    { dia: d1, status: "Inativo", responsavel: "Bia", regiao: "Sul" },
    { dia: d1, status: "Qualquer", responsavel: "Bia", regiao: "Sul" },
  ];
  it("agrupa por dia em ordem, sem contar status desconhecido nem inativo como ativo", () => {
    const s = serieEvolucao(fotos, SEM_FILTROS);
    expect(s.map((p) => p.dia)).toEqual([d1, d2]);
    expect(s[0]).toMatchObject({ ativos: 2, pctFinalizado: 50 });
    expect(s[0].por.Inativo).toBe(1);
  });
  it("aplica os filtros de região e responsável", () => {
    const s = serieEvolucao(fotos, { ...SEM_FILTROS, regioes: ["Norte"] });
    expect(s[0].ativos).toBe(1);
    expect(serieEvolucao(fotos, { ...SEM_FILTROS, responsaveis: ["Bia"] })).toHaveLength(1);
  });
});

describe("contarPorStatus", () => {
  it("zera os status ausentes", () => {
    expect(contarPorStatus([{ status: "Atrasado" }]).Finalizado).toBe(0);
  });
});

describe("lerDiaIso e periodoEvolucao", () => {
  it("aceita só datas válidas", () => {
    expect(lerDiaIso("2026-10-27")).toBe(Date.UTC(2026, 9, 27));
    expect(lerDiaIso("2026-02-31")).toBeNull();
    expect(lerDiaIso("27/10/2026")).toBeNull();
    expect(lerDiaIso(undefined)).toBeNull();
  });
  const hoje = Date.UTC(2026, 9, 27);
  it("sem datas, usa os últimos 30 dias", () => {
    expect(periodoEvolucao(undefined, undefined, hoje)).toEqual({ inicio: hoje - 29 * DIA, fim: hoje });
  });
  it("não passa de hoje, não inverte e limita a um ano", () => {
    expect(periodoEvolucao("2026-10-01", "2027-01-01", hoje).fim).toBe(hoje);
    expect(periodoEvolucao("2026-10-20", "2026-10-10", hoje)).toEqual({
      inicio: Date.UTC(2026, 9, 10),
      fim: Date.UTC(2026, 9, 10),
    });
    expect(periodoEvolucao("2000-01-01", undefined, hoje).inicio).toBe(hoje - 365 * DIA);
  });
});
