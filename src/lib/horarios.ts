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
