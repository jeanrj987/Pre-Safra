"use server";
import { revalidatePath } from "next/cache";
import { exigirAcessoCompleto } from "@/lib/auth";
import { motivoDataAtividade, motivoHorarioAtividade } from "@/lib/calendario";
import { prisma } from "@/lib/db";

// Server Actions da aba Calendário. As regras de data e horário são as mesmas do agendamento de
// clientes (ver src/lib/calendario.ts). A janela já mostra os erros campo a campo; aqui o servidor
// garante as regras mesmo para uma chamada direta e devolve o texto do erro (ou null se deu certo).

const MAX_TITULO = 200;
const MAX_DESCRICAO = 2000;

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

const isoDe = (d: Date) => d.toISOString().slice(0, 10);

function lerCampos(
  formData: FormData,
  original?: { data: string; horario: string | null },
):
  | { erro: string }
  | { titulo: string; descricao: string | null; data: Date; horario: string } {
  const titulo = texto(formData, "titulo");
  if (!titulo) return { erro: "Informe o título da atividade." };
  if (titulo.length > MAX_TITULO) return { erro: `O título pode ter no máximo ${MAX_TITULO} caracteres.` };

  const dataTexto = texto(formData, "data") ?? "";
  const horario = texto(formData, "horario") ?? "";
  const erro =
    motivoDataAtividade(dataTexto, original?.data) ?? motivoHorarioAtividade(dataTexto, horario, original);
  if (erro) return { erro };

  const descricao = texto(formData, "descricao");
  if (descricao && descricao.length > MAX_DESCRICAO) {
    return { erro: `Os detalhes podem ter no máximo ${MAX_DESCRICAO} caracteres.` };
  }

  return { titulo, descricao, data: new Date(`${dataTexto}T00:00:00Z`), horario };
}

export async function criarAtividade(formData: FormData): Promise<string | null> {
  const sessao = await exigirAcessoCompleto();
  const campos = lerCampos(formData);
  if ("erro" in campos) return campos.erro;

  await prisma.atividade.create({ data: { ...campos, criadoPor: sessao.nome } });
  revalidatePath("/calendario");
  return null;
}

export async function editarAtividade(formData: FormData): Promise<string | null> {
  await exigirAcessoCompleto();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return "Atividade não encontrada.";

  const existente = await prisma.atividade.findUnique({ where: { id }, select: { data: true, horario: true } });
  if (!existente) return "Atividade não encontrada. Ela pode ter sido excluída por outra pessoa.";

  const campos = lerCampos(formData, { data: isoDe(existente.data), horario: existente.horario });
  if ("erro" in campos) return campos.erro;

  await prisma.atividade.update({
    where: { id },
    data: { ...campos, concluida: formData.get("concluida") === "on" },
  });
  revalidatePath("/calendario");
  return null;
}

// Marca/desmarca como feita direto no calendário, sem abrir a janela de edição (e sem revalidar
// data e horário: marcar uma atividade atrasada como feita tem que ser sempre possível).
export async function alternarConclusao(id: number, concluida: boolean): Promise<void> {
  await exigirAcessoCompleto();
  if (!Number.isInteger(id)) return;
  await prisma.atividade.updateMany({ where: { id }, data: { concluida } });
  revalidatePath("/calendario");
}

export async function excluirAtividade(id: number): Promise<void> {
  await exigirAcessoCompleto();
  if (!Number.isInteger(id)) return;
  await prisma.atividade.deleteMany({ where: { id } });
  revalidatePath("/calendario");
}
