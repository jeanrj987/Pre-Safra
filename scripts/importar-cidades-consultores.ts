// Uso: npm run importar:cidades -- [caminho.xlsx] [--simular]
// Lê a planilha "Consultor vs Clientes" (aba "Clientes vs Consultor") e preenche, nos clientes já
// cadastrados, só Cidade, UF e Consultor. Não mexe em região, atendente nem cria clientes; com
// isso as listas de cidade/UF/consultor do cadastro passam a refletir a planilha.
// A planilha traz o cliente em "Fantasia" (igual ao nome no sistema) e a cidade como "Sorriso - MT".
// Reexecutável. Com --simular, mostra o que seria feito sem gravar nada.
import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const simular = args.includes("--simular");
const arquivo = args.find((a) => !a.startsWith("--")) ?? "Planilhas/Consultor vs Clientes (1).xlsx";

const chave = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
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

const UF_POR_ESTADO: Record<string, string> = {
  acre: "AC", bahia: "BA", goias: "GO", "minas gerais": "MG", "mato grosso": "MT",
  para: "PA", rondonia: "RO", roraima: "RR", tocantins: "TO",
};

// Correções de digitação na planilha que o texto da própria linha não permite deduzir.
// "Boa Vista PR" é Boa Vista (RR): o Estado da linha é Roraima.
const UF_CORRIGIDA: Record<string, string> = { "boa vista": "RR" };

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
function nomeProprio(s: string): string {
  return s
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

// "Sorriso - MT" / "Uruaçú GO" / "GOIATUBA  GO" / "Guarda Mor" (sem UF: usa o Estado da linha).
function separarCidade(bruto: string, estado: string): { cidade: string; uf: string | null; aviso?: string } {
  const m = bruto.match(/^(.*?)(?:\s*-\s*|\s+)([A-Za-z]{2})$/);
  const cidade = nomeProprio((m ? m[1] : bruto).replace(/\s+/g, " ").trim());
  const ufEstado = UF_POR_ESTADO[chave(estado)] ?? null;
  const ufTexto = m ? m[2].toUpperCase() : null;
  const corrigida = UF_CORRIGIDA[chave(cidade)];
  const uf = corrigida ?? ufTexto ?? ufEstado;
  const aviso = uf && ufEstado && uf !== ufEstado ? `UF "${uf}" no texto, Estado "${estado}" (${ufEstado})` : undefined;
  return { cidade, uf, aviso };
}

// "01 - Cledinei" vira "Cledinei"; "Andre" vira "André", como já está cadastrado no sistema.
const NOMES_CONSULTOR: Record<string, string> = { andre: "André" };
function limparConsultor(bruto: string): string | null {
  const nome = bruto.replace(/^\d+\s*-\s*/, "").trim();
  return nome ? (NOMES_CONSULTOR[chave(nome)] ?? nome) : null;
}

interface Linha {
  nome: string;
  razao: string;
  cidade: string;
  uf: string | null;
  consultor: string | null;
  aviso?: string;
}

async function lerPlanilha(): Promise<Linha[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.worksheets[0];
  const colunas = new Map<string, number>();
  ws.getRow(1).eachCell((cell, n) => colunas.set(chave(texto(cell.value)), n));
  const col = (nome: string) => {
    const n = colunas.get(nome);
    if (n === undefined) throw new Error(`Coluna "${nome}" não encontrada na aba "${ws.name}".`);
    return n;
  };
  const [cRazao, cFantasia, cCidade, cEstado, cConsultor] = [
    col("razao social"), col("fantasia"), col("cidade"), col("estado"), col("consultor novo"),
  ];

  const linhas: Linha[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const nome = texto(row.getCell(cFantasia).value);
    const cidadeBruta = texto(row.getCell(cCidade).value);
    if (!nome || !cidadeBruta) return;
    const { cidade, uf, aviso } = separarCidade(cidadeBruta, texto(row.getCell(cEstado).value));
    linhas.push({
      nome,
      razao: texto(row.getCell(cRazao).value),
      cidade,
      uf,
      consultor: limparConsultor(texto(row.getCell(cConsultor).value)),
      aviso,
    });
  });
  return linhas;
}

