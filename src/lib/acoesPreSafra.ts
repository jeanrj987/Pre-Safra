// Núcleo das ações de finalizar/reabrir em lote (src/app/acoes.ts): só a gravação em
// banco, sem sessão nem FormData. Separado assim para poder ser testado com um Prisma real,
// sem precisar simular cookies()/redirect() do Next (que exigem contexto de requisição).
import { prisma } from "./db";

export type Formato = "Online" | "Presencial";
export const formatoValido = (v: string | null): v is Formato => v === "Online" || v === "Presencial";

export interface ResultadoFinalizar {
  feitos: number;
  faltaFormato: boolean;
}

// Finaliza quem ainda não está com configuradoSistema = true (clientes já finalizados são
// ignorados, para não duplicar entrada no histórico). Se algum pendente selecionado não tem
// formato, a operação toda é recusada (all-or-nothing) — inclusive para quem já tinha formato.
export async function finalizarPendentes({
  ids,
  formatoDe,
  observacaoDe,
  melhoriasDe,
  autor,
}: {
  ids: number[];
  formatoDe: (id: number) => Formato | null;
  /** Observação da conclusão daquele cliente — cada um tem a sua, não uma só para o lote. */
  observacaoDe: (id: number) => string | null;
  /** Se as melhorias foram apresentadas para aquele cliente — decidido um a um, não em bloco. */
  melhoriasDe: (id: number) => boolean;
  autor: string;
}): Promise<ResultadoFinalizar> {
  const pendentes = await prisma.preSafra.findMany({
    where: { id: { in: ids }, configuradoSistema: false },
    select: { id: true },
  });
  const idsPendentes = pendentes.map((p) => p.id);

  if (idsPendentes.some((id) => !formatoDe(id))) {
    return { feitos: 0, faltaFormato: true };
  }
  if (idsPendentes.length === 0) return { feitos: 0, faltaFormato: false };

  await prisma.$transaction([
    ...idsPendentes.map((id) =>
      prisma.preSafra.update({
        where: { id },
        data: {
          configuradoSistema: true,
          melhoriasApresentadas: melhoriasDe(id),
          formato: formatoDe(id),
        },
      }),
    ),
    prisma.conclusao.createMany({
      data: idsPendentes.map((preSafraId) => ({
        preSafraId,
        observacao: observacaoDe(preSafraId),
        autor,
      })),
    }),
  ]);
  return { feitos: idsPendentes.length, faltaFormato: false };
}

// Reabre os ids informados e grava o motivo na finalização que estava em vigor (a que ainda
// não tinha sido reaberta). O histórico anterior a essa finalização não é tocado.
export async function reabrirIds({
  ids,
  motivo,
  autor,
}: {
  ids: number[];
  motivo: string;
  autor: string;
}): Promise<number> {
  if (ids.length === 0) return 0;
  await prisma.$transaction([
    prisma.preSafra.updateMany({
      where: { id: { in: ids } },
      data: { configuradoSistema: false },
    }),
    prisma.conclusao.updateMany({
      where: { preSafraId: { in: ids }, reabertoEm: null },
      data: { reabertoEm: new Date(), reabertoPor: autor, motivoReabertura: motivo },
    }),
  ]);
  return ids.length;
}
