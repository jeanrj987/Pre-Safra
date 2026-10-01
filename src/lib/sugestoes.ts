import { normalizar } from "@/lib/texto";

// Regras e formatos compartilhados entre o formulário (cliente), a Server Action e o telão.
// Sem imports de servidor aqui, porque este arquivo também entra no bundle do navegador.

export const LIMITES = {
  nome: { min: 2, max: 60 },
  topico: { min: 2, max: 40 },
} as const;

/** Grade de cada página do telão: 5 colunas x 6 linhas, o que ainda se lê bem no projetor. */
export const GRADE_TELAO = { colunas: 5, linhas: 6 } as const;

/** Quantas sugestões cabem em uma página do telão. */
export const VAGAS_NO_TELAO = GRADE_TELAO.colunas * GRADE_TELAO.linhas;

/** Quantas sugestões o telão carrega, no máximo, para girar entre as páginas. */
export const TETO_NO_TELAO = 200;

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

/** O que o telão (tela pública do evento) recebe: nunca inclui sobrenome nem WhatsApp. */
export interface SugestaoTelao {
  id: number;
  nome: string;
  topico: string;
  texto: string;
  matiz: number;
}

export function paraTelao(s: {
  id: number;
  nome: string;
  topico: string;
  topicoNorm: string;
  texto: string;
}): SugestaoTelao {
  return {
    id: s.id,
    nome: primeiroNome(s.nome),
    topico: s.topico,
    texto: s.texto,
    matiz: matizDoTopico(s.topicoNorm),
  };
}
