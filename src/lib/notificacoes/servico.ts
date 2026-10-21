// NotificationService: ponto único para avisar o cliente. Recebe os provedores prontos (injeção),
// então os testes usam provedores falsos e, no futuro, trocar o provedor não muda as telas.
import { linkWhatsappComTexto } from "../whatsapp";
import { normalizarEmail } from "../email";
import {
  eventoSugerido,
  montarMensagem,
  montarPayloadWebhook,
  type DadosAviso,
  type EventoAviso,
} from "./modelos";
import { EmailResend, WebhookWhatsapp, type ProvedorEmail, type ProvedorWhatsapp, type ResultadoEnvio } from "./provedores";

export type Canal = "whatsapp" | "email";

export const ROTULO_CANAL: Record<Canal, string> = { whatsapp: "WhatsApp (API)", email: "E-mail" };

export class NotificationService {
  constructor(private readonly provedores: { whatsapp?: ProvedorWhatsapp; email?: ProvedorEmail }) {}

  /** O canal tem provedor configurado? (O link wa.me não depende disso.) */
  disponivel(canal: Canal): boolean {
    return !!this.provedores[canal];
  }

  /** Link wa.me com a mensagem pronta, para uso imediato; null se o cliente não tem WhatsApp. */
  linkWhatsapp(dados: DadosAviso, evento: EventoAviso = eventoSugerido(dados.status)): string | null {
    return dados.telefone ? linkWhatsappComTexto(dados.telefone, montarMensagem(evento, dados).texto) : null;
  }

  /** Dispara o WhatsApp pelo provedor (webhook). Nunca lança: a falha volta no resultado. */
  async enviarWhatsapp(dados: DadosAviso, evento: EventoAviso = eventoSugerido(dados.status)): Promise<ResultadoEnvio> {
    const provedor = this.provedores.whatsapp;
    if (!provedor) return { ok: false, erro: "O envio de WhatsApp pela API não está configurado." };
    if (!dados.telefone) return { ok: false, erro: "O cliente não tem WhatsApp cadastrado." };
    return provedor.enviar(montarPayloadWebhook(evento, { ...dados, telefone: dados.telefone }));
  }

  /** Envia o e-mail transacional. Nunca lança: a falha volta no resultado. */
  async enviarEmail(dados: DadosAviso, evento: EventoAviso = eventoSugerido(dados.status)): Promise<ResultadoEnvio> {
    const provedor = this.provedores.email;
    if (!provedor) return { ok: false, erro: "O envio de e-mail não está configurado." };
    const para = dados.email ? normalizarEmail(dados.email) : null;
    if (!para) return { ok: false, erro: "O cliente não tem e-mail válido cadastrado." };
    return provedor.enviar({ para, mensagem: montarMensagem(evento, dados) });
  }

  enviar(canal: Canal, dados: DadosAviso, evento?: EventoAviso): Promise<ResultadoEnvio> {
    return canal === "email" ? this.enviarEmail(dados, evento) : this.enviarWhatsapp(dados, evento);
  }
}

const urlHttp = (valor: string | undefined) => {
  try {
    const url = new URL(valor ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/**
 * Monta o serviço com o que está nas variáveis de ambiente (ver .env.example). Canal sem
 * configuração fica indisponível, e as telas escondem o botão de envio dele.
 */
export function criarNotificationService(env: Record<string, string | undefined> = process.env): NotificationService {
  const webhook = urlHttp(env.NOTIFICACAO_WEBHOOK_URL);
  return new NotificationService({
    whatsapp: webhook ? new WebhookWhatsapp(webhook, env.NOTIFICACAO_WEBHOOK_TOKEN || undefined) : undefined,
    email:
      env.RESEND_API_KEY && env.EMAIL_REMETENTE ? new EmailResend(env.RESEND_API_KEY, env.EMAIL_REMETENTE) : undefined,
  });
}

/** O aviso automático ao mudar a data está ligado? Desligado por padrão (só o envio manual funciona). */
export const avisoAutomaticoLigado = (env: Record<string, string | undefined> = process.env) =>
  env.NOTIFICACAO_AUTOMATICA === "1";
