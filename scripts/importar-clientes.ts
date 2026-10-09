// Uso: npm run importar -- [caminho.xlsx] [nomeDaSafra] [--simular] [--criar | --criar=<nome> ...]
// A planilha precisa de uma coluna "Cliente" e, opcionalmente, "Cidade", "UF", "Região",
// "Atendente", "Consultor" e "Comercial" (sem a coluna, o comercial já cadastrado não muda).
// Reexecutável: não duplica clientes nem registros de Pré-Safra; só atualiza os dados de cadastro.
// Com --simular, mostra o que seria feito sem gravar nada.
// Clientes que estão na planilha e não no banco só são criados com --criar (todos) ou com
// --criar=<nome> (só os citados; repita a opção para vários). Evita duplicar um cliente
// renomeado ou cadastrar linhas de teste por engano.
import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const criarTodos = args.includes("--criar");
const criarNomes = new Set(args.filter((a) => a.startsWith("--criar=")).map((a) => a.slice(8)));
const deveCriar = (nome: string) => criarTodos || criarNomes.has(nome);
const posicionais = args.filter((a) => !a.startsWith("--"));
const arquivo = posicionais[0] ?? "Planilhas/Clientes.xlsx";
const nomeSafra = posicionais[1] ?? "Safra 2026";

const chave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function texto(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("result" in v) return String(v.result ?? "").trim();
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    if ("text" in v) return String(v.text ?? "").trim();
  }
  return String(v).trim();
}

// "01 - Sorriso e Região" vira "Sorriso e Região". Mais de uma região na mesma célula
// ("A / B") é cadastro ambíguo: fica sem região para ser corrigido na planilha.
function limparRegiao(bruto: string): { regiao: string | null; ambigua: boolean } {
  if (!bruto) return { regiao: null, ambigua: false };
  if (bruto.includes(" / ")) return { regiao: null, ambigua: true };
  return { regiao: bruto.replace(/^\d+\s*-\s*/, "").trim() || null, ambigua: false };
}

interface Linha {
  nome: string;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  atendente: string | null;
  consultor: string | null;
  comercial: string | null | undefined;
  ambigua: boolean;
}

async function lerPlanilha(): Promise<Linha[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.worksheets[0];

  const colunas = new Map<string, number>();
  ws.getRow(1).eachCell((cell, n) => colunas.set(chave(texto(cell.value)), n));
  const colNome = colunas.get("cliente") ?? 2;
  const colCidade = colunas.get("cidade");
  const colUf = colunas.get("uf");
  const colRegiao = colunas.get("regiao");
  const colAtendente = colunas.get("atendente");
  const colConsultor = colunas.get("consultor");
  const colComercial = colunas.get("comercial");

  const linhas = new Map<string, Linha>();
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const nome = texto(row.getCell(colNome).value).toLocaleUpperCase("pt-BR").replace(/\s+/g, " ");
    if (!nome) return;
    const { regiao, ambigua } = limparRegiao(colRegiao ? texto(row.getCell(colRegiao).value) : "");
    // Sem região confiável, o atendente também não é confiável (pode ser a soma de duas duplas).
    const atendente = ambigua
      ? null
      : colAtendente
        ? texto(row.getCell(colAtendente).value) || null
        : null;
    const cidade = colCidade ? texto(row.getCell(colCidade).value) || null : null;
    const uf = colUf ? texto(row.getCell(colUf).value).toUpperCase() || null : null;
    const consultor = colConsultor ? texto(row.getCell(colConsultor).value) || null : null;
    const comercial = colComercial ? texto(row.getCell(colComercial).value) || null : undefined;
    linhas.set(nome, { nome, cidade, uf, regiao, atendente, consultor, comercial, ambigua });
  });
  return [...linhas.values()];
}

