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
