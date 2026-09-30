import { prisma } from "@/lib/db";
import { paraTelao, VAGAS_NO_TELAO, type SugestaoTelao } from "@/lib/sugestoes";

export interface DadosTelao {
  // As mais novas que cabem na tela (da mais nova para a mais antiga); as antigas saem para dar
  // lugar às novas, mas continuam na lista do admin.
  sugestoes: SugestaoTelao[];
  total: number; // todas as visíveis, inclusive as que já saíram da tela
}

export async function carregarTelao(): Promise<DadosTelao> {
  const [linhas, total] = await Promise.all([
    prisma.sugestao.findMany({
      where: { oculta: false },
      orderBy: { id: "desc" },
      take: VAGAS_NO_TELAO,
      select: { id: true, nome: true, topico: true, topicoNorm: true, texto: true },
    }),
    prisma.sugestao.count({ where: { oculta: false } }),
  ]);
  return { sugestoes: linhas.map(paraTelao), total };
}
