export type StatusPreSafra = "Finalizado" | "Atrasado" | "A Fazer" | "Inativo";

export interface DadosStatus {
  configuradoSistema: boolean;
  dataPrevista: Date | null;
  inativo?: boolean;
}

const MS_DIA = 24 * 60 * 60 * 1000;

// Datas de negócio são só dia/mês/ano. Compara sempre em UTC, sem hora.
function diaUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function calcularStatus(
  { configuradoSistema, dataPrevista, inativo }: DadosStatus,
  hoje: Date = new Date(),
): StatusPreSafra {
  if (inativo) return "Inativo";
  if (configuradoSistema) return "Finalizado";
  if (dataPrevista && diaUtc(dataPrevista) < diaHoje(hoje)) return "Atrasado";
  return "A Fazer";
}

export function diasEmAtraso(
  dados: DadosStatus,
  hoje: Date = new Date(),
): number | null {
  if (calcularStatus(dados, hoje) !== "Atrasado" || !dados.dataPrevista) {
    return null;
  }
  return Math.round((diaHoje(hoje) - diaUtc(dados.dataPrevista)) / MS_DIA);
}

// Dias que a finalização passou da data prevista; null se foi no prazo ou sem data.
export function diasAtrasoNaConclusao(
  dataPrevista: Date | null,
  concluidoEm: Date | null,
): number | null {
  if (!dataPrevista || !concluidoEm) return null;
  const dias = Math.round((diaHoje(concluidoEm) - diaUtc(dataPrevista)) / MS_DIA);
  return dias > 0 ? dias : null;
}

export function mesPrevisto(dataPrevista: Date | null): string | null {
  if (!dataPrevista) return null;
  const mes = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(dataPrevista)
    .replace(".", "");
  return `${mes}/${dataPrevista.getUTCFullYear()}`;
}

// "Hoje" segue o calendário do Brasil (servidor costuma rodar em UTC).
export function diaHoje(agora: Date): number {
  const [d, m, a] = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })
    .format(agora)
    .split("/")
    .map(Number);
  return Date.UTC(a, m - 1, d);
}
