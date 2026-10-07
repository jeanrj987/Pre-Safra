import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";

const DIA = 24 * 60 * 60 * 1000;
const COOKIE_SAFRA = "presafra_safra";

export interface PeriodoSafra {
  inicio: number;
  prazo: number;
  fim: number;
}

export const listarSafrasAtivas = cache(() =>
  prisma.safra.findMany({ where: { ativa: true }, orderBy: { inicio: "asc" } }),
);

// Safra do cookie, validada contra as safras ativas; cookie ausente/inválido/apontando para
// uma safra arquivada cai para a primeira safra ativa. Retorna null se não houver nenhuma
// safra cadastrada ainda (as páginas mostram um aviso pedindo para um admin criar uma).
export const obterSafraSelecionada = cache(async () => {
  const safras = await listarSafrasAtivas();
  if (safras.length === 0) return null;
  const valor = Number((await cookies()).get(COOKIE_SAFRA)?.value);
  return safras.find((s) => s.id === valor) ?? safras[0];
});

// Nome do produto como aparece na tela, no menu e na aba do navegador: "Pré-Safra Soja 26/27".
// Muda junto com a safra selecionada; sem nenhuma safra cadastrada, fica só "Pré-Safra".
export function tituloPreSafra(safra: { nome: string } | null | undefined): string {
  return safra ? `Pré-Safra ${safra.nome}` : "Pré-Safra";
}

export function periodoDe(safra: { inicio: Date; prazo: Date }): PeriodoSafra {
  const prazo = safra.prazo.getTime();
  return { inicio: safra.inicio.getTime(), prazo, fim: prazo + 31 * DIA };
}

export async function selecionarSafraCookie(safraId: number) {
  (await cookies()).set(COOKIE_SAFRA, String(safraId), {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
