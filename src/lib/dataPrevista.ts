// Edição da data prevista (a "data de finalização") direto no registro do cliente. Qualquer
// usuário com acesso completo pode alterá-la; a regra é que ela nunca fique antes do início.
// Sem imports de servidor: a tela usa estas funções para montar o campo de data.
import { hojeIso, motivoDataDistante, motivoDataPassada, motivoDiaBloqueado } from "./diasUteis";
import { diaHoje } from "./status";

export type ErroDataPrevista = "invalida" | "passada" | "distante" | "bloqueada" | "anterior";

export const MENSAGEM_ERRO_DATA: Record<ErroDataPrevista, string> = {
  invalida: "informe uma data válida.",
  passada: "a data não pode ser retroativa.",
  distante: "a data não pode ter mais de um ano de antecedência.",
  bloqueada: "não dá para usar sábado, domingo ou feriado.",
  anterior: "a data de finalização não pode ser anterior à data de início.",
};

const dataReal = (data: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(data) && new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) === data;

/**
 * Dia em que o agendamento começou ("aaaa-mm-dd"): o dia (em Mato Grosso) de `agendadoEm`; sem
 * agendamento registrado, o início da safra.
 */
export function inicioDoAgendamento(agendadoEm: Date | null, inicioSafra: Date): string {
  const base = agendadoEm ? new Date(diaHoje(agendadoEm)) : inicioSafra;
  return base.toISOString().slice(0, 10);
}

/** Menor data aceita no campo: o início do agendamento, ou hoje se for mais tarde (não se agenda no passado). */
export function dataMinimaIso(inicio: string, agora: Date = new Date()): string {
  const hoje = hojeIso(agora);
  return inicio > hoje ? inicio : hoje;
}

/** Por que a data ("aaaa-mm-dd") não pode ser a nova data de finalização; null se pode. */
export function erroDataPrevista(data: string, inicio: string, agora: Date = new Date()): ErroDataPrevista | null {
  if (!dataReal(data)) return "invalida";
  if (data < inicio) return "anterior";
  if (motivoDataPassada(data, agora)) return "passada";
  if (motivoDataDistante(data, agora)) return "distante";
  if (motivoDiaBloqueado(data)) return "bloqueada";
  return null;
}
