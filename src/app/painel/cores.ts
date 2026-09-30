// Classes fixas por situação (o Tailwind só gera classes que aparecem escritas por inteiro).
export const COR = {
  fin: { fill: "fill-st-fin", bg: "bg-st-fin", on: "fill-on-fin", css: "var(--color-st-fin)" },
  age: { fill: "fill-st-age", bg: "bg-st-age", on: "fill-on-age", css: "var(--color-st-age)" },
  atr: { fill: "fill-st-atr", bg: "bg-st-atr", on: "fill-on-atr", css: "var(--color-st-atr)" },
  sem: { fill: "fill-st-sem", bg: "bg-st-sem", on: "fill-on-sem", css: "var(--color-st-sem)" },
} as const;

export const nf = new Intl.NumberFormat("pt-BR");
export const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Largura estimada de um texto (px), para decidir se cabe dentro de uma barra. */
export const larguraTexto = (s: string | number, px = 6.4) => String(s).length * px;

export function cortar(s: string, max: number): string {
  return larguraTexto(s) <= max ? s : s.slice(0, Math.max(3, Math.floor(max / 6.4) - 1)) + "…";
}
