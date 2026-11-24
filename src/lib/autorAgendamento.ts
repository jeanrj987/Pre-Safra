// Quem agendou o cliente: o último autor do agendamento (campos agendadoPor e agendadoEm do
// Pré-Safra). Aqui ficam só as regras puras (abreviar o nome, decidir se aparece e com que texto),
// usadas pela lista, pelo detalhe e pelo tooltip do calendário.
//
// agendadoPor guarda o nome da CONTA de quem agendou e responsavel guarda o nome de um atendente:
// podem divergir, então nunca se compara um com o outro; o autor aparece sempre que houver agendamento.
//
// agendadoContato é outra coisa: o nome da pessoa DO CLIENTE com quem se falou ao agendar. É opcional,
// texto livre, e segue as mesmas regras de visibilidade do autor.

import { FUSO_NEGOCIO } from "./fuso";
import type { StatusPreSafra } from "./status";

/** Texto para agendamento sem autor: criado em /novo, importado ou anterior ao registro do autor. */
export const TEXTO_SEM_AUTOR = "Autor não registrado";

/** Só existe agendamento em vigor quando o formato (Online ou Presencial) está definido. */
export function temFormatoDefinido(formato: string | null | undefined): boolean {
  return formato === "Online" || formato === "Presencial";
}

/** Nome do autor sem espaços sobrando; nulo quando não há nome. */
export function nomeDoAutor(agendadoPor: string | null | undefined): string | null {
  const nome = (agendadoPor ?? "").trim().replace(/\s+/g, " ");
  return nome === "" ? null : nome;
}

/** Tamanho máximo do nome do contato gravado no agendamento. */
export const MAX_CONTATO = 80;

/**
 * Nome do contato (a pessoa DO CLIENTE com quem se falou ao agendar) sem espaços sobrando; nulo
 * quando não há nome. É texto livre e opcional, o mesmo tratamento do nome do autor.
 */
export function nomeDoContato(agendadoContato: string | null | undefined): string | null {
  return nomeDoAutor(agendadoContato);
}

/**
 * Contato como vai para o banco: espaços normalizados e no máximo MAX_CONTATO caracteres (cortado
 * sem partir letras acentuadas nem emojis); vazio vira null.
 */
export function contatoParaGravar(valor: string | null | undefined): string | null {
  const nome = nomeDoContato(valor);
  if (!nome) return null;
  const letras = Array.from(nome);
  return letras.length <= MAX_CONTATO ? nome : letras.slice(0, MAX_CONTATO).join("").trimEnd();
}

/**
 * "Maria de Souza" vira "Maria S." (primeiro nome e inicial do último sobrenome). Nome de uma
 * palavra só fica como está, e espaços extras são ignorados.
 */
export function abreviarNome(nome: string | null | undefined): string {
  const palavras = (nome ?? "").split(/\s+/).filter(Boolean);
  if (palavras.length <= 1) return palavras[0] ?? "";
  const inicial = Array.from(palavras[palavras.length - 1])[0].toLocaleUpperCase("pt-BR");
  return `${palavras[0]} ${inicial}.`;
}

const FORMATADOR_CARIMBO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_NEGOCIO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "10/11/2026 às 14:32", no horário de Mato Grosso. */
export function carimboAgendamento(quando: Date): string {
  const p: Record<string, string> = {};
  for (const parte of FORMATADOR_CARIMBO.formatToParts(quando)) p[parte.type] = parte.value;
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
}

export interface AutorNaLista {
  /** Texto visível: "Agendado por Maria S." ou "Autor não registrado". */
  texto: string;
  /** Texto completo, para o tooltip e para leitores de tela. */
  dica: string;
  semAutor: boolean;
  /** "Falou com Ana Paula" (nome completo, o CSS corta se faltar espaço); nulo quando não há contato. */
  contato: string | null;
}

/**
 * Linha de autor da lista de clientes. Só para quem tem formato definido (agendado, ou atrasado com
 * formato) e não está Finalizado nem Inativo; para os demais devolve null (nenhuma linha). O contato
 * (agendadoContato) acompanha o autor e vale nas mesmas condições; é opcional, então pode vir nulo.
 */
export function autorNaLista(dados: {
  status: StatusPreSafra;
  formato: string | null | undefined;
  agendadoPor: string | null | undefined;
  agendadoEm: Date | null | undefined;
  agendadoContato?: string | null | undefined;
}): AutorNaLista | null {
  if (!temFormatoDefinido(dados.formato)) return null;
  if (dados.status === "Finalizado" || dados.status === "Inativo") return null;
  const nomeContato = nomeDoContato(dados.agendadoContato);
  const contato = nomeContato ? `Falou com ${nomeContato}` : null;
  const nome = nomeDoAutor(dados.agendadoPor);
  if (!nome) return { texto: TEXTO_SEM_AUTOR, dica: TEXTO_SEM_AUTOR, semAutor: true, contato };
  const dica = `Agendado por ${nome}${dados.agendadoEm ? ` em ${carimboAgendamento(dados.agendadoEm)}` : ""}`;
  return { texto: `Agendado por ${abreviarNome(nome)}`, dica, semAutor: false, contato };
}

export interface AutorNoDetalhe {
  /** Nome completo, ou "Autor não registrado". */
  nome: string;
  semAutor: boolean;
  /** "10/11/2026 às 14:32"; nulo quando o carimbo não foi gravado. */
  quando: string | null;
  /** Nome da pessoa do cliente com quem se falou ao agendar; nulo quando não foi informado. */
  contato: string | null;
}

/**
 * Autor no detalhe do registro: nome completo e carimbo. Só com formato vigente: reabrir o cliente
 * zera o formato mas não o autor antigo, que não deve aparecer num cliente "A Fazer".
 */
export function autorNoDetalhe(dados: {
  formato: string | null | undefined;
  agendadoPor: string | null | undefined;
  agendadoEm: Date | null | undefined;
  agendadoContato?: string | null | undefined;
}): AutorNoDetalhe | null {
  if (!temFormatoDefinido(dados.formato)) return null;
  const nome = nomeDoAutor(dados.agendadoPor);
  return {
    nome: nome ?? TEXTO_SEM_AUTOR,
    semAutor: nome === null,
    quando: dados.agendadoEm ? carimboAgendamento(dados.agendadoEm) : null,
    contato: nomeDoContato(dados.agendadoContato),
  };
}

/** Trecho do tooltip do chip do calendário: "Agendado por: Maria Souza". Nulo sem formato definido. */
export function dicaAutorNoCalendario(dados: {
  formato: string | null | undefined;
  agendadoPor: string | null | undefined;
}): string | null {
  if (!temFormatoDefinido(dados.formato)) return null;
  return `Agendado por: ${nomeDoAutor(dados.agendadoPor) ?? TEXTO_SEM_AUTOR}`;
}

/** Trecho do tooltip do chip do calendário: "Falou com: Ana Paula". Nulo sem formato ou sem contato. */
export function dicaContatoNoCalendario(dados: {
  formato: string | null | undefined;
  agendadoContato: string | null | undefined;
}): string | null {
  if (!temFormatoDefinido(dados.formato)) return null;
  const nome = nomeDoContato(dados.agendadoContato);
  return nome ? `Falou com: ${nome}` : null;
}
