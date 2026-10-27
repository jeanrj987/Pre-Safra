// Tira agora a foto diária do estado dos Pré-Safras (a mesma que o cron da Vercel tira todo dia):
// alimenta o relatório "Evolução". Pode ser repetido: refaz a foto do dia.
// Uso: npm run foto:diaria
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { registrarFotos } from "../src/lib/fotos";

async function main() {
  let host = "(desconhecido)";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {}
  console.log(`Banco: ${host}`);

  const { dia, total } = await registrarFotos();
  console.log(`Foto de ${new Date(dia).toISOString().slice(0, 10)} gravada: ${total} Pré-Safras.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
