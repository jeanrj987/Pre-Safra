// Uso: npm run importar:gifnoc -- <plano.json> [nomeDaSafra] [--simular]
// Cria os clientes do plano (lista de { nome, uf, consultor, regiao, atendente }) que ainda não
// existem no banco e o registro de Pré-Safra de cada um na safra. Não altera clientes já cadastrados.
// Reexecutável: ignora nomes que já existem (sem diferenciar acento ou caixa).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const posicionais = args.filter((a) => !a.startsWith("--"));
const arquivo = posicionais[0];
const nomeSafra = posicionais[1] ?? "Soja 26/27";
if (!arquivo) {
  console.error("Informe o caminho do plano.json.");
  process.exit(1);
}

const chave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

interface Item {
  nome: string;
  uf: string | null;
  consultor: string | null;
  regiao: string | null;
  atendente: string | null;
}

async function main() {
  const plano: Item[] = JSON.parse(readFileSync(arquivo, "utf8"));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const safra = await prisma.safra.findUnique({ where: { nome: nomeSafra } });
  if (!safra) {
    console.error(`Safra "${nomeSafra}" não encontrada.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const existentes = new Set((await prisma.cliente.findMany({ select: { nome: true } })).map((c) => chave(c.nome)));
  const aCriar = plano.filter((i) => !existentes.has(chave(i.nome)));
  console.log(`${simular ? "[SIMULAÇÃO] " : ""}${plano.length} no plano; ${aCriar.length} serão criados; ${plano.length - aCriar.length} já existem.`);

  if (!simular && aCriar.length) {
    const { count } = await prisma.cliente.createMany({
      data: aCriar.map((i) => ({
        nome: i.nome,
        uf: i.uf,
        consultor: i.consultor,
        regiao: i.regiao,
        atendente: i.atendente,
      })),
      skipDuplicates: true,
    });
    const novos = await prisma.cliente.findMany({
      where: { nome: { in: aCriar.map((i) => i.nome) } },
      select: { id: true },
    });
    const { count: pre } = await prisma.preSafra.createMany({
      data: novos.map((c) => ({ clienteId: c.id, safraId: safra.id })),
      skipDuplicates: true,
    });
    console.log(`${count} cliente(s) criado(s); ${pre} registro(s) de Pré-Safra "${safra.nome}" criado(s).`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
