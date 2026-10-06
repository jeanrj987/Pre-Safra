// Dias em que não se agenda o Pré-Safra: sábados, domingos e feriados. Trabalha só com datas
// no formato "aaaa-mm-dd" (o mesmo do campo de data do navegador), calculadas em UTC — sem
// hora, para não depender do fuso do servidor.

import { diaHoje } from "./status";

const NOME_DIA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// Feriados nacionais fixos, no formato "mm-dd".
const FERIADOS_FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Consciência Negra",
  "12-25": "Natal",
};

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como dia UTC em ms.
function pascoa(ano: number): number {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const DIA_MS = 24 * 60 * 60 * 1000;

// Feriados que mudam de data com a Páscoa. Carnaval e Corpus Christi são pontos facultativos,
// mas na prática ninguém atende: ficam bloqueados também.
function feriadosMoveis(ano: number): Record<number, string> {
  const p = pascoa(ano);
  return {
    [p - 48 * DIA_MS]: "Carnaval",
    [p - 47 * DIA_MS]: "Carnaval",
    [p - 2 * DIA_MS]: "Sexta-feira Santa",
    [p + 60 * DIA_MS]: "Corpus Christi",
  };
}

function partes(data: string): { ano: number; mes: number; dia: number; ms: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  // Rejeita datas que o calendário "corrige" (ex.: 2026-02-31).
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return { ano, mes, dia, ms };
}

/** Nome do feriado naquele dia ("aaaa-mm-dd"), ou null se não for feriado. */
export function nomeDoFeriado(data: string): string | null {
  const p = partes(data);
  if (!p) return null;
  const fixo = FERIADOS_FIXOS[`${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`];
  return fixo ?? feriadosMoveis(p.ano)[p.ms] ?? null;
}

/**
 * Motivo pelo qual não dá para agendar naquele dia ("aaaa-mm-dd"), ou null se o dia é livre.
 * Texto pronto para mostrar ao usuário.
 */
export function motivoDiaBloqueado(data: string): string | null {
  const p = partes(data);
  if (!p) return null;
  const diaSemana = new Date(p.ms).getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return `Não é possível agendar em ${NOME_DIA[diaSemana]}.`;
  }
  const feriado = nomeDoFeriado(data);
  return feriado ? `Não é possível agendar em feriado (${feriado}).` : null;
}

/** Hoje no calendário do Brasil, como "aaaa-mm-dd" (o formato do campo de data do navegador). */
export function hojeIso(agora: Date = new Date()): string {
  return new Date(diaHoje(agora)).toISOString().slice(0, 10);
}

/** Texto pronto para mostrar se a data ("aaaa-mm-dd") já passou; null se é hoje ou futura. */
export function motivoDataPassada(data: string, agora: Date = new Date()): string | null {
  const p = partes(data);
  if (!p) return null;
  return p.ms < diaHoje(agora) ? "Não é possível agendar em uma data que já passou." : null;
}

/** Tudo o que impede agendar naquele dia: data passada, fim de semana ou feriado. */
export function motivoDataIndisponivel(data: string, agora: Date = new Date()): string | null {
  return motivoDataPassada(data, agora) ?? motivoDiaBloqueado(data);
}
