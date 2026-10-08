import { lerSegundosPaginaTelao, lerTelaoAtivo } from "@/lib/configuracoes";
import { prisma } from "@/lib/db";
import {
  matizesDoTelao,
  paraTelao,
  SEGUNDOS_PAGINA_TELAO,
  TETO_NO_TELAO,
  type SugestaoTelao,
} from "@/lib/sugestoes";

export interface DadosTelao {
  // Falso quando o admin desligou o telão: ele não mostra ideias e para de consultar o servidor.
  ativo: boolean;
  // As visíveis, da mais nova para a mais antiga, até o teto do telão. O telão as reparte em
  // páginas que giram; o que passa do teto continua só na lista do admin.
  sugestoes: SugestaoTelao[];
  total: number; // todas as visíveis, inclusive as que passaram do teto
  segundosPagina: number; // quanto cada página fica na tela (ajuste do admin)
}

export async function carregarTelao(): Promise<DadosTelao> {
  // Desligado: responde só com o aviso, sem buscar as ideias (uma consulta leve ao banco).
  if (!(await lerTelaoAtivo())) {
    return { ativo: false, sugestoes: [], total: 0, segundosPagina: SEGUNDOS_PAGINA_TELAO.padrao };
  }
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
    ativo: true,
    sugestoes: linhas.map((l) => paraTelao(l, matizes.get(l.id))),
    total,
    segundosPagina,
  };
}
