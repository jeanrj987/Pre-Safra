import { describe, expect, it } from "vitest";
import type { Linha } from "./dados";
import { marcasVazias } from "./finalizacao";
import {
  agruparPor,
  blocosPorStatus,
  conferir,
  contarPorStatus,
  dataNaLista,
  DIA,
  filtrarLinhas,
  fraseSemMotivo,
  lerDiaIso,
  mostrarColunaRegiao,
  opcoesDeFiltro,
  ORDEM_BLOCOS,
  pendenciasPorMotivo,
  pendentesSemNenhumMotivo,
  periodoEvolucao,
  resumir,
  ROTULO_SEM_RESPONSAVEL,
  SEM_FILTROS,
  serieEvolucao,
  STATUS_RELATORIO,
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
  agendadoPor: null,
  agendadoContato: null,
  agendadoEm: null,
  observacao: null,
  motivoPendencia: null,
  observacaoPendencia: null,
  status: "A Fazer",
  dias: null,
  atrasoNaConclusao: null,
  concluidoEm: null,
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

describe("pendentesSemNenhumMotivo e fraseSemMotivo", () => {
  it("só devolve a contagem quando a única linha é a do sem motivo", () => {
    const soSemMotivo = pendenciasPorMotivo([linha({ status: "A Fazer" }), linha({ status: "Atrasado" })]);
    expect(pendentesSemNenhumMotivo(soSemMotivo)).toBe(2);
    const comMotivo = pendenciasPorMotivo([linha({ status: "A Fazer", motivoPendencia: "reagendando" })]);
    expect(pendentesSemNenhumMotivo(comMotivo)).toBeNull();
    expect(pendentesSemNenhumMotivo([])).toBeNull();
  });

  it("monta a frase com o número certo", () => {
    expect(fraseSemMotivo(72)).toBe("Nenhum motivo de pendência anotado nos 72 clientes pendentes.");
    expect(fraseSemMotivo(1)).toBe("Nenhum motivo de pendência anotado no único cliente pendente.");
  });
});

describe("mostrarColunaRegiao", () => {
  it("esconde a região só quando o filtro tem exatamente uma", () => {
    expect(mostrarColunaRegiao(SEM_FILTROS)).toBe(true);
    expect(mostrarColunaRegiao({ ...SEM_FILTROS, regioes: ["Norte"] })).toBe(false);
    expect(mostrarColunaRegiao({ ...SEM_FILTROS, regioes: ["Norte", "Sul"] })).toBe(true);
  });
});

describe("ORDEM_BLOCOS", () => {
  it("tem todos os status, uma vez cada, com os agendados antes do A Fazer", () => {
    expect(ORDEM_BLOCOS).toEqual(["Atrasado", "Agendado Online", "Agendado Presencial", "A Fazer", "Finalizado", "Inativo"]);
    expect([...ORDEM_BLOCOS].sort()).toEqual([...STATUS_RELATORIO].sort());
  });
});

describe("dataNaLista", () => {
  it("nos finalizados usa o dia da conclusão no fuso da equipe, sem horário", () => {
    // 21/11 às 2h em UTC ainda é dia 20 em Cuiabá (UTC-4).
    const l = linha({ status: "Finalizado", dataPrevista: new Date(Date.UTC(2026, 10, 1)), horario: "08:00", concluidoEm: new Date("2026-11-21T02:00:00Z") });
    expect(dataNaLista(l)).toEqual({ dia: Date.UTC(2026, 10, 20), horario: null });
  });

  it("sem conclusão registrada, o finalizado cai na data prevista", () => {
    const l = linha({ status: "Finalizado", dataPrevista: new Date(Date.UTC(2026, 10, 1)), horario: "08:00" });
    expect(dataNaLista(l)).toEqual({ dia: Date.UTC(2026, 10, 1), horario: null });
  });

  it("nos demais status, data prevista e horário agendado", () => {
    const l = linha({ status: "Agendado Online", dataPrevista: new Date(Date.UTC(2026, 11, 3)), horario: "14:30" });
    expect(dataNaLista(l)).toEqual({ dia: Date.UTC(2026, 11, 3), horario: "14:30" });
    expect(dataNaLista(linha({ status: "A Fazer" }))).toEqual({ dia: null, horario: null });
  });
});

describe("blocosPorStatus", () => {
  const dia = (d: number) => new Date(Date.UTC(2026, 10, d));
  const semDetalhe = () => "";

  it("separa por status na ordem dos blocos e pula os vazios", () => {
    const b = blocosPorStatus(
      [
        linha({ status: "Finalizado" }),
        linha({ status: "A Fazer" }),
        linha({ status: "Atrasado", dias: 1 }),
        linha({ status: "Agendado Presencial" }),
      ],
      { mostrarRegiao: true, detalhe: semDetalhe },
    );
    expect(b.map((x) => x.status)).toEqual(["Atrasado", "Agendado Presencial", "A Fazer", "Finalizado"]);
  });

  it("ordena cada bloco pela regra do status", () => {
    const b = blocosPorStatus(
      [
        linha({ nome: "Atr sem dias", status: "Atrasado", dias: null }),
        linha({ nome: "Atr pouco", status: "Atrasado", dias: 2, dataPrevista: dia(20) }),
        linha({ nome: "Atr muito", status: "Atrasado", dias: 9, dataPrevista: dia(13) }),
        linha({ nome: "Ag tarde", status: "Agendado Online", dataPrevista: dia(28), horario: "14:00" }),
        linha({ nome: "Ag cedo", status: "Agendado Online", dataPrevista: dia(28), horario: "8:30" }),
        linha({ nome: "Ag antes", status: "Agendado Online", dataPrevista: dia(27), horario: "16:00" }),
        linha({ nome: "Zeca", status: "A Fazer", dataPrevista: dia(30) }),
        linha({ nome: "Ávila", status: "A Fazer" }),
        linha({ nome: "Bruno", status: "A Fazer" }),
        linha({ nome: "Fin sem data", status: "Finalizado" }),
        linha({ nome: "Fin depois", status: "Finalizado", dataPrevista: dia(10) }),
        linha({ nome: "Fin antes", status: "Finalizado", dataPrevista: dia(3) }),
        linha({ nome: "Xavier", status: "Inativo", dataPrevista: dia(1) }),
        linha({ nome: "Inês", status: "Inativo", dataPrevista: dia(9) }),
      ],
      { mostrarRegiao: true, detalhe: semDetalhe },
    );
    const nomes = Object.fromEntries(b.map((x) => [x.status, x.linhas.map((l) => l.nome)]));
    expect(nomes).toEqual({
      Atrasado: ["Atr muito", "Atr pouco", "Atr sem dias"],
      "Agendado Online": ["Ag antes", "Ag cedo", "Ag tarde"],
      "A Fazer": ["Ávila", "Bruno", "Zeca"],
      Finalizado: ["Fin antes", "Fin depois", "Fin sem data"],
      Inativo: ["Inês", "Xavier"],
    });
  });

  it("ordena os finalizados pelo dia da conclusão, com a data prevista de reserva", () => {
    const b = blocosPorStatus(
      [
        // Previsto para o dia 1, mas feito no dia 20.
        linha({ nome: "Feito tarde", status: "Finalizado", dataPrevista: dia(1), concluidoEm: new Date("2026-11-20T15:00:00Z") }),
        linha({ nome: "Feito cedo", status: "Finalizado", dataPrevista: dia(25), concluidoEm: new Date("2026-11-05T15:00:00Z") }),
        linha({ nome: "Sem registro", status: "Finalizado", dataPrevista: dia(10) }),
      ],
      { mostrarRegiao: true, detalhe: semDetalhe },
    );
    expect(b[0].linhas.map((l) => l.nome)).toEqual(["Feito cedo", "Sem registro", "Feito tarde"]);
  });

  it("mostra só as colunas com algum valor no bloco", () => {
    const [atrasados, aFazer] = blocosPorStatus(
      [
        linha({ status: "Atrasado", dias: 3, dataPrevista: dia(5), responsavel: null, formato: null }),
        linha({ status: "A Fazer", responsavel: null, regiao: "Norte" }),
        linha({ status: "A Fazer", responsavel: "  ", regiao: "Sul" }),
      ],
      { mostrarRegiao: true, detalhe: (l) => (l.status === "Atrasado" ? "3 dias de atraso" : "") },
    );
    expect(atrasados.colunas).toEqual(["regiao", "data", "detalhe"]);
    expect(aFazer.colunas).toEqual(["regiao"]);
  });

  it("sem a coluna de região, o bloco só com nomes fica sem colunas (lista compacta)", () => {
    const [aFazer] = blocosPorStatus([linha({ status: "A Fazer", responsavel: null })], {
      mostrarRegiao: false,
      detalhe: semDetalhe,
    });
    expect(aFazer.colunas).toEqual([]);
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
