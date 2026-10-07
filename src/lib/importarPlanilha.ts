import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";

// Mesma lógica de leitura do scripts/importar-clientes.ts, adaptada para rodar a partir de um
// arquivo enviado pelo navegador (ArrayBuffer) em vez de um caminho no disco.

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

interface LinhaPlanilha {
  nome: string;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  atendente: string | null;
  consultor: string | null;
  // undefined = a planilha não tem a coluna "Comercial": o valor já cadastrado não é alterado
  comercial: string | null | undefined;
}

// Lançado quando a planilha em si é inválida (não quando uma linha isolada tem problema) —
// a importação inteira é recusada em vez de adivinhar uma coluna errada.
export class ErroPlanilhaInvalida extends Error {}

// Nome que é só número (com ou sem separador decimal/milhar): sinal de que a coluna lida não
// é realmente a de nomes de cliente, então a linha é ignorada em vez de virar um cadastro.
function somenteNumeros(s: string): boolean {
  return /\d/.test(s) && /^[\d\s.,-]+$/.test(s);
}

interface LeituraPlanilha {
  linhas: LinhaPlanilha[];
  linhasIgnoradas: number;
}

async function lerLinhas(buffer: ArrayBuffer): Promise<LeituraPlanilha> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new ErroPlanilhaInvalida("A planilha está vazia.");

  const colunas = new Map<string, number>();
  ws.getRow(1).eachCell((cell, n) => colunas.set(chave(texto(cell.value)), n));
  const colNome = colunas.get("cliente");
  if (colNome === undefined) {
    throw new ErroPlanilhaInvalida('A planilha precisa de uma coluna chamada "Cliente" no cabeçalho.');
  }
  const colCidade = colunas.get("cidade");
  const colUf = colunas.get("uf");
  const colRegiao = colunas.get("regiao");
  const colAtendente = colunas.get("atendente");
  const colConsultor = colunas.get("consultor");
  const colComercial = colunas.get("comercial");

  const linhas = new Map<string, LinhaPlanilha>();
  let linhasIgnoradas = 0;
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const nome = texto(row.getCell(colNome).value);
    if (!nome) return;
    // Nome só com números não é um cliente de verdade — provável planilha fora do formato.
    if (somenteNumeros(nome)) {
      linhasIgnoradas++;
      return;
    }
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
    linhas.set(nome, { nome, cidade, uf, regiao, atendente, consultor, comercial });
  });
  return { linhas: [...linhas.values()], linhasIgnoradas };
}

export interface ResultadoImportacao {
  linhasNaPlanilha: number;
  linhasIgnoradas: number;
  clientesCriados: number;
  clientesAtualizados: number;
  presafrasCriados: number;
}

// Cria clientes novos, atualiza região/atendente dos já cadastrados e garante um Pré-Safra
// na safra informada para todo cliente da planilha. Reexecutável: não duplica nada.
export async function importarClientesDaPlanilha(
  buffer: ArrayBuffer,
  safraId: number,
): Promise<ResultadoImportacao> {
  const { linhas, linhasIgnoradas } = await lerLinhas(buffer);
  if (linhas.length === 0) {
    throw new ErroPlanilhaInvalida("Nenhum nome de cliente válido foi encontrado na planilha.");
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

  const novos = linhas.filter((l) => !porNome.has(l.nome));
  if (novos.length) {
    await prisma.cliente.createMany({
      data: novos.map((l) => ({
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
  // Um updateMany por combinação de cidade/UF/região/atendente/consultor/comercial, em vez de
  // um update por cliente.
  type Dados = Pick<LinhaPlanilha, "cidade" | "uf" | "regiao" | "atendente" | "consultor" | "comercial">;
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

  const clientesDaPlanilha = await prisma.cliente.findMany({
    where: { nome: { in: linhas.map((l) => l.nome) } },
    select: { id: true },
  });
  const { count: presafrasCriados } = await prisma.preSafra.createMany({
    data: clientesDaPlanilha.map((c) => ({ clienteId: c.id, safraId })),
    skipDuplicates: true,
  });

  return {
    linhasNaPlanilha: linhas.length,
    linhasIgnoradas,
    clientesCriados: novos.length,
    clientesAtualizados: mudam.length,
    presafrasCriados,
  };
}
