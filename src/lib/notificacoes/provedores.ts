// Quem de fato entrega a mensagem. O NotificationService só conhece estas duas interfaces, então
// trocar de provedor (Evolution API → Z-API, Resend → SMTP…) é escrever uma classe nova e
// escolhê-la em criarNotificationService (servico.ts), sem mexer nas telas.
import { htmlDaMensagem, type Mensagem, type PayloadWebhook } from "./modelos";

export interface ResultadoEnvio {
  ok: boolean;
  /** Texto curto do problema, para o histórico; nunca traz chaves nem a resposta inteira do provedor. */
  erro?: string;
}

export interface ProvedorWhatsapp {
  enviar(payload: PayloadWebhook): Promise<ResultadoEnvio>;
}

export interface ProvedorEmail {
  enviar(aviso: { para: string; mensagem: Mensagem }): Promise<ResultadoEnvio>;
}

const TEMPO_LIMITE_MS = 10_000;

async function chamar(url: string, init: RequestInit): Promise<ResultadoEnvio> {
  try {
    const resposta = await fetch(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    return resposta.ok ? { ok: true } : { ok: false, erro: `O provedor respondeu HTTP ${resposta.status}.` };
  } catch (e) {
    const expirou = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, erro: expirou ? "O provedor demorou demais para responder." : "Não foi possível falar com o provedor." };
  }
}

/** Dispara o WhatsApp por um webhook (Evolution API, Z-API, n8n…): um POST com o payload em JSON. */
export class WebhookWhatsapp implements ProvedorWhatsapp {
  constructor(
    private readonly url: string,
    private readonly token?: string,
  ) {}

  enviar(payload: PayloadWebhook) {
    return chamar(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  }
}

/** E-mail transacional pela API do Resend (sem biblioteca: é um POST autenticado). */
export class EmailResend implements ProvedorEmail {
  constructor(
    private readonly chaveApi: string,
    private readonly remetente: string,
  ) {}

  enviar({ para, mensagem }: { para: string; mensagem: Mensagem }) {
    return chamar("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.chaveApi}` },
      body: JSON.stringify({
        from: this.remetente,
        to: [para],
        subject: mensagem.assunto,
        text: mensagem.texto,
        html: htmlDaMensagem(mensagem.texto),
      }),
    });
  }
}
