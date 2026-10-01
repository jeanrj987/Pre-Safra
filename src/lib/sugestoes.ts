import { normalizar } from "@/lib/texto";

// Regras e formatos compartilhados entre o formulário (cliente), a Server Action e o telão.
// Sem imports de servidor aqui, porque este arquivo também entra no bundle do navegador.

export const LIMITES = {
  nome: { min: 2, max: 60 },
  topico: { min: 2, max: 40 },
} as const;

/**
 * Grades do telão, da mais folgada para a mais apertada. Começa em 4 colunas x 5 linhas e, quando
 * todas as vagas enchem, passa para a próxima: mais vagas com cartões menores.
 */
export const GRADES_TELAO = [
  { colunas: 4, linhas: 5 },
  { colunas: 5, linhas: 6 },
  { colunas: 6, linhas: 8 },
  { colunas: 8, linhas: 10 },
] as const;

const vagasDaGrade = (g: (typeof GRADES_TELAO)[number]) => g.colunas * g.linhas;

/** Quantas sugestões cabem na tela do telão ao mesmo tempo, na grade mais apertada. */
export const VAGAS_NO_TELAO = vagasDaGrade(GRADES_TELAO[GRADES_TELAO.length - 1]);

/** Menor grade com pelo menos `vagas` lugares (a última, se nenhuma comportar). */
export function nivelDaGrade(vagas: number): number {
  const i = GRADES_TELAO.findIndex((g) => vagasDaGrade(g) >= vagas);
  return i === -1 ? GRADES_TELAO.length - 1 : i;
}

export const vagasDoNivel = (nivel: number) => vagasDaGrade(GRADES_TELAO[nivel]);

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
