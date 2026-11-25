// Impressão dos relatórios ("Salvar em PDF"): nome sugerido para o arquivo e o CSS de página.
// Funções puras (sem banco), testadas em impressaoRelatorio.test.ts.
import { FUSO_NEGOCIO } from "./fuso";
import { plural } from "./texto";

/** Caracteres que o Windows (e parte dos outros sistemas) não aceita em nome de arquivo. */
const INVALIDOS_EM_ARQUIVO = /[\\/:*?"<>|]/g;

// Com 1 ou 2 nomes, os nomes ("Norte e Sul"); com 3 ou mais, só a quantidade ("3 regiões").
function resumoDaLista(nomes: readonly string[], singular: string, pluralRotulo: string): string {
  if (nomes.length === 0) return "";
  if (nomes.length <= 2) return nomes.join(" e ");
  return plural(nomes.length, singular, pluralRotulo);
}

/** "25-11-2026": o dia de `agora` no fuso da equipe (o mesmo de formatarDataHora). */
export function diaParaArquivo(agora: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: FUSO_NEGOCIO,
  })
    .format(agora)
    .replaceAll("/", "-");
}

/**
 * Nome sugerido para o PDF de qualquer relatório:
 * "<rótulo> - <safra> - <regiões> - <responsáveis> - <status> - <dd-mm-aaaa>", sem as partes de
 * filtro que não estiverem em uso. Cada filtro com 1 ou 2 valores sai pelos nomes ("A Fazer e
 * Atrasado"); com 3 ou mais, pela quantidade ("3 regiões", "4 status").
 * Ex.: "Situação da safra - Safra 26-27 - Sorriso e Região - 25-11-2026".
 */
export function nomeArquivoRelatorio(dados: {
  rotulo: string;
  safra: string;
  regioes: string[];
  responsaveis: string[];
  /** Filtro de status (só a situação da safra tem); sem filtro, lista vazia. */
  status?: readonly string[];
  agora: Date;
}): string {
  const partes = [
    dados.rotulo,
    dados.safra.replaceAll("/", "-"),
    resumoDaLista(dados.regioes, "região", "regiões"),
    resumoDaLista(dados.responsaveis, "responsável", "responsáveis"),
    resumoDaLista(dados.status ?? [], "status", "status"),
    diaParaArquivo(dados.agora),
  ];
  return partes
    .map((p) => p.replace(INVALIDOS_EM_ARQUIVO, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" - ");
}

/**
 * Texto entre aspas para usar como `content` no CSS. Escapa a barra invertida e as aspas, troca
 * quebras de linha por espaço e escapa "<" e ">" para o texto nunca fechar a tag <style>.
 */
export function textoCss(texto: string): string {
  const escapado = texto
    .replace(/[\r\n\t\f\v]+/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("<", "\\3C ")
    .replaceAll(">", "\\3E ");
  return `"${escapado}"`;
}

/**
 * CSS da página impressa dos relatórios.
 *
 * - A4 deitado, para as tabelas largas, com margem de 12 mm.
 * - Rodapé próprio com as margin boxes do CSS Paged Media (Chrome 131 ou mais novo): o título curto
 *   do relatório à esquerda e "Página X de Y" à direita. Quando a página define margin boxes, o
 *   Chrome usa esse rodapé no lugar do cabeçalho e do rodapé padrão (data, título da aba e a URL
 *   longa). Nos navegadores sem suporte, as regras são ignoradas: o efeito é só não aparecer a
 *   numeração própria.
 * - As cores (selos, barras, linhas do gráfico) saem como na tela.
 */
export function estiloImpressao(tituloRodape: string): string {
  // Cinza do texto secundário do tema claro (--color-muted); o papel é sempre branco.
  const rodape = "font-size: 8.5px; color: #5b6b75; font-family: system-ui, sans-serif;";
  return `@page {
  size: A4 landscape;
  margin: 12mm;
  @bottom-left { content: ${textoCss(tituloRodape)}; ${rodape} }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); ${rodape} }
}
@media print { * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } body { background: #fff; } }`;
}
