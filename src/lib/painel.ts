// Regras do painel: situações, indicadores, projeção e fila de prioridade.
// Tudo aqui é função pura sobre dias em UTC (ms), para poder ser testada sem banco.

export const DIA = 24 * 60 * 60 * 1000;
export const SEMANA = 7 * DIA;

// Início do trabalho e prazo final da safra selecionada (vem do banco, model Safra); a meta
// de avanço é linear entre as duas. `fim` é só o limite do eixo do gráfico de ritmo — ver
// periodoDe() em src/lib/safra.ts.
export interface PeriodoSafra {
  inicio: number;
  prazo: number;
  fim: number;
}

// Situação do cliente no painel. Difere da lista principal: "A fazer" se divide em
// Agendado (tem data prevista) e Sem agendamento (não tem).
export type Situacao = "F" | "A" | "T" | "S";

export const SITUACOES: { k: Situacao; nome: string; cor: "fin" | "age" | "atr" | "sem" }[] = [
  { k: "F", nome: "Finalizado", cor: "fin" },
  { k: "A", nome: "Agendado", cor: "age" },
  { k: "T", nome: "Atrasado", cor: "atr" },
  { k: "S", nome: "Sem agendamento", cor: "sem" },
];

export interface ClientePainel {
  id: number;
  nome: string;
  regiao: string | null;
  atendentes: string | null;
  responsavel: string | null;
  formato: string | null;
  /** Data prevista, em dia UTC (ms). */
  data: number | null;
  /** Dia em que a finalização em vigor foi registrada, em dia UTC (ms). Nulo se não finalizado. */
  fin: number | null;
  melhorias: boolean;
}

export function situacao(c: ClientePainel, hoje: number): Situacao {
  if (c.fin !== null) return "F";
  if (c.data === null) return "S";
  return c.data < hoje ? "T" : "A";
}

export interface Metricas {
  n: number;
  por: Record<Situacao, number>;
  feitos: number;
  pendentes: number;
  pct: number;
  /** Fração da meta que deveria estar cumprida hoje (0 a 1). */
  metaPct: number;
  /** Finalizações por semana nas últimas 4 semanas. */
  ritmo: number;
  semana: number;
  semanaAnterior: number;
  /** Finalizações por semana necessárias para cumprir o prazo. */
  necessario: number;
  /** Dia previsto de término no ritmo atual; nulo sem ritmo ou sem pendências. */
  previsao: number | null;
  atrasados: ClientePainel[];
  maiorAtraso: number;
  mediaAtraso: number;
  vencem7: ClientePainel[];
  proximoPrazo: number | null;
  semData: number;
  semResponsavel: number;
  comData: number;
  comResponsavel: number;
  finalizados: number;
  comMelhorias: number;
}

export const acumulado = (set: ClientePainel[], ate: number) =>
  set.reduce((a, c) => a + (c.fin !== null && c.fin <= ate ? 1 : 0), 0);

export const metaEm = (n: number, dia: number, periodo: PeriodoSafra) =>
  Math.max(0, Math.min(1, (dia - periodo.inicio) / (periodo.prazo - periodo.inicio))) * n;

