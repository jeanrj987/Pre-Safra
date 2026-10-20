import { normalizar } from "@/lib/texto";

// Regras e formatos compartilhados entre o formulário (cliente), a Server Action e o telão.
// Sem imports de servidor aqui, porque este arquivo também entra no bundle do navegador.

/** O que a pessoa está sugerindo: um tema para o FAQ ou uma melhoria para o P&D. */
export const TIPOS_SUGESTAO = ["faq", "melhoria"] as const;
export type TipoSugestao = (typeof TIPOS_SUGESTAO)[number];

export const ehTipoSugestao = (v: unknown): v is TipoSugestao =>
  TIPOS_SUGESTAO.includes(v as TipoSugestao);

export const ROTULO_TIPO: Record<TipoSugestao, string> = {
  faq: "FAQ",
  melhoria: "Melhoria (P&D)",
};

/** Rótulo do tipo vindo do banco, onde ele é um texto qualquer (cai em FAQ, o tipo de antes). */
export const rotuloDoTipo = (tipo: string) =>
  ROTULO_TIPO[ehTipoSugestao(tipo) ? tipo : "faq"];

export const LIMITES = {
  nome: { min: 2, max: 60 },
  topico: { min: 2, max: 40 },
  texto: { max: 2000 },
} as const;

/** Envios aceitos por WhatsApp na última hora e, somando todo mundo, no último minuto (abuso do formulário público). */
export const LIMITE_ENVIOS = {
  porWhatsappPorHora: 20,
  totalPorMinuto: 60,
  // Arquivos enviados (cada um pesa no banco): por WhatsApp na última hora e, somando todos, no último minuto
  anexosPorWhatsappPorHora: 15,
  anexosTotalPorMinuto: 30,
} as const;

/**
 * Grade de cada página de uma coluna do telão (FAQ à esquerda, melhorias à direita, cada uma com a
 * sua grade e as suas páginas): 3 colunas x 5 linhas, o que ainda se lê bem no projetor.
 */
export const GRADE_TELAO = { colunas: 3, linhas: 5 } as const;

/** Quantas sugestões cabem em uma página de uma coluna do telão. */
export const VAGAS_NO_TELAO = GRADE_TELAO.colunas * GRADE_TELAO.linhas;

/** Quantas sugestões de cada tipo o telão carrega, no máximo, para girar entre as páginas. */
export const TETO_NO_TELAO = 200;

/** Quanto tempo cada página do telão fica na tela, em segundos (o admin ajusta dentro dos limites). */
export const SEGUNDOS_PAGINA_TELAO = { padrao: 12, min: 3, max: 120 } as const;

/** Limites da meta de sugestões de FAQ exibida no telão (o admin a define; vazio = sem meta). */
export const META_FAQ = { min: 1, max: 100000 } as const;

/** Tira caracteres de controle e espaços repetidos. */
export const limparTexto = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Nota Fiscal " e "nota  fiscal" viram a mesma chave (agrupa e define a cor no telão). */
export const normalizarTopico = (topico: string) => normalizar(limparTexto(topico));

/** Primeiro nome, com a inicial maiúscula: "  maria da silva" -> "Maria". */
export function primeiroNome(nome: string): string {
  const primeiro = limparTexto(nome).split(" ")[0] ?? "";
  return primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR");
}

/** Matiz (0-359) estável para o tópico: o mesmo assunto sempre tem a mesma cor. */
export function matizDoTopico(topicoNorm: string): number {
  let h = 2166136261;
  for (let i = 0; i < topicoNorm.length; i++) {
    h ^= topicoNorm.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

const ANGULO_AUREO = 137.508;

/**
 * Matizes bem espalhados para os tópicos que aparecem juntos no telão. O ângulo áureo afasta cada
 * tópico novo dos anteriores (o hash puro deixava tópicos diferentes em tons quase iguais), e a
 * ordem recebida é a de aparição, então os tópicos antigos mantêm a cor quando surgem novos.
 * Cartões do mesmo tópico variam uns graus (pelo id) para a tela não virar um bloco de uma cor só.
 */
export function matizesDoTelao(
  itens: { id: number; topicoNorm: string }[],
): Map<number, number> {
  const base = new Map<string, number>();
  const cronologico = [...itens].sort((a, b) => a.id - b.id);
  for (const { topicoNorm } of cronologico) {
    if (!base.has(topicoNorm)) base.set(topicoNorm, (base.size * ANGULO_AUREO) % 360);
  }
  const matizes = new Map<number, number>();
  for (const { id, topicoNorm } of itens) {
    const variacao = ((id * 7) % 5 - 2) * 8; // -16, -8, 0, 8 ou 16 graus
    matizes.set(id, Math.round(((base.get(topicoNorm) ?? 0) + variacao + 360) % 360));
  }
  return matizes;
}

export interface PosicaoRanking {
  whatsapp: string;
  /** O nome do envio mais recente: a mesma pessoa pode digitar o nome de jeitos diferentes. */
  nome: string;
  quantas: number;
}

/**
 * Quem mais enviou sugestões do tipo pedido. A pessoa é identificada pelo WhatsApp. Empata quem
 * chegou primeiro (menor id) na frente; ocultas contam, pois a pessoa enviou do mesmo jeito.
 */
export function rankingPorPessoa(
  itens: { id: number; tipo: string; nome: string; whatsapp: string }[],
  tipo: TipoSugestao,
  limite = 10,
): PosicaoRanking[] {
  const porPessoa = new Map<string, PosicaoRanking & { primeiroId: number; ultimoId: number }>();
  for (const { id, tipo: t, nome, whatsapp } of itens) {
    if ((ehTipoSugestao(t) ? t : "faq") !== tipo) continue;
    const atual = porPessoa.get(whatsapp);
    if (!atual) {
      porPessoa.set(whatsapp, { whatsapp, nome, quantas: 1, primeiroId: id, ultimoId: id });
      continue;
    }
    atual.quantas++;
    atual.primeiroId = Math.min(atual.primeiroId, id);
    if (id > atual.ultimoId) {
      atual.ultimoId = id;
      atual.nome = nome;
    }
  }
  return [...porPessoa.values()]
    .sort((a, b) => b.quantas - a.quantas || a.primeiroId - b.primeiroId)
    .slice(0, limite)
    .map(({ whatsapp, nome, quantas }) => ({ whatsapp, nome, quantas }));
}

/** O que o telão (tela pública do evento) recebe: nunca inclui sobrenome nem WhatsApp. */
export interface SugestaoTelao {
  id: number;
  tipo: TipoSugestao;
  nome: string;
  topico: string;
  texto: string;
  matiz: number;
}

export function paraTelao(s: {
  id: number;
  tipo: TipoSugestao;
  nome: string;
  topico: string;
  topicoNorm: string;
  texto: string;
}, matiz: number = matizDoTopico(s.topicoNorm)): SugestaoTelao {
  return {
    id: s.id,
    tipo: s.tipo,
    nome: primeiroNome(s.nome),
    topico: s.topico,
    texto: s.texto,
    matiz,
  };
}
