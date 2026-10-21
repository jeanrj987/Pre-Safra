"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAcessoCompleto } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { avisarMudancaDeData } from "@/lib/notificacoes/avisos";
import { limparObservacaoPendencia, motivoPendenciaValido } from "@/lib/pendencia";
import { diaHoje } from "@/lib/status";
import { finalizarPendentes, formatoValido, reabrirIds, type Formato } from "@/lib/acoesPreSafra";
import { motivoDataIndisponivel } from "@/lib/diasUteis";
import { horarioValido, motivoHorarioPassado } from "@/lib/horarios";
import { pode } from "@/lib/permissoes";
import { idsPermitidos, podeAgendarCliente, podeAlterarCliente } from "@/lib/responsavel";

// Server Actions da lista principal (src/app/page.tsx). Extraídas para cá para poder ser
// importadas/testadas fora do componente de página, que já é grande só com a tabela e os
// filtros.
//
// Todos os usuários veem e agendam qualquer cliente; finalizar e reabrir ficam com o admin e o
// responsável do cliente (ver src/lib/responsavel.ts). O servidor confere isso em cada ação:
// esconder o botão na tela não basta, a Server Action pode ser chamada direto. Contas "somente
// Painel" não têm acesso a nenhuma delas (exigirAcessoCompleto).

// Teto de ids por chamada: a tela nunca manda mais que uma página de clientes, então um lote
// maior é formulário forjado e viraria uma consulta gigante.
const MAX_IDS = 500;

const idsDe = (formData: FormData, campo: string) =>
  formData
    .getAll(campo)
    .slice(0, MAX_IDS)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

const textoDe = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim() || null;

// Volta para a lista com o resultado da ação na URL; page.tsx lê "feito"/"acao" para montar
// a mensagem de confirmação (ver MENSAGEM em src/app/page.tsx).
function voltarPara(formData: FormData, feitos: number, acao: string): never {
  const p = new URLSearchParams(String(formData.get("voltar") ?? ""));
  p.set("feito", String(feitos));
  p.set("acao", acao);
  redirect(`/?${p}`);
}

// A gravação em si (transação + histórico) fica em src/lib/acoesPreSafra.ts, testável sem
// sessão/FormData. Aqui só cuidamos de autenticação, parsing do formulário e navegação.
export async function finalizarComNota(formData: FormData) {
  const sessao = await exigirAcessoCompleto();
  // Só se finaliza quem já foi agendado (tem formato previsto): a tela já esconde o botão dos
  // demais, e aqui o servidor ignora qualquer id que não esteja nessa condição.
  const idsPedidos = await idsPermitidos(sessao, idsDe(formData, "ids"));
  const ids = (
    await prisma.preSafra.findMany({
      where: { id: { in: idsPedidos }, formato: { not: null } },
      select: { id: true },
    })
  ).map((p) => p.id);
  // Formato, melhorias e observação vêm um por cliente (o modal aplica um padrão para todos
  // no formato, ajustável por linha) — nenhum dos três é decidido em bloco para a seleção
  // inteira.
  const formatoDe = (id: number): Formato | null => {
    const v = textoDe(formData, `formato_${id}`);
    return formatoValido(v) ? v : null;
  };
  const melhoriasDe = (id: number) => formData.get(`melhorias_${id}`) === "on";
  const observacaoDe = (id: number) => textoDe(formData, `observacao_${id}`);

  const { feitos, faltaFormato } = await finalizarPendentes({
    ids,
    formatoDe,
    observacaoDe,
    melhoriasDe,
    autor: sessao.nome,
  });
  voltarPara(formData, faltaFormato ? 0 : feitos, "finalizados");
}

// O motivo da reabertura é gravado na finalização que estava valendo. O campo de observação
// da próxima finalização começa sempre vazio.
export async function reabrirComMotivo(formData: FormData) {
  const sessao = await exigirAcessoCompleto();
  const motivo = textoDe(formData, "motivoReabertura");
  if (!motivo) voltarPara(formData, 0, "reabertos");
  const ids = await idsPermitidos(sessao, idsDe(formData, "ids"));
  const feitos = await reabrirIds({ ids, motivo, autor: sessao.nome });
  voltarPara(formData, feitos, "reabertos");
}

// Motivo de pendência de quem está "A Fazer" ou "Atrasado", trocado na própria linha (seletor + observação curta).
// Qualquer usuário com acesso completo pode registrá-lo, como no agendamento. Devolve o texto do
// problema (ou null se gravou) para a linha mostrá-lo. Só vale para quem está pendente de fato:
// a condição vai na própria gravação, então um cliente agendado ou finalizado por outra pessoa
// nesse meio tempo não recebe motivo. Pendente = sem formato (A Fazer) ou com a data já vencida (Atrasado).
export async function salvarMotivoPendencia(
  id: number,
  motivo: string,
  observacao: string,
): Promise<string | null> {
  const sessao = await exigirAcessoCompleto();
  if (!Number.isInteger(id)) return "Cliente inválido.";
  if (motivo !== "" && !motivoPendenciaValido(motivo)) return "Motivo inválido.";
  const { count } = await prisma.preSafra.updateMany({
    where: {
      id,
      configuradoSistema: false,
      inativo: false,
      OR: [{ formato: null }, { dataPrevista: { lt: new Date(diaHoje(new Date())) } }],
    },
    data: {
      motivoPendencia: motivo || null,
      // Observação sem motivo não faz sentido: ao voltar para "Sem motivo definido", ela sai junto.
      observacaoPendencia: motivo ? limparObservacaoPendencia(observacao) : null,
      atualizadoPor: sessao.nome,
    },
  });
  if (count === 0) return "Este cliente não está mais pendente. Atualize a página.";
  revalidatePath("/");
  return null;
}