export function metricas(set: ClientePainel[], hoje: number, periodo: PeriodoSafra): Metricas {
  const n = set.length;
  const por: Record<Situacao, number> = { F: 0, A: 0, T: 0, S: 0 };
  for (const c of set) por[situacao(c, hoje)]++;

  const feitos = por.F;
  const pendentes = n - feitos;
  const entre = (de: number, ate: number) =>
    set.filter((c) => c.fin !== null && c.fin > de && c.fin <= ate).length;
  const ritmo = entre(hoje - 4 * SEMANA, hoje) / 4;
  const semanasRestantes = Math.max((periodo.prazo - hoje) / SEMANA, 0);

  const atrasados = set.filter((c) => situacao(c, hoje) === "T");
  const dias = atrasados.map((c) => Math.round((hoje - (c.data as number)) / DIA));
  const vencem7 = set.filter(
    (c) => situacao(c, hoje) === "A" && (c.data as number) - hoje <= 6 * DIA,
  );

  return {
    n,
    por,
    feitos,
    pendentes,
    pct: n ? feitos / n : 0,
    metaPct: Math.max(0, Math.min(1, (hoje - periodo.inicio) / (periodo.prazo - periodo.inicio))),
    ritmo,
    semana: entre(hoje - SEMANA, hoje),
    semanaAnterior: entre(hoje - 2 * SEMANA, hoje - SEMANA),
    necessario: semanasRestantes > 0 ? pendentes / semanasRestantes : pendentes,
    previsao: ritmo > 0 && pendentes > 0 ? hoje + (pendentes / ritmo) * SEMANA : null,
    atrasados,
    maiorAtraso: dias.length ? Math.max(...dias) : 0,
    mediaAtraso: dias.length ? dias.reduce((a, d) => a + d, 0) / dias.length : 0,
    vencem7,
    proximoPrazo: vencem7.length ? Math.min(...vencem7.map((c) => c.data as number)) : null,
    semData: por.S,
    semResponsavel: set.filter((c) => !c.responsavel).length,
    comData: n - por.S,
    comResponsavel: set.filter((c) => !!c.responsavel).length,
    finalizados: feitos,
    comMelhorias: set.filter((c) => c.fin !== null && c.melhorias).length,
  };
}

/** Valor da projeção (dashed) em um dia futuro, limitado ao total de clientes. */
export const projetar = (m: Metricas, hoje: number, dia: number) =>
  Math.min(m.n, m.feitos + (m.ritmo * (dia - hoje)) / SEMANA);

// ---------- Fila de prioridade ----------
export type Motivo = "T" | "V" | "S";

export interface ItemFila {
  c: ClientePainel;
  motivo: Motivo;
}

/**
 * Atrasados (maior atraso primeiro), depois quem vence em até 7 dias (prazo mais
 * próximo primeiro) e, por fim, quem ainda não tem data (com responsável antes).
 */
export function montarFila(set: ClientePainel[], hoje: number): ItemFila[] {
  const itens: (ItemFila & { ord: number })[] = [];
  for (const c of set) {
    const s = situacao(c, hoje);
    if (s === "T") itens.push({ c, motivo: "T", ord: (c.data as number) - hoje });
    else if (s === "A" && (c.data as number) - hoje <= 6 * DIA)
      itens.push({ c, motivo: "V", ord: (c.data as number) - hoje });
    else if (s === "S") itens.push({ c, motivo: "S", ord: c.responsavel ? 0 : 1 });
  }
  const peso: Record<Motivo, number> = { T: 0, V: 1, S: 2 };
  return itens.sort(
    (a, b) =>
      peso[a.motivo] - peso[b.motivo] ||
      a.ord - b.ord ||
      a.c.nome.localeCompare(b.c.nome, "pt-BR"),
  );
}

// ---------- Agrupamentos ----------
export type Dimensao = "responsavel" | "formato";

export const chaveDe = (c: ClientePainel, dim: Dimensao) =>
  dim === "responsavel" ? (c.responsavel ?? "Sem responsável") : (c.formato ?? "Não definido");

export interface LinhaCarga {
  chave: string;
  /** Rótulo secundário (a região mais comum do responsável). */
  sub: string;
  por: Record<Situacao, number>;
  total: number;
  pendentes: number;
}

