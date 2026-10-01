import { lerSegundosPaginaTelao } from "@/lib/configuracoes";
import { prisma } from "@/lib/db";
import { matizesDoTelao, paraTelao, TETO_NO_TELAO, type SugestaoTelao } from "@/lib/sugestoes";

export interface DadosTelao {
  // As visíveis, da mais nova para a mais antiga, até o teto do telão. O telão as reparte em
  // páginas que giram; o que passa do teto continua só na lista do admin.
  sugestoes: SugestaoTelao[];
  total: number; // todas as visíveis, inclusive as que passaram do teto
  segundosPagina: number; // quanto cada página fica na tela (ajuste do admin)
}

export async function carregarTelao(): Promise<DadosTelao> {
  const [linhas, total, segundosPagina] = await Promise.all([
    prisma.sugestao.findMany({
      where: { oculta: false },
      orderBy: { id: "desc" },
      take: TETO_NO_TELAO,
      select: { id: true, nome: true, topico: true, topicoNorm: true, texto: true },
    }),
    prisma.sugestao.count({ where: { oculta: false } }),
    lerSegundosPaginaTelao(),
  ]);
  const matizes = matizesDoTelao(linhas);
  return {
    sugestoes: linhas.map((l) => paraTelao(l, matizes.get(l.id))),
    total,
    segundosPagina,
  };
}
