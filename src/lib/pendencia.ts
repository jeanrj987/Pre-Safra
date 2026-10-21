// Motivo de pendência dos clientes "A Fazer" e "Atrasado": por que o Pré-Safra ainda não foi feito. O
// motivo é uma lista fixa (guardada como texto, então dá para mudar a lista sem alterar o banco),
// mais uma observação curta e opcional. Sem motivo guardado = "Sem motivo definido".
// Sem imports de servidor: a lista e o seletor da tela (cliente) usam este catálogo.
import type { StatusPreSafra } from "./status";

export const MOTIVOS_PENDENCIA = [
  { valor: "nao-respondeu", rotulo: "Não respondeu" },
  { valor: "falta-comunicacao", rotulo: "Falta de comunicação" },
  { valor: "reagendando", rotulo: "Reagendando" },
] as const;

export type MotivoPendencia = (typeof MOTIVOS_PENDENCIA)[number]["valor"];

export const ROTULO_SEM_MOTIVO = "Sem motivo definido";

/** Valor do filtro que reúne os clientes "A Fazer" que ainda não têm motivo. */
export const FILTRO_SEM_MOTIVO = "sem-motivo";

export const TAMANHO_MAX_OBSERVACAO = 100;

/** Só "A Fazer" e "Atrasado" carregam motivo: agendar ou finalizar o cliente encerra a pendência. */
export const STATUS_COM_PENDENCIA: readonly StatusPreSafra[] = ["A Fazer", "Atrasado"];

export function motivoPendenciaValido(valor: string | null | undefined): valor is MotivoPendencia {
  return MOTIVOS_PENDENCIA.some((m) => m.valor === valor);
}

export function rotuloMotivoPendencia(valor: string | null | undefined): string {
  return MOTIVOS_PENDENCIA.find((m) => m.valor === valor)?.rotulo ?? ROTULO_SEM_MOTIVO;
}

/** Observação sem espaços sobrando e no tamanho máximo; vazia vira null. */
export function limparObservacaoPendencia(texto: string | null | undefined): string | null {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAX_OBSERVACAO).trim();
  return limpo || null;
}

/** Do que vem da URL, só os valores de filtro que existem, sem repetição. */
export function filtrosMotivoValidos(valores: readonly string[]): string[] {
  return [...new Set(valores.filter((v) => v === FILTRO_SEM_MOTIVO || motivoPendenciaValido(v)))];
}

/**
 * O cliente passa no filtro de motivos? Sem nenhum selecionado, todos passam. Com seleção, só
 * entram clientes pendentes (A Fazer ou Atrasado) cujo motivo seja um dos escolhidos (ou que não tenham motivo, se
 * "Sem motivo definido" estiver entre eles).
 */
export function bateFiltroMotivo(
  linha: { status: StatusPreSafra; motivoPendencia: string | null },
  selecionados: readonly string[],
): boolean {
  if (selecionados.length === 0) return true;
  if (!STATUS_COM_PENDENCIA.includes(linha.status)) return false;
  return selecionados.some((s) => (s === FILTRO_SEM_MOTIVO ? !linha.motivoPendencia : s === linha.motivoPendencia));
}