async function main() {
  const linhas = await lerPlanilha();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const safra = await prisma.safra.findUnique({ where: { nome: nomeSafra } });
  if (!safra) {
    console.error(`Safra "${nomeSafra}" não encontrada. Crie-a antes em /admin/safras.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const existentes = await prisma.cliente.findMany({
    select: {
      id: true,
      nome: true,
      cidade: true,
      uf: true,
      regiao: true,
      atendente: true,
      consultor: true,
      comercial: true,
    },
  });
  const porNome = new Map(existentes.map((c) => [c.nome, c]));
  const nomesPlanilha = new Set(linhas.map((l) => l.nome));

  const novos = linhas.filter((l) => !porNome.has(l.nome));
  const ausentes = existentes.filter((c) => !nomesPlanilha.has(c.nome));
  const mudam = linhas.filter((l) => {
    const c = porNome.get(l.nome);
    return (
      c &&
      (c.cidade !== l.cidade ||
        c.uf !== l.uf ||
        c.regiao !== l.regiao ||
        c.atendente !== l.atendente ||
        c.consultor !== l.consultor ||
        (l.comercial !== undefined && c.comercial !== l.comercial))
    );
  });
  const semRegiao = linhas.filter((l) => !l.regiao);

  // Nomes que só diferem por acento, caixa ou espaços: provável renomeação, não cliente novo.
  const existentesPorChave = new Map(ausentes.map((c) => [chave(c.nome), c.nome]));
  const parecidos = novos
    .filter((l) => existentesPorChave.has(chave(l.nome)))
    .map((l) => `"${l.nome}" ~ "${existentesPorChave.get(chave(l.nome))}"`);

  const porRegiao = new Map<string, number>();
  linhas.forEach((l) => porRegiao.set(l.regiao ?? "(sem região)", (porRegiao.get(l.regiao ?? "(sem região)") ?? 0) + 1));

  console.log(`${simular ? "[SIMULAÇÃO] " : ""}${linhas.length} clientes na planilha (${arquivo}).`);
  console.log("Por região:", Object.fromEntries(porRegiao));
  console.log(`${simular ? "Seriam atualizados" : "Serão atualizados"} (cidade/UF/região/atendente/consultor/comercial): ${mudam.length} cliente(s) já cadastrados.`);
  console.log(
    `Na planilha e fora do banco: ${novos.length} (serão criados: ${novos.filter((l) => deveCriar(l.nome)).length}; use --criar ou --criar=<nome> para criar)`,
    novos.map((l) => `${deveCriar(l.nome) ? "[criar] " : ""}${l.nome}`),
  );
  console.log(`No banco e fora da planilha (não serão alterados): ${ausentes.length}`, ausentes.map((c) => c.nome));
  if (parecidos.length) console.log("Possíveis renomeações (verifique antes de importar):", parecidos);
  if (semRegiao.length) {
    console.log(
      `Sem região (${semRegiao.length}):`,
      semRegiao.map((l) => `${l.nome}${l.ambigua ? " [duas regiões na planilha]" : ""}`),
    );
  }

  if (simular) {
    console.log("Nada foi gravado.");
    await prisma.$disconnect();
    return;
  }

  // Um updateMany por combinação de cidade/UF/região/atendente/consultor/comercial, em vez de
  // um update por cliente.
  type Dados = Pick<Linha, "cidade" | "uf" | "regiao" | "atendente" | "consultor" | "comercial">;
  const grupos = new Map<string, Dados & { nomes: string[] }>();
  for (const l of mudam) {
    const k = `${l.cidade}|${l.uf}|${l.regiao}|${l.atendente}|${l.consultor}|${l.comercial}`;
    const g = grupos.get(k) ?? {
      cidade: l.cidade,
      uf: l.uf,
      regiao: l.regiao,
      atendente: l.atendente,
      consultor: l.consultor,
      comercial: l.comercial,
      nomes: [],
    };
    g.nomes.push(l.nome);
    grupos.set(k, g);
  }
  for (const { nomes, ...dados } of grupos.values()) {
    await prisma.cliente.updateMany({ where: { nome: { in: nomes } }, data: dados });
  }

  const aCriar = novos.filter((l) => deveCriar(l.nome));
  if (aCriar.length) {
    await prisma.cliente.createMany({
      data: aCriar.map((l) => ({
        nome: l.nome,
        cidade: l.cidade,
        uf: l.uf,
        regiao: l.regiao,
        atendente: l.atendente,
        consultor: l.consultor,
        comercial: l.comercial,
      })),
      skipDuplicates: true,
    });
  }

  const clientes = await prisma.cliente.findMany({ select: { id: true } });
  const { count } = await prisma.preSafra.createMany({
    data: clientes.map((c) => ({ clienteId: c.id, safraId: safra.id })),
    skipDuplicates: true,
  });

  console.log(
    `${mudam.length} cliente(s) atualizado(s); ${aCriar.length} criado(s); ${count} registro(s) de Pré-Safra "${safra.nome}" criado(s).`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
