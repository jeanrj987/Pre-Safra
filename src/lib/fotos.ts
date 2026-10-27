// Fotos diárias: uma linha por Pré-Safra por dia, com o status que ele tinha naquele dia. O
// PreSafra guarda só o estado de agora, então sem isto "quantos estavam atrasados em setembro"
// não tem resposta. A foto é tirada uma vez por dia (cron da Vercel, ver vercel.json, ou
// `npm run foto:diaria`); tirar de novo no mesmo dia refaz a foto do dia, então é seguro repetir.
// Só servidor.
import { prisma } from "./db";
import type { FotoLinha } from "./relatorios";
import { motivoPendenciaValido, STATUS_COM_PENDENCIA } from "./pendencia";
import { calcularStatus, diaHoje } from "./status";

// O Postgres aceita 65 535 parâmetros por comando; 9 colunas por linha deixam bem folgado em 2 000.
const LOTE = 2000;

export async function registrarFotos(agora: Date = new Date()): Promise<{ dia: number; total: number }> {
  const hoje = diaHoje(agora);
  const dia = new Date(hoje);

  const safras = await prisma.safra.findMany({ where: { ativa: true }, select: { id: true } });
  const safraIds = safras.map((s) => s.id);
  if (safraIds.length === 0) return { dia: hoje, total: 0 };

  const registros = await prisma.preSafra.findMany({
    where: { safraId: { in: safraIds } },
    select: {
      id: true,
      safraId: true,
      responsavel: true,
      formato: true,
      dataPrevista: true,
      configuradoSistema: true,
      inativo: true,
      motivoPendencia: true,
      cliente: { select: { regiao: true } },
    },
  });

  const fotos = registros.map((r) => {
    const status = calcularStatus(
      { configuradoSistema: r.configuradoSistema, dataPrevista: r.dataPrevista, inativo: r.inativo, formato: r.formato },
      agora,
    );
    return {
      dia,
      safraId: r.safraId,
      preSafraId: r.id,
      status,
      responsavel: r.responsavel?.trim() || null,
      regiao: r.cliente?.regiao?.trim() || null,
      formato: r.formato,
      dataPrevista: r.dataPrevista,
      motivoPendencia:
        STATUS_COM_PENDENCIA.includes(status) && motivoPendenciaValido(r.motivoPendencia) ? r.motivoPendencia : null,
    };
  });

  // Apaga e regrava na mesma transação: ou fica a foto nova inteira, ou a antiga.
  await prisma.$transaction(async (tx) => {
    await tx.fotoPreSafra.deleteMany({ where: { dia, safraId: { in: safraIds } } });
    for (let i = 0; i < fotos.length; i += LOTE) {
      await tx.fotoPreSafra.createMany({ data: fotos.slice(i, i + LOTE) });
    }
  });
  return { dia: hoje, total: fotos.length };
}

/** Fotos da safra entre dois dias (UTC, ms), inclusive. */
export async function listarFotos(safraId: number, inicio: number, fim: number): Promise<FotoLinha[]> {
  const fotos = await prisma.fotoPreSafra.findMany({
    where: { safraId, dia: { gte: new Date(inicio), lte: new Date(fim) } },
    select: { dia: true, status: true, responsavel: true, regiao: true },
  });
  return fotos.map((f) => ({ ...f, dia: f.dia.getTime() }));
}

/** O primeiro e o último dia com foto desta safra (UTC, ms); nulos se nunca houve foto. */
export async function limitesDasFotos(safraId: number): Promise<{ primeira: number | null; ultima: number | null }> {
  const r = await prisma.fotoPreSafra.aggregate({
    where: { safraId },
    _min: { dia: true },
    _max: { dia: true },
  });
  return { primeira: r._min.dia?.getTime() ?? null, ultima: r._max.dia?.getTime() ?? null };
}
