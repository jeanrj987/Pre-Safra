// Mensagens enviadas ao cliente: os templates, as variáveis e o payload do webhook. Tudo puro (sem
// rede nem banco), então a tela, o link do WhatsApp, o e-mail e o webhook usam o mesmo texto.
// Para mudar o texto, basta editar TEMPLATES.
import type { StatusPreSafra } from "../status";
import { rotuloMotivoPendencia } from "../pendencia";
import { STATUS_AGENDADOS } from "../status";

/** O que motiva o aviso: a data do agendamento mudou, ou o cliente continua pendente. */
export type EventoAviso = "data-alterada" | "pendente";

export const ROTULO_EVENTO: Record<EventoAviso, string> = {
  "data-alterada": "Data do agendamento",
  pendente: "Lembrete de pendência",
};

export interface DadosAviso {
  nome: string;
  /** Só dígitos, com DDI ("5566999998888"); null se o cliente não tem WhatsApp cadastrado. */
  telefone: string | null;
  email: string | null;
  status: StatusPreSafra;
  /** Rótulo do motivo de pendência ("Não respondeu"), se houver. */
  motivo: string | null;
  /** Data prevista, "aaaa-mm-dd". */
  dataFinalizacao: string | null;
  horario: string | null;
  formato: string | null;
}

/** Texto de um aviso pronto para sair: o assunto só existe no e-mail. */
export interface Mensagem {
  assunto: string;
  texto: string;
}

// Variáveis: {{nome}}, {{status}}, {{motivo}}, {{data}}, {{horario}}, {{formato}} e duas frases
// já montadas, que somem quando não há dado: {{quando}} e {{previsto}} / {{situacao}}.
const TEMPLATES: Record<EventoAviso, Mensagem> = {
  "data-alterada": {
    assunto: "Atualização do seu agendamento do Pré-Safra",
    texto:
      "Olá, {{nome}}! O seu Pré-Safra está agendado{{quando}}. Se precisar remarcar, é só responder esta mensagem. Equipe Pré-Safra",
  },
  pendente: {
    assunto: "Vamos agendar o seu Pré-Safra?",
    texto:
      "Olá, {{nome}}! Ainda não conseguimos realizar o seu Pré-Safra{{previsto}}.{{situacao}} Podemos combinar um horário? Equipe Pré-Safra",
  },
};

/** Troca cada {{variavel}} pelo valor; variável desconhecida ou vazia vira texto vazio. */
export function preencher(modelo: string, variaveis: Record<string, string>): string {
  return modelo.replace(/\{\{(\w+)\}\}/g, (_, nome: string) => variaveis[nome] ?? "").replace(/\s+([.,!?])/g, "$1");
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function variaveisDoAviso(d: DadosAviso): Record<string, string> {
  const data = d.dataFinalizacao ? dataBr(d.dataFinalizacao) : "";
  const quando = data
    ? ` para ${data}${d.horario ? ` às ${d.horario}` : ""}${d.formato ? ` (${d.formato})` : ""}`
    : "";
  return {
    nome: d.nome,
    status: d.status,
    motivo: d.motivo ?? "",
    data,
    horario: d.horario ?? "",
    formato: d.formato ?? "",
    quando,
    previsto: data ? `, previsto para ${data}` : "",
    situacao: d.motivo ? ` Situação: ${d.motivo}.` : "",
  };
}

export function montarMensagem(evento: EventoAviso, dados: DadosAviso): Mensagem {
  const variaveis = variaveisDoAviso(dados);
  const modelo = TEMPLATES[evento];
  return { assunto: preencher(modelo.assunto, variaveis), texto: preencher(modelo.texto, variaveis) };
}

/** O aviso que faz sentido para o status: agendado → data; os demais → lembrete de pendência. */
export function eventoSugerido(status: StatusPreSafra): EventoAviso {
  return STATUS_AGENDADOS.includes(status) ? "data-alterada" : "pendente";
}

/** Monta os dados do aviso a partir do que a lista e o registro já têm. */
export function montarDadosAviso(origem: {
  nome: string;
  whatsapp: string | null;
  email: string | null;
  status: StatusPreSafra;
  motivoPendencia: string | null;
  dataPrevista: Date | null;
  horario: string | null;
  formato: string | null;
}): DadosAviso {
  return {
    nome: origem.nome,
    telefone: origem.whatsapp,
    email: origem.email,
    status: origem.status,
    motivo: origem.motivoPendencia ? rotuloMotivoPendencia(origem.motivoPendencia) : null,
    dataFinalizacao: origem.dataPrevista ? origem.dataPrevista.toISOString().slice(0, 10) : null,
    horario: origem.horario,
    formato: origem.formato,
  };
}

/**
 * O que o webhook (Evolution API, Z-API, n8n…) recebe. Os cinco primeiros campos são o combinado;
 * `evento` e `mensagem` (o texto já preenchido) poupam o outro lado de montar a mensagem.
 */
export interface PayloadWebhook {
  nome: string;
  telefone: string;
  status: StatusPreSafra;
  motivo: string | null;
  data_finalizacao: string | null;
  evento: EventoAviso;
  mensagem: string;
}

export function montarPayloadWebhook(evento: EventoAviso, dados: DadosAviso & { telefone: string }): PayloadWebhook {
  return {
    nome: dados.nome,
    telefone: dados.telefone,
    status: dados.status,
    motivo: dados.motivo,
    data_finalizacao: dados.dataFinalizacao,
    evento,
    mensagem: montarMensagem(evento, dados).texto,
  };
}

const escaparHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Corpo do e-mail em HTML simples; o nome do cliente é texto digitado, então vai escapado. */
export function htmlDaMensagem(texto: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1f2933">${escaparHtml(texto).replace(/\n/g, "<br>")}</div>`;
}
