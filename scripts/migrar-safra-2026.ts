// Cria a primeira Safra a partir da constante fixa que existia em src/lib/painel.ts (SAFRA)
// e aponta todo PreSafra existente para ela.
//
// Roda ANTES do corte final do schema (quando safraId ainda é opcional e anoSafra ainda
// existe no banco) — ver prisma/schema.additivo.prisma e o runbook no final deste arquivo.
// Usa SQL bruto para ler/gravar anoSafra/safraId de propósito: assim o script continua
// funcionando não importa qual versão do schema.prisma esteja com `generate` no momento em
// que ele é executado (o Prisma Client tipado muda de forma entre a etapa aditiva e o corte).
// É seguro repetir.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Datas herdadas da constante SAFRA (src/lib/painel.ts) antes da refatoração para o banco.
const INICIO = new Date(Date.UTC(2026, 7, 1));
const PRAZO = new Date(Date.UTC(2026, 10, 30));

async function main() {
  // Nome neutro: não dá para saber se os dados atuais são de soja ou milho a partir do banco;
  // renomeie depois em /admin/safras.
  const nome = "Safra 2026";
  const safra = await prisma.safra.upsert({
    where: { nome },
    update: {},
    create: { nome, cultura: null, inicio: INICIO, prazo: PRAZO, ativa: true },
  });

  const atualizados = await prisma.$executeRaw`
    UPDATE "PreSafra" SET "safraId" = ${safra.id}
    WHERE "safraId" IS NULL AND "anoSafra" = 2026
  `;
  const restantes = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "PreSafra" WHERE "safraId" IS NULL
  `;
  const restam = Number(restantes[0]?.count ?? 0);

  console.log(`Safra "${nome}" (id ${safra.id}). ${atualizados} registro(s) apontado(s) para ela.`);
  if (restam > 0) {
    console.log(
      `ATENÇÃO: ${restam} registro(s) continuam sem safraId — não torne safraId obrigatório antes de revisar isso.`,
    );
  } else {
    console.log("Todo PreSafra tem safraId. Pode seguir para o corte final do schema.");
  }
}

main().finally(() => prisma.$disconnect());
