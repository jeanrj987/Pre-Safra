import { afterEach, describe, expect, it, vi } from "vitest";
import type { DadosAviso, PayloadWebhook } from "./modelos";
import { EmailResend, WebhookWhatsapp, type ProvedorEmail, type ProvedorWhatsapp } from "./provedores";
import { avisoAutomaticoLigado, criarNotificationService, NotificationService } from "./servico";

const dados = (p: Partial<DadosAviso> = {}): DadosAviso => ({
  nome: "Fazenda Boa Vista",
  telefone: "5566999998888",
  email: "contato@boavista.com.br",
  status: "A Fazer",
  motivo: "Não respondeu",
  dataFinalizacao: "2026-10-28",
  horario: null,
  formato: null,
  ...p,
});

const payload = (p: Partial<PayloadWebhook> = {}): PayloadWebhook => ({
  nome: "A",
  telefone: "5566999998888",
  status: "A Fazer",
  motivo: null,
  data_finalizacao: null,
  evento: "pendente",
  mensagem: "oi",
  ...p,
});

afterEach(() => vi.restoreAllMocks());

describe("NotificationService", () => {
  it("gera o link wa.me com a mensagem preenchida", () => {
    const link = new NotificationService({}).linkWhatsapp(dados());
    expect(link).toMatch(/^https:\/\/wa\.me\/5566999998888\?text=/);
    expect(decodeURIComponent(link!.split("?text=")[1])).toContain("Olá, Fazenda Boa Vista!");
  });
  it("sem WhatsApp cadastrado não há link", () => {
    expect(new NotificationService({}).linkWhatsapp(dados({ telefone: null }))).toBeNull();
  });

  it("envia o WhatsApp pelo provedor com o payload combinado", async () => {
    const enviar = vi.fn<ProvedorWhatsapp["enviar"]>().mockResolvedValue({ ok: true });
    const r = await new NotificationService({ whatsapp: { enviar } }).enviarWhatsapp(dados());
    expect(r.ok).toBe(true);
    expect(enviar.mock.calls[0][0]).toMatchObject({
      nome: "Fazenda Boa Vista",
      telefone: "5566999998888",
      status: "A Fazer",
      motivo: "Não respondeu",
      data_finalizacao: "2026-10-28",
    });
  });
  it("não envia sem provedor ou sem telefone", async () => {
    expect((await new NotificationService({}).enviarWhatsapp(dados())).ok).toBe(false);
    const enviar = vi.fn();
    const r = await new NotificationService({ whatsapp: { enviar } }).enviarWhatsapp(dados({ telefone: null }));
    expect(r.ok).toBe(false);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("envia o e-mail com assunto e texto, e recusa e-mail inválido", async () => {
    const enviar = vi.fn<ProvedorEmail["enviar"]>().mockResolvedValue({ ok: true });
    const servico = new NotificationService({ email: { enviar } });
    expect((await servico.enviarEmail(dados())).ok).toBe(true);
    expect(enviar.mock.calls[0][0].para).toBe("contato@boavista.com.br");
    expect(enviar.mock.calls[0][0].mensagem.texto).toContain("Fazenda Boa Vista");
    expect((await servico.enviarEmail(dados({ email: "quebrado" }))).ok).toBe(false);
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});

describe("provedores HTTP", () => {
  it("o webhook faz POST em JSON com o token", async () => {
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const r = await new WebhookWhatsapp("https://n8n.exemplo/webhook/x", "segredo").enviar(payload());
    expect(r.ok).toBe(true);
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://n8n.exemplo/webhook/x");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer segredo");
    expect(JSON.parse(String(init?.body))).toMatchObject({ nome: "A", telefone: "5566999998888" });
  });
  it("resposta de erro e falha de rede viram resultado, sem lançar nem vazar a resposta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("chave-secreta", { status: 401 }));
    const erroHttp = await new WebhookWhatsapp("https://x.exemplo").enviar(payload());
    expect(erroHttp).toEqual({ ok: false, erro: "O provedor respondeu HTTP 401." });
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const rede = await new WebhookWhatsapp("https://x.exemplo").enviar(payload());
    expect(rede.ok).toBe(false);
    expect(rede.erro).not.toMatch(/ECONNREFUSED/);
  });
  it("o Resend manda remetente, destinatário, assunto, texto e html", async () => {
    const fetchFalso = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await new EmailResend("re_chave", "Pré-Safra <avisos@exemplo.com>").enviar({
      para: "a@b.com",
      mensagem: { assunto: "Assunto", texto: "Olá <b>" },
    });
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer re_chave");
    const corpo = JSON.parse(String(init?.body));
    expect(corpo).toMatchObject({
      from: "Pré-Safra <avisos@exemplo.com>",
      to: ["a@b.com"],
      subject: "Assunto",
      text: "Olá <b>",
    });
    expect(corpo.html).toContain("&lt;b&gt;");
  });
});

describe("criarNotificationService", () => {
  it("só habilita o canal que tem configuração válida", () => {
    expect(criarNotificationService({}).disponivel("whatsapp")).toBe(false);
    expect(criarNotificationService({}).disponivel("email")).toBe(false);
    const s = criarNotificationService({
      NOTIFICACAO_WEBHOOK_URL: "https://n8n.exemplo/x",
      RESEND_API_KEY: "k",
      EMAIL_REMETENTE: "a@b.com",
    });
    expect(s.disponivel("whatsapp")).toBe(true);
    expect(s.disponivel("email")).toBe(true);
    expect(criarNotificationService({ NOTIFICACAO_WEBHOOK_URL: "ftp://x" }).disponivel("whatsapp")).toBe(false);
    expect(criarNotificationService({ RESEND_API_KEY: "k" }).disponivel("email")).toBe(false);
  });
  it("o aviso automático só liga com NOTIFICACAO_AUTOMATICA=1", () => {
    expect(avisoAutomaticoLigado({})).toBe(false);
    expect(avisoAutomaticoLigado({ NOTIFICACAO_AUTOMATICA: "true" })).toBe(false);
    expect(avisoAutomaticoLigado({ NOTIFICACAO_AUTOMATICA: "1" })).toBe(true);
  });
});