// "Grupo Beija Flor" aparece duas vezes na planilha (razões sociais diferentes) e no sistema como
// dois clientes com sufixo ("Grupo Beija Flor - California"); o sufixo do sistema aparece
// dentro da razão social da planilha.
function nomeNoSistema(l: Linha, nomesBanco: Map<string, string>, repetidos: Set<string>): string | undefined {
  if (!repetidos.has(chave(l.nome))) return nomesBanco.get(chave(l.nome));
  const prefixo = `${chave(l.nome)} - `;
  return [...nomesBanco.entries()].find(
    ([k]) => k.startsWith(prefixo) && chave(l.razao).includes(k.slice(prefixo.length)),
  )?.[1];
}

async function main() {
  const linhas = await lerPlanilha();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, cidade: true, uf: true, consultor: true },
  });
  const nomesBanco = new Map(clientes.map((c) => [chave(c.nome), c.nome]));
  const porNome = new Map(clientes.map((c) => [c.nome, c]));
  const contagem = new Map<string, number>();
  linhas.forEach((l) => contagem.set(chave(l.nome), (contagem.get(chave(l.nome)) ?? 0) + 1));
  const repetidos = new Set([...contagem].filter(([, n]) => n > 1).map(([k]) => k));

  const semCliente: string[] = [];
  const alvos = new Map<string, Linha>();
  for (const l of linhas) {
    const nome = nomeNoSistema(l, nomesBanco, repetidos);
    if (nome) alvos.set(nome, l);
    else semCliente.push(`${l.nome} (${l.razao})`);
  }
  const mudam = [...alvos].filter(([nome, l]) => {
    const c = porNome.get(nome)!;
    return c.cidade !== l.cidade || c.uf !== l.uf || c.consultor !== l.consultor;
  });
  const foraDaPlanilha = clientes.filter((c) => !alvos.has(c.nome)).map((c) => c.nome);
  const cidades = new Set([...alvos.values()].map((l) => `${l.cidade} - ${l.uf}`));

  console.log(`${simular ? "[SIMULAÇÃO] " : ""}${linhas.length} linhas na planilha (${arquivo}).`);
  console.log(`${alvos.size} casam com clientes do sistema; ${mudam.length} serão alterados; ${cidades.size} cidades distintas.`);
  console.log("Consultores:", Object.fromEntries(
    [...alvos.values()].reduce((m, l) => m.set(l.consultor ?? "(nenhum)", (m.get(l.consultor ?? "(nenhum)") ?? 0) + 1), new Map<string, number>()),
  ));
  console.log("Cidades:", [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR")).join(" | "));
  const avisos = [...alvos].filter(([, l]) => l.aviso);
  if (avisos.length) console.log("Avisos (UF x Estado divergem):", avisos.map(([n, l]) => `${n}: ${l.cidade} - ${l.aviso}`));
  if (semCliente.length) console.log(`Na planilha e sem cliente no sistema (ignorados): ${semCliente.length}`, semCliente);
  console.log(`No sistema e fora da planilha (não alterados): ${foraDaPlanilha.length}`, foraDaPlanilha);

  if (simular) {
    console.log("Nada foi gravado.");
    await prisma.$disconnect();
    return;
  }

  const grupos = new Map<string, { cidade: string; uf: string | null; consultor: string | null; nomes: string[] }>();
  for (const [nome, l] of mudam) {
    const k = `${l.cidade}|${l.uf}|${l.consultor}`;
    const g = grupos.get(k) ?? { cidade: l.cidade, uf: l.uf, consultor: l.consultor, nomes: [] };
    g.nomes.push(nome);
    grupos.set(k, g);
  }
  for (const { nomes, ...dados } of grupos.values()) {
    await prisma.cliente.updateMany({ where: { nome: { in: nomes } }, data: dados });
  }
  console.log(`${mudam.length} cliente(s) atualizado(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
