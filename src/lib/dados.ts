import { cache } from "react";
import { FUSO_NEGOCIO } from "./fuso";
import { COMERCIAL_POR_REGIAO, REGIOES_DE_PARCEIROS, equipesPorRegiao, type GrupoEquipe } from "./equipe";
import { prisma } from "@/lib/db";
import { pessoasDaDupla } from "@/lib/painel";
import { semRepetir } from "@/lib/texto";
import { motivoPendenciaValido, STATUS_COM_PENDENCIA } from "@/lib/pendencia";
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
  /** WhatsApp do cliente (só dígitos, com 55); base do botão de mensagem rápida. */
  whatsapp: string | null;
  dataPrevista: Date | null;
  /** Horário agendado ("HH:MM") dentro da data prevista. */
  horario: string | null;
  formato: string | null;
  observacao: string | null;
  /** Por que o cliente "A Fazer" ainda não foi agendado; só existe nesse status (ver lib/pendencia.ts). */
  motivoPendencia: string | null;
  observacaoPendencia: string | null;
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
      cliente: { select: { nome: true, atendente: true, cidade: true, uf: true, regiao: true, consultor: true, whatsapp: true } },
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
      const status = calcularStatus(dados);
      const pendente = STATUS_COM_PENDENCIA.includes(status);
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
        whatsapp: r.cliente?.whatsapp ?? null,
        dataPrevista: r.dataPrevista,
        horario: r.horario,
        formato: r.formato,
        // Inativo mostra o motivo; senão, a observação da finalização em vigor; senão, a geral.
        observacao:
          (r.inativo && r.motivoInativacao?.trim()) ||
          (r.configuradoSistema && r.conclusoes[0]?.observacao?.trim()) ||
          r.observacoes?.trim() ||
          null,
        motivoPendencia: pendente && motivoPendenciaValido(r.motivoPendencia) ? r.motivoPendencia : null,
        observacaoPendencia: pendente ? r.observacaoPendencia : null,
        status,
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
  const nomes: string[] = [];
  duplas.forEach((d) => pessoasDaDupla(d).forEach((p) => nomes.push(p)));
  responsaveis.forEach((r) => r && nomes.push(r.trim()));
  extras.forEach((e) => e && nomes.push(e.trim()));
  return semRepetir(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

type ValoresCliente = {
  cidade: string | null;
  regiao: string | null;
  atendente: string | null;
  consultor: string | null;
  comercial: string | null;
};

// As listas de sugestão (cidades, regiões, duplas, consultores, comerciais, responsáveis e equipes)
// saem todas dos mesmos campos de Cliente. cache() faz uma única leitura por request, em vez de uma
// consulta por lista a cada abertura de página.
const carregarValoresClientes = cache(
  (): Promise<ValoresCliente[]> =>
    prisma.cliente.findMany({
      select: { cidade: true, regiao: true, atendente: true, consultor: true, comercial: true },
    }),
);

/** Valores preenchidos de um campo, mais os fixos, sem repetição e em ordem alfabética. */
function distintosOrdenados(
  clientes: ValoresCliente[],
  campo: keyof ValoresCliente,
  fixos: readonly string[] = [],
): string[] {
  const valores = new Set<string>(fixos);
  for (const c of clientes) {
    const v = c[campo];
    if (v !== null) valores.add(v);
  }
  return [...valores].sort((a, b) => a.localeCompare(b, "pt-BR"));
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
  const [clientes, escolhidos] = await Promise.all([
    carregarValoresClientes(),
    prisma.preSafra.findMany({
      where: { responsavel: { not: null } },
      distinct: ["responsavel"],
      select: { responsavel: true },
    }),
  ]);
  return coletarNomes(
    clientes.map((c) => c.atendente),
    escolhidos.map((e) => e.responsavel),
    [
      ...clientes.map((c) => c.consultor),
      ...clientes.map((c) => c.comercial),
      ...Object.values(COMERCIAL_POR_REGIAO),
    ],
  );
}

/** A equipe de cada região (atendentes, consultor, comercial), para escolher o responsável. */
export async function listarEquipesPorRegiao(): Promise<GrupoEquipe[]> {
  const clientes = await carregarValoresClientes();
  return equipesPorRegiao(
    clientes
      .filter((c) => c.regiao !== null)
      .map((c) => ({ regiao: c.regiao, atendentes: c.atendente, consultor: c.consultor, comercial: c.comercial })),
  );
}

/** Cidades que sempre aparecem na lista, mesmo antes de existir um cliente nelas (a UF é escolhida à parte). */
const CIDADES_FIXAS = ["Cujubim", "Maracaju"];

/** Cidades já usadas em algum cliente, mais as fixas, para sugerir no cadastro em vez de digitar do zero. */
export async function listarCidadesConhecidas(): Promise<string[]> {
  return distintosOrdenados(await carregarValoresClientes(), "cidade", CIDADES_FIXAS);
}

/** As 27 UFs do Brasil, para o campo ser um select fechado em vez de sugestão por uso. */
export const UFS_BRASIL = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

/** Regiões já usadas em algum cliente, mais as dos parceiros, para sugerir no cadastro em vez de exigir digitar do zero. */
export async function listarRegioesConhecidas(): Promise<string[]> {
  return distintosOrdenados(await carregarValoresClientes(), "regiao", REGIOES_DE_PARCEIROS);
}

/** Duplas de atendentes já cadastradas (ex.: "Maria e Jean"), para sugerir no cadastro. */
export async function listarDuplasConhecidas(): Promise<string[]> {
  return distintosOrdenados(await carregarValoresClientes(), "atendente");
}

/** Consultores já cadastrados, para sugerir também no campo de Atendimento. */
export async function listarConsultoresConhecidos(): Promise<string[]> {
  return distintosOrdenados(await carregarValoresClientes(), "consultor");
}

/** Comerciais já usados em algum cliente, mais os fixos das regiões, para escolher no cadastro. */
export async function listarComerciaisConhecidos(): Promise<string[]> {
  return distintosOrdenados(await carregarValoresClientes(), "comercial", Object.values(COMERCIAL_POR_REGIAO));
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
