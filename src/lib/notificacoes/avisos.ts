// Avisos ao cliente que passam pelo banco: carrega os dados do Pré-Safra, envia pelo
// NotificationService e guarda o resultado no histórico (tabela Notificacao). Só para servidor.
import { prisma } from "../db";
import { calcularStatus } from "../status";
import { eventoSugerido, montarDadosAviso, type EventoAviso } from "./modelos";
import { avisoAutomaticoLigado, criarNotificationService, type Canal } from "./servico";
import type { ResultadoEnvio } from "./provedores";

/** Dados do cliente para montar o aviso, ou null se o Pré-Safra não existe. */
async function carregar(preSafraId: number) {
  const r = await prisma.preSafra.findUnique({
    where: { id: preSafraId },
    select: {
      clienteNomeManual: true,
      dataPrevista: true,
      horario: true,
      formato: true,
      configuradoSistema: true,
      inativo: true,
      motivoPendencia: true,
      cliente: { select: { nome: true, whatsapp: true, email: true } },
    },
  });
  if (!r) return null;
  const status = calcularStatus({
    configuradoSistema: r.configuradoSistema,
    dataPrevista: r.dataPrevista,
    inativo: r.inativo,
    formato: r.formato,
  });
  return {
    status,
    dados: montarDadosAviso({
      nome: r.cliente?.nome ?? r.clienteNomeManual ?? "cliente",
      whatsapp: r.cliente?.whatsapp ?? null,
      email: r.cliente?.email ?? null,
      status,
      // Só quem está pendente tem motivo; o campo guarda lixo de outras fases (ver lib/pendencia.ts).
      motivoPendencia: status === "A Fazer" || status === "Atrasado" ? r.motivoPendencia : null,
      dataPrevista: r.dataPrevista,
      horario: r.horario,
      formato: r.formato,
    }),
  };
}

/**
 * Envia o aviso por um canal e registra o resultado. Cliente finalizado ou inativado não recebe aviso.
 * `evento` omitido = o que faz sentido para o status atual.
 */
export async function enviarAviso({
  preSafraId,
  canal,
  autor,
  evento,
}: {
  preSafraId: number;
  canal: Canal;
  autor: string;
  evento?: EventoAviso;
}): Promise<ResultadoEnvio> {
  const alvo = await carregar(preSafraId);
  if (!alvo) return { ok: false, erro: "Cliente não encontrado." };
  if (alvo.status === "Finalizado" || alvo.status === "Inativo") {
    return { ok: false, erro: "Cliente finalizado ou inativo não recebe aviso." };
  }

  const servico = criarNotificationService();
  const usado = evento ?? eventoSugerido(alvo.status);
  const resultado = await servico.enviar(canal, alvo.dados, usado);
  const destino = (canal === "email" ? alvo.dados.email : alvo.dados.telefone) ?? "—";
  try {
    await prisma.notificacao.create({
      data: { preSafraId, canal, evento: usado, destino, ok: resultado.ok, erro: resultado.erro ?? null, autor },
    });
  } catch (e) {
    // O aviso já saiu: falhar em registrar o histórico não pode desfazer nem esconder isso.
    console.error("Falha ao registrar a notificação", e);
  }
  return resultado;
}

/**
 * Avisa o cliente de que a data do agendamento mudou, por todos os canais configurados em que ele
 * tem contato. Só age com NOTIFICACAO_AUTOMATICA=1 e nunca lança: um problema no envio não pode
 * desfazer nem atrapalhar o salvamento da data.
 */
export async function avisarMudancaDeData(preSafraId: number, autor: string): Promise<void> {
  if (!avisoAutomaticoLigado()) return;
  try {
    const alvo = await carregar(preSafraId);
    if (!alvo) return;
    const servico = criarNotificationService();
    const canais: Canal[] = [];
    if (servico.disponivel("whatsapp") && alvo.dados.telefone) canais.push("whatsapp");
    if (servico.disponivel("email") && alvo.dados.email) canais.push("email");
    for (const canal of canais) await enviarAviso({ preSafraId, canal, autor, evento: "data-alterada" });
  } catch (e) {
    console.error("Falha ao avisar a mudança de data", e);
  }
}
