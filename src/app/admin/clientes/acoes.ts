"use server";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function salvarCadastro(id: number, formData: FormData) {
  await exigirAdmin();
  await prisma.cliente.update({
    where: { id },
    data: {
      cidade: texto(formData, "cidade"),
      uf: texto(formData, "uf")?.toUpperCase() ?? null,
      regiao: texto(formData, "regiao"),
      atendente: texto(formData, "atendente"),
      consultor: texto(formData, "consultor"),
    },
  });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
}

// Inativar/reativar vale para o Pré-Safra do cliente na safra selecionada (é ele que sai ou
// volta para a lista principal e o painel). Só administradores, só por aqui.
export async function inativarCliente(preSafraId: number, formData: FormData) {
  await exigirAdmin();
  const motivo = texto(formData, "motivoInativacao");
  if (!motivo) return;
  await prisma.preSafra.update({
    where: { id: preSafraId },
    data: { inativo: true, motivoInativacao: motivo },
  });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
}

export async function reativarCliente(preSafraId: number) {
  await exigirAdmin();
  await prisma.preSafra.update({
    where: { id: preSafraId },
    data: { inativo: false, motivoInativacao: null },
  });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
}
