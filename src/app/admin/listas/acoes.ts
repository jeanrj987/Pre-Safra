"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ehTipoOpcao, validarNomeOpcao } from "@/lib/opcoesLista";

// Mesma permissão da aba Clientes: quem cadastra clientes também cadastra as opções das listas.

function revalidarTelas() {
  revalidatePath("/admin/listas");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/usuarios");
  revalidatePath("/", "layout");
}

// Devolve o erro (nome vazio, grande demais ou repetido) para a tela mostrá-lo junto do campo.
export async function adicionarOpcao(tipo: string, formData: FormData): Promise<{ erro?: string }> {
  await exigirPermissao("clientes");
  if (!ehTipoOpcao(tipo)) return { erro: "Lista desconhecida." };
  const cadastradas = await prisma.opcaoLista.findMany({ where: { tipo }, select: { nome: true } });
  const resultado = validarNomeOpcao(
    tipo,
    String(formData.get("nome") ?? ""),
    cadastradas.map((o) => o.nome),
  );
  if ("erro" in resultado) return { erro: resultado.erro };
  try {
    await prisma.opcaoLista.create({ data: { tipo, nome: resultado.nome } });
  } catch (e) {
    // Dois cadastros ao mesmo tempo com o mesmo nome: o índice único do banco barra o segundo (P2002).
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return { erro: "Esse nome já está cadastrado." };
    }
    throw e;
  }
  revalidarTelas();
  return {};
}

// Tira só a opção da lista; os clientes que a usam não mudam (ela segue aparecendo por causa deles).
export async function removerOpcao(id: number): Promise<{ erro?: string }> {
  await exigirPermissao("clientes");
  if (!Number.isInteger(id)) return { erro: "Opção inválida." };
  await prisma.opcaoLista.deleteMany({ where: { id } });
  revalidarTelas();
  return {};
}
