// Regras da seção Relatórios: filtros, agrupamentos e a série de evolução.
// Tudo aqui é função pura (sem banco), para poder ser testada. As consultas ficam em dados.ts
// (situação atual) e fotos.ts (histórico diário).
import type { Linha } from "./dados";
import { ITENS_FINALIZACAO, type ChaveItem, type MarcasFinalizacao } from "./finalizacao";
import { MOTIVOS_PENDENCIA, ROTULO_SEM_MOTIVO, STATUS_COM_PENDENCIA } from "./pendencia";
import { normalizar } from "./texto";
import { STATUS_AGENDADOS, type StatusPreSafra } from "./status";

export const DIA = 24 * 60 * 60 * 1000;

export const ROTULO_SEM_REGIAO = "Sem região";
export const ROTULO_SEM_RESPONSAVEL = "Sem responsável";
export const ROTULO_SEM_CONSULTOR = "Sem consultor";

export const TIPOS_RELATORIO = [
  { id: "situacao", rotulo: "Situação da safra", descricao: "Cada cliente com status, data e motivo de pendência." },
  { id: "pessoas", rotulo: "Por pessoa", descricao: "Entrega por responsável, região ou consultor." },
  { id: "conferencia", rotulo: "Conferência", descricao: "O que falta marcar nos clientes finalizados." },
  { id: "evolucao", rotulo: "Evolução", descricao: "Como a safra andou dia a dia (fotos diárias)." },
] as const;

export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]["id"];

export const TIPO_PADRAO: TipoRelatorio = "situacao";

export function tipoValido(valor: string | undefined): TipoRelatorio {
  return TIPOS_RELATORIO.find((t) => t.id === valor)?.id ?? TIPO_PADRAO;
}

export type Dimensao = "responsavel" | "regiao" | "consultor";

export const DIMENSOES: { id: Dimensao; rotulo: string }[] = [
  { id: "responsavel", rotulo: "Responsável" },
  { id: "regiao", rotulo: "Região" },
  { id: "consultor", rotulo: "Consultor" },
];

export function dimensaoValida(valor: string | undefined): Dimensao {
  return DIMENSOES.find((d) => d.id === valor)?.id ?? "responsavel";
}

/** Todos os status que podem aparecer num relatório, na ordem em que são mostrados. */
export const STATUS_RELATORIO: readonly StatusPreSafra[] = [
  "Atrasado",
  "A Fazer",
  "Agendado Online",
  "Agendado Presencial",
  "Finalizado",
  "Inativo",
];

export const statusValido = (v: string): v is StatusPreSafra =>
  (STATUS_RELATORIO as readonly string[]).includes(v);

export interface FiltrosRelatorio {
  regioes: string[];
  responsaveis: string[];
  status: StatusPreSafra[];
}

export const SEM_FILTROS: FiltrosRelatorio = { regioes: [], responsaveis: [], status: [] };

const naLista = (lista: string[], valor: string) => {
  const chave = normalizar(valor.trim());
  return lista.some((x) => normalizar(x.trim()) === chave);
};

export const bateRegiao = (regiao: string | null, selecionadas: string[]) =>
  selecionadas.length === 0 || naLista(selecionadas, regiao?.trim() || ROTULO_SEM_REGIAO);

export const bateResponsavel = (responsavel: string | null, selecionados: string[]) =>
  selecionados.length === 0 || naLista(selecionados, responsavel?.trim() || ROTULO_SEM_RESPONSAVEL);

export function filtrarLinhas(linhas: Linha[], f: FiltrosRelatorio): Linha[] {
  return linhas.filter(
    (l) =>
      bateRegiao(l.regiao, f.regioes) &&
      bateResponsavel(l.responsavel, f.responsaveis) &&
      (f.status.length === 0 || f.status.includes(l.status)),
  );
}

