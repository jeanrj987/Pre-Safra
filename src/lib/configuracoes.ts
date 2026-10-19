import { prisma } from "@/lib/db";
import { META_FAQ, SEGUNDOS_PAGINA_TELAO } from "@/lib/sugestoes";

const CHAVE_SEGUNDOS_PAGINA = "telaoSegundosPorPagina";
const CHAVE_META_FAQ = "metaFaq";
const CHAVE_TELAO_ATIVO = "telaoAtivo";

// Enquanto o telão está aberto ele consulta o servidor a cada poucos segundos, o que consome
// o plano da hospedagem. Por isso vem desligado: o admin liga só nos dias em que for usar.
export async function lerTelaoAtivo(): Promise<boolean> {
  const linha = await prisma.configuracao.findUnique({ where: { chave: CHAVE_TELAO_ATIVO } });
  return linha?.valor === "1";
}

export async function gravarTelaoAtivo(ativo: boolean): Promise<void> {
  const valor = ativo ? "1" : "0";
  await prisma.configuracao.upsert({
    where: { chave: CHAVE_TELAO_ATIVO },
    update: { valor },
    create: { chave: CHAVE_TELAO_ATIVO, valor },
  });
}

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

/** Meta válida (inteiro dentro dos limites) ou null. */
export function validarMetaFaq(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n >= META_FAQ.min && n <= META_FAQ.max ? n : null;
}

/** Meta de sugestões de FAQ do telão; null quando o admin não definiu nenhuma. */
export async function lerMetaFaq(): Promise<number | null> {
  const linha = await prisma.configuracao.findUnique({ where: { chave: CHAVE_META_FAQ } });
  return validarMetaFaq(linha?.valor);
}

/** Grava a meta; null remove (o telão deixa de mostrar a barra). */
export async function gravarMetaFaq(meta: number | null): Promise<void> {
  if (meta === null) {
    await prisma.configuracao.deleteMany({ where: { chave: CHAVE_META_FAQ } });
    return;
  }
  const valor = String(meta);
  await prisma.configuracao.upsert({
    where: { chave: CHAVE_META_FAQ },
    update: { valor },
    create: { chave: CHAVE_META_FAQ, valor },
  });
}
