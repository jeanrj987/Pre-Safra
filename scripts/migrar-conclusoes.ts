// Migra as observações de conclusão do formato antigo (um campo em PreSafra) para o histórico
// (tabela Conclusao). Rode uma vez, depois do `npm run db:push`: `npm run migrar-conclusoes`.
// É seguro repetir: só cria entradas para clientes que ainda não têm nenhuma.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const registros = await prisma.preSafra.findMany({
    where: {
      conclusoes: { none: {} },
      OR: [{ configuradoSistema: true }, { observacaoConclusao: { not: null } }],
    },
    select: {
      id: true,
      configuradoSistema: true,
      observacaoConclusao: true,
      atualizadoEm: true,
    },
  });

  const { count } = await prisma.conclusao.createMany({
    data: registros.map((r) => ({
      preSafraId: r.id,
      observacao: r.observacaoConclusao?.trim() || null,
      autor: null,
      criadoEm: r.atualizadoEm,
      // Cliente reaberto que ainda guardava uma observação antiga: entrada já encerrada.
      ...(!r.configuradoSistema && { reabertoEm: r.atualizadoEm }),
    })),
  });
  console.log(`${count} entrada(s) de histórico criada(s).`);
}

main().finally(() => prisma.$disconnect());
