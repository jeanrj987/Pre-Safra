"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizarEmail } from "@/lib/email";
import { nomeMaiusculo } from "@/lib/texto";
import { normalizarWhatsapp } from "@/lib/whatsapp";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

// Devolve o erro (nome vazio ou já usado) para a janela de edição mostrá-lo no lugar.
export async function salvarCadastro(id: number, formData: FormData): Promise<{ erro?: string }> {
  await exigirPermissao("clientes");
  const nome = nomeMaiusculo(String(formData.get("nome") ?? ""));
  if (!nome) return { erro: "Preencha o nome do cliente." };
  // O nome é único: comparar sem diferenciar maiúsculas evita dois cadastros "iguais" na tela.
  const repetido = await prisma.cliente.findFirst({
    where: { id: { not: id }, nome: { equals: nome, mode: "insensitive" } },
    select: { id: true },
  });
  if (repetido) return { erro: "Já existe um cliente com esse nome." };
  // Contato para os avisos: vazio apaga; preenchido precisa ser válido (nada é salvo pela metade).
  const whatsappTexto = texto(formData, "whatsapp");
  const whatsapp = whatsappTexto ? normalizarWhatsapp(whatsappTexto) : null;
  if (whatsappTexto && !whatsapp) return { erro: "WhatsApp inválido. Use o DDD e o número, ex.: (66) 99999-8888." };
  const emailTexto = texto(formData, "email");
  const email = emailTexto ? normalizarEmail(emailTexto) : null;
  if (emailTexto && !email) return { erro: "E-mail inválido." };
  await prisma.cliente.update({
    where: { id },
    data: {
      nome,
      cidade: texto(formData, "cidade"),
      uf: texto(formData, "uf")?.toUpperCase() ?? null,
      regiao: texto(formData, "regiao"),
      atendente: texto(formData, "atendente"),
      consultor: texto(formData, "consultor"),
      comercial: texto(formData, "comercial"),
      whatsapp,
      email,
    },
  });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
  return {};
}

// Inativar/reativar vale para o Pré-Safra do cliente na safra selecionada (é ele que sai ou
// volta para a lista principal e o painel). Só administradores, só por aqui.
export async function inativarCliente(preSafraId: number, formData: FormData) {
  const sessao = await exigirPermissao("clientes");
  const motivo = texto(formData, "motivoInativacao");
  if (!motivo) return;
  await prisma.preSafra.update({
    where: { id: preSafraId },
    data: { inativo: true, motivoInativacao: motivo, atualizadoPor: sessao.nome },
  });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
}

// Tira o cliente só da safra selecionada: apaga o Pré-Safra dele nela (com o histórico de
// conclusões, que sai em cascata). O cadastro do cliente e as outras safras ficam intactos.
export async function excluirClienteDaSafra(preSafraId: number) {
  await exigirPermissao("clientes");
  await prisma.preSafra.deleteMany({ where: { id: preSafraId } });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
}

export async function reativarCliente(preSafraId: number) {
  const sessao = await exigirPermissao("clientes");
  await prisma.preSafra.update({
    where: { id: preSafraId },
    data: { inativo: false, motivoInativacao: null, atualizadoPor: sessao.nome },
  });
  revalidatePath("/admin/clientes");
  revalidatePath("/", "layout");
}
