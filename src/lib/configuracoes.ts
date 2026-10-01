import { prisma } from "@/lib/db";
import { SEGUNDOS_PAGINA_TELAO } from "@/lib/sugestoes";

const CHAVE_SEGUNDOS_PAGINA = "telaoSegundosPorPagina";

/** Valor válido (inteiro dentro dos limites) ou null. */
export function validarSegundosPagina(valor: unknown): number | null {
  const n = Number(valor);
  const { min, max } = SEGUNDOS_PAGINA_TELAO;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function lerSegundosPaginaTelao(): Promise<number> {
  const linha = await prisma.configuracao.findUnique({ where: { chave: CHAVE_SEGUNDOS_PAGINA } });
  return validarSegundosPagina(linha?.valor) ?? SEGUNDOS_PAGINA_TELAO.padrao;
}

export async function gravarSegundosPaginaTelao(segundos: number): Promise<void> {
  const valor = String(segundos);
  await prisma.configuracao.upsert({
    where: { chave: CHAVE_SEGUNDOS_PAGINA },
    update: { valor },
    create: { chave: CHAVE_SEGUNDOS_PAGINA, valor },
  });
}