export function agruparCarga(set: ClientePainel[], dim: Dimensao, hoje: number): LinhaCarga[] {
  const mapa = new Map<string, LinhaCarga & { regioes: Map<string, number> }>();
  for (const c of set) {
    const k = chaveDe(c, dim);
    const l = mapa.get(k) ?? {
      chave: k,
      sub: "",
      por: { F: 0, A: 0, T: 0, S: 0 },
      total: 0,
      pendentes: 0,
      regioes: new Map<string, number>(),
    };
    const s = situacao(c, hoje);
    l.por[s]++;
    l.total++;
    if (s !== "F") l.pendentes++;
    if (c.regiao) l.regioes.set(c.regiao, (l.regioes.get(c.regiao) ?? 0) + 1);
    mapa.set(k, l);
  }
  return [...mapa.values()]
    .map(({ regioes, ...l }) => ({
      ...l,
      sub:
        dim === "responsavel" && l.chave !== "Sem responsável" && regioes.size
          ? nomeCurtoRegiao([...regioes.entries()].sort((a, b) => b[1] - a[1])[0][0]).curto
          : "",
    }))
    .sort((a, b) => b.pendentes - a.pendentes || a.chave.localeCompare(b.chave, "pt-BR"));
}

// ---------- Vencimentos por semana ----------
export interface ColunaVencimento {
  rotulo: string;
  titulo: string;
  qtd: number;
  atrasado: boolean;
  temPrazoFinal: boolean;
}

export function colunasVencimento(
  set: ClientePainel[],
  hoje: number,
  periodo: PeriodoSafra,
  semanas = 10,
): ColunaVencimento[] {
  const cols: ColunaVencimento[] = [
    {
      rotulo: "Vencidos",
      titulo: "Já vencidos",
      qtd: set.filter((c) => situacao(c, hoje) === "T").length,
      atrasado: true,
      temPrazoFinal: false,
    },
  ];
  for (let i = 0; i < semanas; i++) {
    const de = hoje + i * SEMANA;
    const ate = de + 6 * DIA;
    cols.push({
      rotulo: diaMes(de),
      titulo: `${diaMes(de)} a ${diaMes(ate)}`,
      qtd: set.filter((c) => situacao(c, hoje) === "A" && (c.data as number) >= de && (c.data as number) <= ate).length,
      atrasado: false,
      temPrazoFinal: periodo.prazo >= de && periodo.prazo <= ate,
    });
  }
  return cols;
}

// ---------- Regiões ----------
/** "Norte MT a PA/RR" vira { curto: "Norte MT", cobre: "PA/RR" }. */
export function nomeCurtoRegiao(regiao: string): { curto: string; cobre: string } {
  const m = /^(.+?) a ([A-Z]{2}(?:\/[A-Z]{2})*)$/.exec(regiao);
  return m ? { curto: m[1], cobre: m[2] } : { curto: regiao, cobre: "" };
}

/** "Amanda Albano e Cauê" vira ["Amanda Albano", "Cauê"]. */
export const pessoasDaDupla = (dupla: string | null): string[] =>
  dupla ? dupla.split(/\s+e\s+/).map((p) => p.trim()).filter(Boolean) : [];

export interface Regiao {
  nome: string;
  curto: string;
  cobre: string;
  atendentes: string;
  total: number;
}

/** Regiões presentes nos dados, da maior para a menor. */
export function listarRegioes(clientes: ClientePainel[]): Regiao[] {
  const mapa = new Map<string, Regiao>();
  for (const c of clientes) {
    if (!c.regiao) continue;
    const r = mapa.get(c.regiao) ?? {
      nome: c.regiao,
      ...nomeCurtoRegiao(c.regiao),
      atendentes: c.atendentes ?? "",
      total: 0,
    };
    r.total++;
    mapa.set(c.regiao, r);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------- Escalas e formatos ----------
export function escalaAgradavel(max: number): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const bruto = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / p;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  const topo = Math.ceil(max / passo - 1e-9) * passo;
  const ticks: number[] = [];
  for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: topo, ticks };
}

const fmtDia = (opcoes: Intl.DateTimeFormatOptions) => (dia: number) =>
  new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: "UTC" }).format(dia);

export const diaMes = fmtDia({ day: "2-digit", month: "2-digit" });
export const diaMesAno = fmtDia({ day: "2-digit", month: "2-digit", year: "numeric" });
export const mesCurto = (dia: number) => fmtDia({ month: "short" })(dia).replace(".", "");
