// Núcleo das ações de finalizar/reabrir em lote (src/app/acoes.ts): só a gravação em
// banco, sem sessão nem FormData. Separado assim para poder ser testado com um Prisma real,
// sem precisar simular cookies()/redirect() do Next (que exigem contexto de requisição).
import { prisma } from "./db";
import { diaHoje } from "./status";

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

  // A condição configuradoSistema: false vai na própria gravação: se outra pessoa finalizou o
  // mesmo cliente entre a leitura acima e esta transação, ele é pulado (sem entrada duplicada).
  const feitos = await prisma.$transaction(async (tx) => {
    const finalizados: number[] = [];
    for (const id of idsPendentes) {
      const { count } = await tx.preSafra.updateMany({
        where: { id, configuradoSistema: false },
        data: {
          configuradoSistema: true,
          melhoriasApresentadas: melhoriasDe(id),
          formato: formatoDe(id),
        },
      });
      if (count > 0) finalizados.push(id);
    }
    if (finalizados.length > 0) {
      await tx.conclusao.createMany({
        data: finalizados.map((preSafraId) => ({
          preSafraId,
          observacao: observacaoDe(preSafraId),
          autor,
        })),
      });
    }
    return finalizados.length;
  }, { timeout: 20_000 }); // um update por cliente, em lote grande passa dos 5 s padrão
  return { feitos, faltaFormato: false };
}

// Reabre os ids informados (voltando a "A Fazer") e grava o motivo na finalização que estava em vigor (a que ainda
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
  // Todos os passos exigem o cliente ainda finalizado, e a bandeira configuradoSistema só vira
  // false no último (a ordem importa): quem já foi reaberto ou reagendado por outra pessoa, com
  // a tela desatualizada, não tem o agendamento novo apagado. O retorno é o que realmente mudou.
  const [, , { count }] = await prisma.$transaction([
    prisma.conclusao.updateMany({
      where: { preSafraId: { in: ids }, reabertoEm: null, preSafra: { configuradoSistema: true } },
      data: { reabertoEm: new Date(), reabertoPor: autor, motivoReabertura: motivo },
    }),
    // Uma data prevista já vencida sai (senão o cliente voltaria como "Atrasado", não "A Fazer");
    // data futura é mantida.
    prisma.preSafra.updateMany({
      where: {
        id: { in: ids },
        configuradoSistema: true,
        dataPrevista: { lt: new Date(diaHoje(new Date())) },
      },
      data: { dataPrevista: null },
    }),
    // Volta para "A Fazer": sem formato (previsão/realizado) nem horário, o cliente precisa ser
    // agendado de novo.
    prisma.preSafra.updateMany({
      where: { id: { in: ids }, configuradoSistema: true },
      data: { configuradoSistema: false, formato: null, horario: null },
    }),
  ]);
  return count;
}
