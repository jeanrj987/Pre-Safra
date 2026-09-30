import { normalizar } from "@/lib/texto";

// Comparação léxica entre a sugestão da pessoa e as perguntas do FAQ. Roda na hora, sem API
// externa e sem custo. Não entende sinônimos ("boleto" x "cobrança"): por isso o formulário nunca
// bloqueia de vez — quem discordar do aviso pode enviar mesmo assim (ver acoes.ts).

export interface PerguntaComparavel {
  pergunta: string;
}

// Palavras que não distinguem um assunto do outro.
const IRRELEVANTES = new Set(
  (
    "a o as os um uma uns umas de do da dos das em no na nos nas por para pra com sem sobre " +
    "e ou mas que se como qual quais quando onde porque ja ao aos ha ter tem tinha ser sao " +
    "foi era esta estao fazer faz pode podem poder posso queria quero gostaria gostariamos " +
    "seria ficar deveria deve ideia sugestao sugiro duvida pergunta faq mais muito muita " +
    "meu minha meus minhas seu sua nosso nossa isso isto esse essa este esta ele ela eles " +
    "elas voce vcs vc tambem ainda so sim nao ver saber entender"
  ).split(" "),
);

// Famílias de palavras que o radical de 5 letras separa (verbo x substantivo). Saiu do vocabulário
// dos títulos do FAQ: "imprimir" x "impressão", "lançou" x "lançamento" etc. Não dá para resolver
// encurtando o radical para 4 letras, porque isso junta palavras diferentes (estoque x estorno,
// importação x imposto, desconto x descarregar). Chave: radical de 5 letras; valor: o radical canônico.
const EQUIVALENTES: Record<string, string> = {
  impri: "impre", // imprimir -> impressão, impressora
  gerad: "gerar", // gerada, gerado -> gerar
  gera: "gerar", // gera -> gerar
  gerac: "gerar", // geração -> gerar
  lanco: "lanca", // lançou -> lançamento, lançar
  pagar: "pagam", // pagar -> pagamento
  emiti: "emiss", // emitir -> emissão
};

// Radical barato: tira o plural e fica com os 5 primeiros caracteres, o que junta
// "cadastrar/cadastro/cadastrando" e "nota/notas" sem precisar de um stemmer completo.
function radical(palavra: string): string {
  const singular = palavra.length > 3 && palavra.endsWith("s") ? palavra.slice(0, -1) : palavra;
  const base = singular.slice(0, 5);
  return EQUIVALENTES[base] ?? base;
}

export function radicais(texto: string): Set<string> {
  const resultado = new Set<string>();
  for (const palavra of normalizar(texto).split(/[^a-z0-9]+/)) {
    if (palavra.length < 2 || IRRELEVANTES.has(palavra)) continue;
    resultado.add(radical(palavra));
  }
  return resultado;
}

/** 0 a 1: quanto os dois textos falam da mesma coisa. */
export function similaridade(a: string, b: string): number {
  const ra = radicais(a);
  const rb = radicais(b);
  if (ra.size === 0 || rb.size === 0) return 0;

  let comuns = 0;
  for (const r of ra) if (rb.has(r)) comuns++;

  const dice = (2 * comuns) / (ra.size + rb.size);
  // Uma sugestão curta que está inteira dentro de uma pergunta longa (ou o contrário) também
  // é a mesma ideia — mas só vale com 2+ palavras em comum, para "nota" sozinha não bater com tudo.
  const contida = comuns >= 2 ? (comuns / Math.min(ra.size, rb.size)) * 0.85 : 0;
  return Math.max(dice, contida);
}

// Ajustado com perguntas de exemplo (ver similaridade.test.ts); revise quando o FAQ real entrar.
export const LIMIAR_FAQ = 0.6;

export interface Parecida<T extends PerguntaComparavel> {
  item: T;
  similaridade: number;
}

/** A pergunta do FAQ mais parecida com a sugestão, ou null se nenhuma passar do limiar. */
export function acharPerguntaParecida<T extends PerguntaComparavel>(
  sugestao: string,
  faq: readonly T[],
  limiar = LIMIAR_FAQ,
): Parecida<T> | null {
  let melhor: Parecida<T> | null = null;
  for (const item of faq) {
    const s = similaridade(sugestao, item.pergunta);
    if (s >= limiar && (!melhor || s > melhor.similaridade)) melhor = { item, similaridade: s };
  }
  return melhor;
}
