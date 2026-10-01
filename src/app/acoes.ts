"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin, exigirLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { finalizarPendentes, formatoValido, reabrirIds, type Formato } from "@/lib/acoesPreSafra";
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

// Reativar (inativo === false) é só para administradores; inativar continua liberado.
export async function inativarLote(inativo: boolean, formData: FormData) {
  await (inativo ? exigirLogin() : exigirAdmin());
  const ids = idsDe(formData, "ids");
  if (ids.length) {
    await prisma.preSafra.updateMany({
      where: { id: { in: ids } },
      data: { inativo, ...(!inativo && { motivoInativacao: null }) },
    });
  }
  voltarPara(formData, ids.length, inativo ? "inativados" : "reativados");
}

// Botão da própria linha: age só sobre aquele cliente, ignorando as caixas marcadas.
export async function inativarUm(inativo: boolean, id: number, formData: FormData) {
  await (inativo ? exigirLogin() : exigirAdmin());
  await prisma.preSafra.updateMany({
    where: { id },
    data: { inativo, ...(!inativo && { motivoInativacao: null }) },
  });
  voltarPara(formData, 1, inativo ? "inativados" : "reativados");
}

// Inativar com o motivo da janela (vale para um cliente ou para os marcados).
export async function inativarComMotivo(formData: FormData) {
  await exigirLogin();
  const ids = idsDe(formData, "ids");
  const motivo = textoDe(formData, "motivoInativacao");
  if (!motivo) voltarPara(formData, 0, "inativados");
  if (ids.length) {
    await prisma.preSafra.updateMany({
      where: { id: { in: ids } },
      data: { inativo: true, motivoInativacao: motivo },
    });
  }
  voltarPara(formData, ids.length, "inativados");
}

// A gravação em si (transação + histórico) fica em src/lib/acoesPreSafra.ts, testável sem
// sessão/FormData. Aqui só cuidamos de autenticação, parsing do formulário e navegação.
export async function finalizarComNota(formData: FormData) {
  const sessao = await exigirLogin();
  const ids = idsDe(formData, "ids");
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
  await prisma.preSafra.update({ where: { id }, data: { dataPrevista: dia } });
  revalidatePath("/");
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
