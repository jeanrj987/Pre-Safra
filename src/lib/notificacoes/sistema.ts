// E-mails do próprio sistema (ex.: aviso de senha alterada), sem passar por Notificacao, que exige um
// Pré-Safra. Usa as mesmas variáveis de ambiente do aviso ao cliente (RESEND_API_KEY e EMAIL_REMETENTE).
import type { Mensagem } from "./modelos";
import { EmailResend } from "./provedores";

type Env = Record<string, string | undefined>;

/** Chave e remetente do Resend, ou null se qualquer um faltar. É a ÚNICA definição de "e-mail configurado". */
function credenciais(env: Env): { chave: string; remetente: string } | null {
  const chave = env.RESEND_API_KEY;
  const remetente = env.EMAIL_REMETENTE;
  return chave && remetente ? { chave, remetente } : null;
}

/** Diz se o e-mail do sistema está configurado (RESEND_API_KEY e EMAIL_REMETENTE presentes). */
export function emailSistemaConfigurado(env: Env = process.env): boolean {
  return credenciais(env) !== null;
}

/**
 * Envia um e-mail do sistema. Nunca lança: devolve false se o envio não está configurado ou falhou.
 * Só registra no log um motivo curto — jamais o texto da mensagem, que pode conter um link com token.
 */
export async function enviarEmailSistema(
  para: string,
  mensagem: Mensagem,
  env: Env = process.env,
): Promise<boolean> {
  const cred = credenciais(env);
  if (!cred) {
    console.error("E-mail do sistema não enviado: RESEND_API_KEY ou EMAIL_REMETENTE não configurado.");
    return false;
  }
  try {
    const resultado = await new EmailResend(cred.chave, cred.remetente).enviar({ para, mensagem });
    if (!resultado.ok) console.error(`Falha ao enviar e-mail do sistema: ${resultado.erro ?? "motivo desconhecido"}`);
    return resultado.ok;
  } catch {
    console.error("Falha inesperada ao enviar e-mail do sistema.");
    return false;
  }
}
