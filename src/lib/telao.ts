import { lerSegundosPaginaTelao, lerTelaoAtivo } from "@/lib/configuracoes";
import { prisma } from "@/lib/db";
import {
  matizesDoTelao,
  paraTelao,
  SEGUNDOS_PAGINA_TELAO,
  TETO_NO_TELAO,
  TIPOS_SUGESTAO,
  type SugestaoTelao,
  type TipoSugestao,
} from "@/lib/sugestoes";

export interface DadosTelao {
  // Falso quando o admin desligou o telão: ele não mostra ideias e para de consultar o servidor.
  ativo: boolean;
  // As visíveis de cada tipo (FAQ e melhoria), da mais nova para a mais antiga, até o teto do telão.
  // Cada coluna do telão as reparte em páginas que giram; o que passa do teto continua só na lista
  // do admin.
  sugestoes: Record<TipoSugestao, SugestaoTelao[]>;
  totais: Record<TipoSugestao, number>; // todas as visíveis, inclusive as que passaram do teto
  segundosPagina: number; // quanto cada página fica na tela (ajuste do admin)
}

const porTipo = <T>(valor: () => T): Record<TipoSugestao, T> => ({ faq: valor(), melhoria: valor() });

export async function carregarTelao(): Promise<DadosTelao> {
  // Desligado: responde só com o aviso, sem buscar as ideias (uma consulta leve ao banco).
  if (!(await lerTelaoAtivo())) {
    return {
      ativo: false,
      sugestoes: porTipo<SugestaoTelao[]>(() => []),
      totais: porTipo(() => 0),
      segundosPagina: SEGUNDOS_PAGINA_TELAO.padrao,
    };
  }
  const [listas, contagens, segundosPagina] = await Promise.all([
    Promise.all(
      TIPOS_SUGESTAO.map((tipo) =>
        prisma.sugestao.findMany({
          where: { oculta: false, tipo },
          orderBy: { id: "desc" },
          take: TETO_NO_TELAO,
          select: { id: true, tipo: true, nome: true, topico: true, topicoNorm: true, texto: true },
        }),
      ),
    ),
    prisma.sugestao.groupBy({ by: ["tipo"], where: { oculta: false }, _count: { _all: true } }),
    lerSegundosPaginaTelao(),
  ]);

  const sugestoes = porTipo<SugestaoTelao[]>(() => []);
  TIPOS_SUGESTAO.forEach((tipo, i) => {
    // As cores se espalham dentro de cada coluna, que tem os seus próprios assuntos
    const matizes = matizesDoTelao(listas[i]);
    sugestoes[tipo] = listas[i].map((l) => paraTelao({ ...l, tipo }, matizes.get(l.id)));
  });
  const totais = porTipo(() => 0);
  for (const c of contagens) {
    if (c.tipo === "faq" || c.tipo === "melhoria") totais[c.tipo] = c._count._all;
  }
  return { ativo: true, sugestoes, totais, segundosPagina };
}
