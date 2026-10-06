import { hojeIso } from "./diasUteis";
import { FUSO_NEGOCIO } from "./fuso";

// Horários fixos para agendar o Pré-Safra dos clientes: de 1 em 1 hora, das 07:00 às 17:00
// (o último atendimento termina às 17:40). Para mudar a grade, basta alterar as constantes.
const PRIMEIRA_HORA = 7;
const ULTIMA_HORA = 17;

export const HORARIOS: readonly string[] = Array.from(
  { length: ULTIMA_HORA - PRIMEIRA_HORA + 1 },
  (_, i) => `${String(PRIMEIRA_HORA + i).padStart(2, "0")}:00`,
);

export function horarioValido(v: string | null | undefined): v is string {
  return !!v && HORARIOS.includes(v);
}

/** Hora de agora em Mato Grosso, como "hh:mm" (o servidor roda em UTC). */
export function horaAgora(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_NEGOCIO,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(agora);
}

/**
 * Texto pronto para mostrar se o horário ("hh:mm") de hoje ("aaaa-mm-dd") já passou; null caso
 * contrário. Só vale para hoje: em dia futuro qualquer horário da grade serve. Como "hh:mm" tem
 * sempre dois dígitos, a comparação de texto equivale à de horas.
 */
export function motivoHorarioPassado(data: string, horario: string, agora: Date = new Date()): string | null {
  if (!data || !horario || data !== hojeIso(agora)) return null;
  return horario < horaAgora(agora) ? "Não é possível agendar horário retroativo." : null;
}