// Janela "Agendar" da lista: grava de uma vez responsável, data, horário e formato ("Online" ou
// "Presencial" deixa o cliente como "Agendado Online"/"Agendado Presencial"). Os quatro campos
// são obrigatórios. O botão "Remover agendamento" (campo "remover") limpa data, horário, formato
// e responsável e devolve o cliente a "A Fazer" (o responsável só é limpo por quem tem a permissão de trocá-lo, que é quem
// consegue defini-lo de novo; para os demais ele fica). A janela já mostra os erros; aqui o servidor
// garante as regras mesmo para uma chamada direta, e nesse caso não grava nada: campo faltando,
// datas e horários passados, sábados, domingos e feriados, cliente finalizado ou inativo. Qualquer usuário
// agenda qualquer cliente, mas só o admin e o responsável do cliente removem o agendamento. Só quem tem a permissão "trocarResp" (o admin tem) troca o responsável; o usuário comum que
// agenda um cliente sem responsável passa a ser o responsável dele (assume ao agendar).
export async function agendarCliente(formData: FormData) {
  const sessao = await exigirAcessoCompleto();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) voltarPara(formData, 0, "agendados");

  const registro = await prisma.preSafra.findUnique({
    where: { id },
    select: {
      responsavel: true,
      configuradoSistema: true,
      inativo: true,
      dataPrevista: true,
      horario: true,
      formato: true,
    },
  });
  if (!registro || registro.configuradoSistema || registro.inativo) {
    voltarPara(formData, 0, "agendados");
  }

  if (formData.get("remover")) {
    // Só o admin e o responsável do cliente removem o agendamento (o servidor garante mesmo sem o botão).
    if (!podeAlterarCliente(sessao, registro.responsavel)) voltarPara(formData, 0, "desagendados");
    await prisma.preSafra.update({
      where: { id },
      data: {
        dataPrevista: null,
        horario: null,
        formato: null,
        agendadoPor: null,
        agendadoEm: null,
        atualizadoPor: sessao.nome,
        ...(pode(sessao, "trocarResp") ? { responsavel: null } : {}),
      },
    });
    voltarPara(formData, 1, "desagendados");
  }

  // Agendar exige poder ter um responsável.
  if (!podeAgendarCliente(sessao, registro.responsavel)) voltarPara(formData, 0, "agendados");

  const dataTexto = textoDe(formData, "data") ?? "";
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(dataTexto);
  const dia = dataValida ? new Date(`${dataTexto}T00:00:00Z`) : null;
  if (dataTexto && (!dia || Number.isNaN(dia.getTime()) || motivoDataIndisponivel(dataTexto))) {
    voltarPara(formData, 0, "agendados");
  }

  const horario = textoDe(formData, "horario");
  if (horario && !horarioValido(horario)) voltarPara(formData, 0, "agendados");
  // Hoje só vale de agora em diante.
  if (horario && motivoHorarioPassado(dataTexto, horario)) voltarPara(formData, 0, "agendados");

  const formato = textoDe(formData, "formato");
  if (!formatoValido(formato)) voltarPara(formData, 0, "agendados");

  // Sem responsável, o usuário comum assume o cliente ao agendar (o nome ligado à conta dele).
  const semResponsavel = !registro?.responsavel?.trim();
  const escolheResponsavel = pode(sessao, "trocarResp");
  const responsavel = escolheResponsavel
    ? textoDe(formData, "responsavel")
    : (registro?.responsavel?.trim() || sessao.nomeResponsavel || null);

  if (!responsavel || !dia || !horario) voltarPara(formData, 0, "agendados");

  await prisma.preSafra.update({
    where: { id },
    data: {
      ...(escolheResponsavel || semResponsavel ? { responsavel } : {}),
      dataPrevista: dia,
      horario,
      formato,
      agendadoPor: sessao.nome,
      agendadoEm: new Date(),
      atualizadoPor: sessao.nome,
      // Agendado, o cliente deixa de estar pendente: o motivo anterior não vale mais.
      motivoPendencia: null,
      observacaoPendencia: null,
    },
  });
  // Avisa o cliente só se data, horário ou formato mudaram (e se o aviso automático estiver ligado).
  const mudou =
    registro.dataPrevista?.toISOString().slice(0, 10) !== dataTexto ||
    registro.horario !== horario ||
    registro.formato !== formato;
  if (mudou) await avisarMudancaDeData(id, sessao.nome);
  voltarPara(formData, 1, "agendados");
}
