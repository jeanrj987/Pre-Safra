// Uso: npm run padronizar:nomes -- [--simular]
// Deixa em MAIÚSCULAS o nome de todos os clientes (e o nome digitado à mão nos Pré-Safras sem
// cadastro). O nome do cliente é único: se dois nomes só diferirem por caixa (ex.: "Fulano" e
// "FULANO"), nada é gravado e os pares são listados para serem unificados antes à mão.
// Reexecutável: o que já está em maiúsculas não é tocado. Com --simular, não grava nada.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const simular = process.argv.includes("--simular");
const maiusculo = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const clientes = await prisma.cliente.findMany({ select: { id: true, nome: true } });
  const porNovoNome = new Map<string, string[]>();
  for (const c of clientes) {
    const novo = maiusculo(c.nome);
    porNovoNome.set(novo, [...(porNovoNome.get(novo) ?? []), c.nome]);
  }
  const conflitos = [...porNovoNome].filter(([, originais]) => originais.length > 1);
  if (conflitos.length) {
    console.error("Nomes que ficariam iguais em maiúsculas (unifique-os antes):");
    conflitos.forEach(([novo, originais]) => console.error(`  ${novo} <- ${originais.map((o) => `"${o}"`).join(", ")}`));
    await prisma.$disconnect();
    process.exit(1);
  }

  const mudam = clientes.filter((c) => maiusculo(c.nome) !== c.nome);
  const manuais = await prisma.preSafra.findMany({
    where: { clienteNomeManual: { not: null } },
    select: { id: true, clienteNomeManual: true },
  });
  const manuaisMudam = manuais.filter((m) => maiusculo(m.clienteNomeManual!) !== m.clienteNomeManual);

  console.log(
    `${simular ? "[SIMULAÇÃO] " : ""}${clientes.length} cliente(s); ${mudam.length} ${simular ? "seriam alterados" : "serão alterados"}; ${manuaisMudam.length} nome(s) manual(is) a ajustar.`,
  );
  if (simular) {
    mudam.slice(0, 15).forEach((c) => console.log(`  "${c.nome}" -> "${maiusculo(c.nome)}"`));
    if (mudam.length > 15) console.log(`  … e mais ${mudam.length - 15}`);
    console.log("Nada foi gravado.");
    await prisma.$disconnect();
    return;
  }

  // Tudo ou nada; interativa para poder ampliar o limite de 5 s (são centenas de updates).
  await prisma.$transaction(
    async (tx) => {
      for (const c of mudam) await tx.cliente.update({ where: { id: c.id }, data: { nome: maiusculo(c.nome) } });
      for (const m of manuaisMudam) {
        await tx.preSafra.update({ where: { id: m.id }, data: { clienteNomeManual: maiusculo(m.clienteNomeManual!) } });
      }
    },
    { timeout: 120_000 },
  );
  console.log("Pronto.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
