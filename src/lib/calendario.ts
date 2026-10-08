// Contas de calendário da aba "Calendário". Trabalha só com datas "aaaa-mm-dd" (o formato do
// campo de data do navegador) e meses "aaaa-mm", calculados em UTC — sem hora, para não depender
// do fuso do servidor (mesmo padrão de src/lib/diasUteis.ts).

import { motivoDataForaDoPrazo } from "./diasUteis";
import { motivoHorarioPassado } from "./horarios";
import { calcularStatus, STATUS_AGENDADOS, type StatusPreSafra } from "./status";

/**
 * Situações do Pré-Safra de um cliente que aparecem no calendário: os agendados (online e
 * presencial), os atrasados e os finalizados (que continuam marcados no dia em que estavam
 * agendados, já como finalizados). "A Fazer" e "Inativo" não entram.
 */
export const STATUS_NO_CALENDARIO: readonly StatusPreSafra[] = [...STATUS_AGENDADOS, "Atrasado", "Finalizado"];

/** Linha do Pré-Safra com o que o calendário precisa para decidir se mostra o cliente. */
export interface RegistroParaCalendario {
  id: number;
  nome: string;
  dataPrevista: Date | null;
  horario: string | null;
  formato: string | null;
  configuradoSistema: boolean;
  inativo: boolean;
  responsavel: string | null;
}

export interface AgendamentoCalendario {
  id: number;
  nome: string;
  /** "aaaa-mm-dd" */
  data: string;
  /** "hh:mm"; nulo se o cliente tem data mas não tem horário */
  horario: string | null;
  responsavel: string | null;
  status: StatusPreSafra;
}

/** Os clientes que entram no calendário, cada um no dia da sua data prevista, com o status de hoje. */
export function agendamentosDoCalendario(
  registros: RegistroParaCalendario[],
  agora: Date = new Date(),
): AgendamentoCalendario[] {
  const lista: AgendamentoCalendario[] = [];
  for (const r of registros) {
    if (!r.dataPrevista) continue;
    const status = calcularStatus(r, agora);
    if (!STATUS_NO_CALENDARIO.includes(status)) continue;
    lista.push({
      id: r.id,
      nome: r.nome,
      data: r.dataPrevista.toISOString().slice(0, 10),
      horario: r.horario,
      responsavel: r.responsavel,
      status,
    });
  }
  return lista.sort(
    (a, b) =>
      a.data.localeCompare(b.data) || (a.horario ?? "").localeCompare(b.horario ?? "") || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

// Diferente do agendamento de clientes (grade fixa de hora em hora), o horário da atividade é
// livre: qualquer "hh:mm" do dia, como 08:30 ou 14:45.
const HORARIO_LIVRE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const NOMES_MES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// A semana começa no domingo, como no calendário de referência da equipe.
export const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DIA_MS = 24 * 60 * 60 * 1000;

// Anos que a navegação pela URL aceita (?mes=aaaa-mm).
const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2100;

export interface MesCalendario {
  ano: number;
  /** 1 a 12 */
  mes: number;
}

/** Mês pedido na URL ("aaaa-mm"); se faltar ou for inválido, usa o mês de `hoje` ("aaaa-mm-dd"). */
export function mesDe(texto: string | undefined, hoje: string): MesCalendario {
  const m = /^(\d{4})-(\d{2})$/.exec(texto ?? "");
  if (m) {
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    if (mes >= 1 && mes <= 12 && ano >= ANO_MINIMO && ano <= ANO_MAXIMO) return { ano, mes };
  }
  return { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
}

export function chaveMes({ ano, mes }: MesCalendario): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Mês vizinho: `delta` = -1 (anterior) ou 1 (próximo). */
export function mesVizinho({ ano, mes }: MesCalendario, delta: number): MesCalendario {
  const indice = ano * 12 + (mes - 1) + delta;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

function isoDeMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Todas as semanas que tocam o mês, de domingo a sábado, com os dias vizinhos completando a grade. */
export function semanasDoMes({ ano, mes }: MesCalendario): string[][] {
  const primeiro = Date.UTC(ano, mes - 1, 1);
  const ultimo = Date.UTC(ano, mes, 0);
  const inicio = primeiro - new Date(primeiro).getUTCDay() * DIA_MS;
  const fim = ultimo + (6 - new Date(ultimo).getUTCDay()) * DIA_MS;

  const semanas: string[][] = [];
  for (let semana = inicio; semana <= fim; semana += 7 * DIA_MS) {
    semanas.push(Array.from({ length: 7 }, (_, i) => isoDeMs(semana + i * DIA_MS)));
  }
  return semanas;
}

// As atividades seguem as regras do agendamento de clientes (src/app/acoes.ts e Agendar.tsx),
// menos uma: podem cair em sábado, domingo e feriado. Data e horário obrigatórios; data sem
// passado nem mais de um ano à frente; horário (livre, qualquer hh:mm) que, hoje, só vale de
// agora em diante.
// Uma atividade que já existe e não teve a data (ou o horário) alterada não é barrada de novo:
// senão ninguém conseguiria marcar como feita, nem corrigir o título, de uma atividade que
// ficou no passado.

/** Motivo pelo qual a data não serve; null se está ok. `original` é a data já salva, se houver. */
export function motivoDataAtividade(data: string, original?: string, agora: Date = new Date()): string | null {
  if (!data) return "Informe a data.";
  if (data === original) return null;
  return motivoDataForaDoPrazo(data, agora);
}

/** Motivo pelo qual o horário não serve; null se está ok. `original` traz data e horário já salvos. */
export function motivoHorarioAtividade(
  data: string,
  horario: string,
  original?: { data: string; horario: string | null },
  agora: Date = new Date(),
): string | null {
  if (!horario) return "Informe o horário.";
  if (original && data === original.data && horario === original.horario) return null;
  if (!HORARIO_LIVRE.test(horario)) return "Informe um horário válido, como 08:30.";
  return motivoHorarioPassado(data, horario, agora);
}

/**
 * Quem pode editar, concluir ou excluir uma atividade: o admin e o próprio dono. Todos os usuários
 * veem todas as atividades, mas só mexem nas que lançaram. Nas atividades antigas, sem o id do
 * dono, vale o nome de quem lançou.
 */
export function podeAlterarAtividade(
  usuario: { id: number; nome: string; admin: boolean },
  atividade: { criadoPorId: number | null; criadoPor: string | null },
): boolean {
  if (usuario.admin) return true;
  if (atividade.criadoPorId !== null) return atividade.criadoPorId === usuario.id;
  const nome = (t: string) => t.trim().toLowerCase();
  return !!atividade.criadoPor && nome(atividade.criadoPor) === nome(usuario.nome);
}

/** "quarta-feira, 7 de outubro de 2026" — título da janela de um dia. */
export function dataPorExtenso(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data}T00:00:00Z`));
}
