import { FUSO_NEGOCIO } from "./fuso";
import { COMERCIAL_POR_REGIAO, equipesPorRegiao, type GrupoEquipe } from "./equipe";
import { prisma } from "@/lib/db";
import { pessoasDaDupla } from "@/lib/painel";
import {
  calcularStatus,
  diasAtrasoNaConclusao,
  diasEmAtraso,
  mesPrevisto,
  type StatusPreSafra,
} from "@/lib/status";

// Para cada cliente, se o Pré-Safra mais recente dele está marcado como inativo (o mais
// recente entre todas as safras). Cliente sem nenhum Pré-Safra ainda não entra no mapa —
// quem usa isto trata a ausência como "ativo".
export async function statusInativoPorCliente(): Promise<Map<number, boolean>> {
  const historico = await prisma.preSafra.findMany({
    where: { clienteId: { not: null } },
    orderBy: { criadoEm: "desc" },
    select: { clienteId: true, inativo: true },
  });
  const mapa = new Map<number, boolean>();
  for (const p of historico) {
    if (p.clienteId !== null && !mapa.has(p.clienteId)) {
      mapa.set(p.clienteId, p.inativo);
    }
  }
  return mapa;
}

export interface Linha {
  id: number;
  nome: string;
  semCadastro: boolean;
  responsavel: string | null;
  /** Dupla de atendentes da região do cliente (ex.: "Maria e Jean"). */
  atendentes: string | null;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  consultor: string | null;
  dataPrevista: Date | null;
  /** Horário agendado ("HH:MM") dentro da data prevista. */
  horario: string | null;
  formato: string | null;
  observacao: string | null;
  status: StatusPreSafra;
  dias: number | null;
  /** Finalizado depois da data prevista: quantos dias depois. */
  atrasoNaConclusao: number | null;
  mes: string | null;
}

const ORDEM: Record<StatusPreSafra, number> = {
  Atrasado: 0,
  "A Fazer": 1,
  "Agendado Online": 2,
  "Agendado Presencial": 3,
  Finalizado: 4,
  Inativo: 5,
};