/** Regiões e responsáveis que existem nas linhas, para montar as opções dos filtros. */
export function opcoesDeFiltro(linhas: { regiao: string | null; responsavel: string | null }[]) {
  const unicos = (valores: (string | null)[], semValor: string) => {
    const nomes = new Map<string, string>();
    let faltou = false;
    for (const v of valores) {
      const nome = v?.trim();
      if (!nome) faltou = true;
      else if (!nomes.has(normalizar(nome))) nomes.set(normalizar(nome), nome);
    }
    const lista = [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return faltou ? [...lista, semValor] : lista;
  };
  return {
    regioes: unicos(linhas.map((l) => l.regiao), ROTULO_SEM_REGIAO),
    responsaveis: unicos(linhas.map((l) => l.responsavel), ROTULO_SEM_RESPONSAVEL),
  };
}

export type Contagem = Record<StatusPreSafra, number>;

export function contarPorStatus(linhas: { status: StatusPreSafra }[]): Contagem {
  const c: Contagem = {
    Atrasado: 0,
    "A Fazer": 0,
    "Agendado Online": 0,
    "Agendado Presencial": 0,
    Finalizado: 0,
    Inativo: 0,
  };
  for (const l of linhas) c[l.status]++;
  return c;
}

/** Percentual inteiro (0 a 100); zero quando não há base. */
export const percentual = (parte: number, total: number) => (total === 0 ? 0 : Math.round((parte / total) * 100));

// ---- Situação da safra ---------------------------------------------------------------------

export interface LinhaMotivo {
  rotulo: string;
  atrasados: number;
  aFazer: number;
  total: number;
}

/** Clientes pendentes (A Fazer e Atrasado) por motivo; o "sem motivo" fica sempre por último. */
export function pendenciasPorMotivo(linhas: Linha[]): LinhaMotivo[] {
  const pendentes = linhas.filter((l) => STATUS_COM_PENDENCIA.includes(l.status));
  const montar = (rotulo: string, itens: Linha[]): LinhaMotivo => {
    const atrasados = itens.filter((l) => l.status === "Atrasado").length;
    return { rotulo, atrasados, aFazer: itens.length - atrasados, total: itens.length };
  };
  const linhasMotivo = MOTIVOS_PENDENCIA.map((m) =>
    montar(m.rotulo, pendentes.filter((l) => l.motivoPendencia === m.valor)),
  );
  const semMotivo = montar(
    ROTULO_SEM_MOTIVO,
    pendentes.filter((l) => !MOTIVOS_PENDENCIA.some((m) => m.valor === l.motivoPendencia)),
  );
  return [...linhasMotivo.filter((m) => m.total > 0), ...(semMotivo.total > 0 ? [semMotivo] : [])];
}

// ---- Por pessoa / região / consultor -------------------------------------------------------

export interface LinhaGrupo {
  nome: string;
  total: number;
  finalizados: number;
  agendados: number;
  aFazer: number;
  atrasados: number;
  /** Percentual de finalizados entre os clientes ativos do grupo. */
  pct: number;
  online: number;
  presencial: number;
  /** Finalizados que passaram da data prevista, e a média de dias que passaram. */
  concluidosComAtraso: number;
  atrasoMedio: number | null;
}

/** Resumo de um conjunto de clientes. Inativos ficam de fora: não entram na meta. */
export function resumir(nome: string, linhas: Linha[]): LinhaGrupo {
  const ativos = linhas.filter((l) => l.status !== "Inativo");
  const c = contarPorStatus(ativos);
  const finalizados = ativos.filter((l) => l.status === "Finalizado");
  const atrasos = finalizados.map((l) => l.atrasoNaConclusao).filter((d): d is number => d !== null);
  const comFormato = ativos.filter((l) => l.status === "Finalizado" || STATUS_AGENDADOS.includes(l.status));
  return {
    nome,
    total: ativos.length,
    finalizados: c.Finalizado,
    agendados: c["Agendado Online"] + c["Agendado Presencial"],
    aFazer: c["A Fazer"],
    atrasados: c.Atrasado,
    pct: percentual(c.Finalizado, ativos.length),
    online: comFormato.filter((l) => l.formato === "Online").length,
    presencial: comFormato.filter((l) => l.formato === "Presencial").length,
    concluidosComAtraso: atrasos.length,
    atrasoMedio: atrasos.length > 0 ? Math.round(atrasos.reduce((a, b) => a + b, 0) / atrasos.length) : null,
  };
}

const chaveDaDimensao = (l: Linha, dim: Dimensao): string => {
  if (dim === "regiao") return l.regiao?.trim() || ROTULO_SEM_REGIAO;
  if (dim === "consultor") return l.consultor?.trim() || ROTULO_SEM_CONSULTOR;
  return l.responsavel?.trim() || ROTULO_SEM_RESPONSAVEL;
};

const SEM_VALOR = new Set([ROTULO_SEM_REGIAO, ROTULO_SEM_RESPONSAVEL, ROTULO_SEM_CONSULTOR]);

/** Um resumo por pessoa (ou região, ou consultor): quem tem mais a fazer vem primeiro; "sem …" por último. */
export function agruparPor(linhas: Linha[], dim: Dimensao): LinhaGrupo[] {
  const grupos = new Map<string, { nome: string; itens: Linha[] }>();
  for (const l of linhas) {
    const nome = chaveDaDimensao(l, dim);
    const chave = normalizar(nome);
    const grupo = grupos.get(chave) ?? { nome, itens: [] };
    grupo.itens.push(l);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map((g) => resumir(g.nome, g.itens))
    .filter((g) => g.total > 0)
    .sort(
      (a, b) =>
        Number(SEM_VALOR.has(a.nome)) - Number(SEM_VALOR.has(b.nome)) ||
        b.total - b.finalizados - (a.total - a.finalizados) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

// ---- Conferência ---------------------------------------------------------------------------

export interface ClienteConferencia {
  id: number;
  nome: string;
  responsavel: string | null;
  regiao: string | null;
  marcas: MarcasFinalizacao;
  /** Chaves dos itens que ainda não foram marcados. */
  faltam: ChaveItem[];
}

export interface ResumoItem {
  chave: ChaveItem;
  rotulo: string;
  marcados: number;
  total: number;
  pct: number;
}

export interface Conferencia {
  itens: ResumoItem[];
  /** Finalizados com ao menos um item sem marcar, os que têm mais pendências primeiro. */
  incompletos: ClienteConferencia[];
  total: number;
}

/** Só clientes finalizados entram: os itens são marcados ao finalizar. */
export function conferir(linhas: Linha[], marcasPorId: Map<number, MarcasFinalizacao>): Conferencia {
  const finalizados = linhas.filter((l) => l.status === "Finalizado" && marcasPorId.has(l.id));
  const clientes: ClienteConferencia[] = finalizados.map((l) => {
    const marcas = marcasPorId.get(l.id)!;
    return {
      id: l.id,
      nome: l.nome,
      responsavel: l.responsavel,
      regiao: l.regiao,
      marcas,
      faltam: ITENS_FINALIZACAO.filter((i) => !marcas[i.chave]).map((i) => i.chave),
    };
  });
  return {
    total: clientes.length,
    itens: ITENS_FINALIZACAO.map((i) => {
      const marcados = clientes.filter((c) => c.marcas[i.chave]).length;
      return { chave: i.chave, rotulo: i.rotulo, marcados, total: clientes.length, pct: percentual(marcados, clientes.length) };
    }),
    incompletos: clientes
      .filter((c) => c.faltam.length > 0)
      .sort((a, b) => b.faltam.length - a.faltam.length || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

// ---- Evolução (fotos diárias) --------------------------------------------------------------

export interface FotoLinha {
  /** Dia da foto, em UTC (ms). */
  dia: number;
  status: string;
  responsavel: string | null;
  regiao: string | null;
}

export interface PontoEvolucao {
  dia: number;
  por: Contagem;
  /** Clientes ativos no dia (tudo, menos Inativo). */
  ativos: number;
  pctFinalizado: number;
}

/** Uma linha por dia com a contagem por status, já aplicando os filtros de região e responsável. */
export function serieEvolucao(fotos: FotoLinha[], f: FiltrosRelatorio): PontoEvolucao[] {
  const porDia = new Map<number, Contagem>();
  for (const foto of fotos) {
    if (!statusValido(foto.status)) continue;
    if (!bateRegiao(foto.regiao, f.regioes) || !bateResponsavel(foto.responsavel, f.responsaveis)) continue;
    const c = porDia.get(foto.dia) ?? contarPorStatus([]);
    c[foto.status]++;
    porDia.set(foto.dia, c);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dia, por]) => {
      const ativos = por.Atrasado + por["A Fazer"] + por["Agendado Online"] + por["Agendado Presencial"] + por.Finalizado;
      return { dia, por, ativos, pctFinalizado: percentual(por.Finalizado, ativos) };
    });
}

// ---- Datas dos filtros ---------------------------------------------------------------------

/** "2026-10-27" vira o dia em UTC (ms); texto inválido vira null. */
export function lerDiaIso(texto: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto ?? "");
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  return d.getUTCMonth() === Number(m[2]) - 1 ? ms : null;
}

export const diaParaIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Período pedido, com no máximo 366 dias; sem datas, os últimos 30 dias até hoje. */
export function periodoEvolucao(de: string | undefined, ate: string | undefined, hoje: number) {
  const fim = Math.min(lerDiaIso(ate) ?? hoje, hoje);
  const inicioPedido = lerDiaIso(de) ?? fim - 29 * DIA;
  const inicio = Math.max(Math.min(inicioPedido, fim), fim - 365 * DIA);
  return { inicio, fim };
}
