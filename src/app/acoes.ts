"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin, exigirLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { finalizarPendentes, formatoValido, reabrirIds, type Formato } from "@/lib/acoesPreSafra";
import { motivoDiaBloqueado } from "@/lib/diasUteis";
import { horarioValido } from "@/lib/horarios";

// Server Actions da lista principal (src/app/page.tsx). Extraídas para cá para poder ser
// importadas/testadas fora do componente de página, que já é grande só com a tabela e os
// filtros.

const idsDe = (formData: FormData, campo: string) =>
  formData
    .getAll(campo)
    .map(Number)
    .filter((n) => Number.isInteger(n));

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
  const sessao = await exigirLogin();
  // Só se finaliza quem já foi agendado (tem formato previsto): a tela já esconde o botão dos
  // demais, e aqui o servidor ignora qualquer id que não esteja nessa condição.
  const idsPedidos = idsDe(formData, "ids");
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
  const sessao = await exigirLogin();
  const motivo = textoDe(formData, "motivoReabertura");
  if (!motivo) voltarPara(formData, 0, "reabertos");
  const ids = idsDe(formData, "ids");
  const feitos = await reabrirIds({ ids, motivo, autor: sessao.nome });
  voltarPara(formData, feitos, "reabertos");
}

// Data prevista editada direto na linha; vazio limpa a data.
export async function definirData(id: number, data: string) {
  await exigirLogin();
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data);
  const dia = valida ? new Date(`${data}T00:00:00Z`) : null;
  if (data && (!dia || Number.isNaN(dia.getTime()))) return;
  // O campo da lista já recusa esses dias; aqui garante a regra mesmo para uma chamada direta.
  const motivo = data ? motivoDiaBloqueado(data) : null;
  if (motivo) throw new Error(motivo);
  await prisma.preSafra.update({ where: { id }, data: { dataPrevista: dia } });
  revalidatePath("/");
}

// Previsão de como o atendimento será feito, escolhida na coluna Status da lista: "Online" ou
// "Presencial" deixa o cliente como "Agendado Online"/"Agendado Presencial"; vazio volta a "A Fazer".
// Usa o mesmo campo `formato` da finalização, que confirma (ou corrige) a escolha depois.
// Para agendar, o cliente precisa já ter responsável, data e horário: sem isso devolve a
// mensagem do que falta (e não grava). Devolve null quando gravou.
export async function definirPrevisao(id: number, formato: string): Promise<string | null> {
  await exigirLogin();
  const valor = formatoValido(formato) ? formato : null;
  if (formato && !valor) return null;
  if (valor) {
    const r = await prisma.preSafra.findUnique({
      where: { id },
      select: { responsavel: true, dataPrevista: true, horario: true },
    });
    const faltam = [
      !r?.responsavel?.trim() && "responsável",
      !r?.dataPrevista && "data",
      !r?.horario && "horário",
    ].filter(Boolean);
    if (faltam.length) {
      const lista = faltam.length > 1 ? `${faltam.slice(0, -1).join(", ")} e ${faltam.at(-1)}` : faltam[0];
      return `Para agendar, preencha antes: ${lista}.`;
    }
  }
  await prisma.preSafra.update({ where: { id }, data: { formato: valor } });
  revalidatePath("/");
  return null;
}

// Horário agendado editado direto na linha; vazio limpa o horário.
export async function definirHorario(id: number, horario: string) {
  await exigirLogin();
  if (horario && !horarioValido(horario)) return;
  await prisma.preSafra.update({ where: { id }, data: { horario: horario || null } });
  revalidatePath("/");
}

// Responsável escolhido direto na linha; vazio limpa o responsável. Só admin edita.
export async function definirResponsavel(id: number, responsavel: string) {
  await exigirAdmin();
  await prisma.preSafra.update({
    where: { id },
    data: { responsavel: responsavel.trim() || null },
  });
  revalidatePath("/");
}