export async function listarLinhas(safraId: number): Promise<Linha[]> {
  const registros = await prisma.preSafra.findMany({
    where: { safraId },
    include: {
      cliente: { select: { nome: true, atendente: true, cidade: true, uf: true, regiao: true, consultor: true } },
      // Só a finalização em vigor interessa na lista; as anteriores ficam no histórico.
      conclusoes: {
        where: { reabertoEm: null },
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { observacao: true, criadoEm: true },
      },
    },
  });

  return registros
    .map((r): Linha => {
      const dados = {
        configuradoSistema: r.configuradoSistema,
        dataPrevista: r.dataPrevista,
        inativo: r.inativo,
        formato: r.formato,
      };
      return {
        id: r.id,
        nome: r.cliente?.nome ?? r.clienteNomeManual ?? "(sem nome)",
        semCadastro: !r.cliente,
        responsavel: r.responsavel,
        atendentes: r.cliente?.atendente ?? null,
        cidade: r.cliente?.cidade ?? null,
        uf: r.cliente?.uf ?? null,
        regiao: r.cliente?.regiao ?? null,
        consultor: r.cliente?.consultor ?? null,
        dataPrevista: r.dataPrevista,
        horario: r.horario,
        formato: r.formato,
        // Inativo mostra o motivo; senão, a observação da finalização em vigor; senão, a geral.
        observacao:
          (r.inativo && r.motivoInativacao?.trim()) ||
          (r.configuradoSistema && r.conclusoes[0]?.observacao?.trim()) ||
          r.observacoes?.trim() ||
          null,
        status: calcularStatus(dados),
        dias: diasEmAtraso(dados),
        atrasoNaConclusao:
          r.configuradoSistema && !r.inativo
            ? diasAtrasoNaConclusao(r.dataPrevista, r.conclusoes[0]?.criadoEm ?? null)
            : null,
        mes: mesPrevisto(r.dataPrevista),
      };
    })
    .sort(
      (a, b) =>
        ORDEM[a.status] - ORDEM[b.status] ||
        (b.dias ?? 0) - (a.dias ?? 0) ||
        (a.dataPrevista?.getTime() ?? Infinity) -
          (b.dataPrevista?.getTime() ?? Infinity) ||
        (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

// Junta duplas de atendentes com responsáveis já escolhidos numa lista única, sem repetição
// e ordenada — a mesma regra de "quem pode ser responsável" usada tanto a partir de linhas
// já carregadas em memória (nomesPossiveis) quanto direto do banco (listarNomesResponsaveis).
function coletarNomes(
  duplas: (string | null)[],
  responsaveis: (string | null)[],
  extras: (string | null)[] = [],
): string[] {
  const nomes = new Set<string>();
  duplas.forEach((d) => pessoasDaDupla(d).forEach((p) => nomes.add(p)));
  responsaveis.forEach((r) => r && nomes.add(r));
  extras.forEach((e) => e && nomes.add(e));
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Todos os nomes que podem ser responsáveis: atendentes das regiões e quem já foi escolhido. */
export function nomesPossiveis(linhas: Linha[]): string[] {
  return coletarNomes(
    linhas.map((l) => l.atendentes),
    linhas.map((l) => l.responsavel),
  );
}

/**
 * Nomes para escolher como responsável: atendentes das regiões, consultores, comerciais e quem
 * já foi escolhido.
 */
export async function listarNomesResponsaveis(): Promise<string[]> {
  const [duplas, escolhidos, consultores] = await Promise.all([
    prisma.cliente.findMany({
      where: { atendente: { not: null } },
      distinct: ["atendente"],
      select: { atendente: true },
    }),
    prisma.preSafra.findMany({
      where: { responsavel: { not: null } },
      distinct: ["responsavel"],
      select: { responsavel: true },
    }),
    prisma.cliente.findMany({
      where: { consultor: { not: null } },
      distinct: ["consultor"],
      select: { consultor: true },
    }),
  ]);
  return coletarNomes(
    duplas.map((d) => d.atendente),
    escolhidos.map((e) => e.responsavel),
    [...consultores.map((c) => c.consultor), ...Object.values(COMERCIAL_POR_REGIAO)],
  );
}

/** A equipe de cada região (atendentes, consultor, comercial), para escolher o responsável. */
export async function listarEquipesPorRegiao(): Promise<GrupoEquipe[]> {
  const clientes = await prisma.cliente.findMany({
    where: { regiao: { not: null } },
    select: { regiao: true, atendente: true, consultor: true },
  });
  return equipesPorRegiao(clientes.map((c) => ({ regiao: c.regiao, atendentes: c.atendente, consultor: c.consultor })));
}

/** Cidades já usadas em algum cliente, para sugerir no cadastro em vez de digitar do zero. */
export async function listarCidadesConhecidas(): Promise<string[]> {
  const linhas = await prisma.cliente.findMany({
    where: { cidade: { not: null } },
    distinct: ["cidade"],
    select: { cidade: true },
  });
  return linhas
    .map((l) => l.cidade as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** As 27 UFs do Brasil, para o campo ser um select fechado em vez de sugestão por uso. */
export const UFS_BRASIL = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

/** Regiões já usadas em algum cliente, para sugerir no cadastro em vez de exigir digitar do zero. */
export async function listarRegioesConhecidas(): Promise<string[]> {
  const linhas = await prisma.cliente.findMany({
    where: { regiao: { not: null } },
    distinct: ["regiao"],
    select: { regiao: true },
  });
  return linhas
    .map((l) => l.regiao as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Duplas de atendentes já cadastradas (ex.: "Maria e Jean"), para sugerir no cadastro. */
export async function listarDuplasConhecidas(): Promise<string[]> {
  const linhas = await prisma.cliente.findMany({
    where: { atendente: { not: null } },
    distinct: ["atendente"],
    select: { atendente: true },
  });
  return linhas
    .map((l) => l.atendente as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Consultores já cadastrados, para sugerir também no campo de Atendimento. */
export async function listarConsultoresConhecidos(): Promise<string[]> {
  const linhas = await prisma.cliente.findMany({
    where: { consultor: { not: null } },
    distinct: ["consultor"],
    select: { consultor: true },
  });
  return linhas
    .map((l) => l.consultor as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function contar(linhas: Linha[]) {
  const total: Record<StatusPreSafra, number> = {
    Atrasado: 0,
    "A Fazer": 0,
    "Agendado Online": 0,
    "Agendado Presencial": 0,
    Finalizado: 0,
    Inativo: 0,
  };
  for (const l of linhas) total[l.status]++;
  return {
    ...total,
    // Soma dos dois status agendados: é o que o card "Agendados" mostra.
    Agendado: total["Agendado Online"] + total["Agendado Presencial"],
    // "todos" considera só clientes ativos; inativos têm o próprio contador.
    todos: linhas.length - total.Inativo,
  };
}

export function formatarData(d: Date | null): string {
  return d
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d)
    : "—";
}

/** Data (dia UTC) no formato aaaa-mm-dd que o campo de data do navegador espera. */
export function dataParaCampo(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatarDataHora(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO_NEGOCIO,
  }).format(d);
}

export const COR_STATUS: Record<StatusPreSafra, string> = {
  Finalizado: "bg-finalizado-bg text-finalizado-fg",
  "A Fazer": "bg-afazer-bg text-afazer-fg",
  "Agendado Online": "bg-agendado-bg text-agendado-fg",
  "Agendado Presencial": "bg-presencial-bg text-presencial-fg",
  Atrasado: "bg-atrasado-bg text-atrasado-fg",
  Inativo: "bg-inativo-bg text-inativo-fg",
};

export const PONTO_STATUS: Record<StatusPreSafra, string> = {
  Finalizado: "bg-finalizado-dot",
  "A Fazer": "bg-afazer-dot",
  "Agendado Online": "bg-agendado-dot",
  "Agendado Presencial": "bg-presencial-dot",
  Atrasado: "bg-atrasado-dot",
  Inativo: "bg-inativo-dot",
};

export function formatarAtraso(dias: number): string {
  return `${dias} ${dias === 1 ? "dia" : "dias"} de atraso`;
}

export function formatarAtrasoConclusao(dias: number): string {
  return `Finalizado com ${formatarAtraso(dias)}`;
}
