import ExcelJS from "exceljs";
import { usuarioAtual } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { prisma } from "@/lib/db";
import { FUSO_NEGOCIO } from "@/lib/fuso";

// Clientes cadastrados em planilha, com as mesmas colunas da planilha modelo de importação:
// dá para corrigir os dados no Excel e enviar o arquivo de volta em "Importar planilha".

const dataLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_NEGOCIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario, "clientes")) return new Response(null, { status: 401 });

  const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });

  const planilha = new ExcelJS.Workbook();
  planilha.creator = "Pré-Safra";
  planilha.created = new Date();
  const aba = planilha.addWorksheet("Clientes", { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = [
    { header: "Cliente", width: 44 },
    { header: "Cidade", width: 24 },
    { header: "UF", width: 6 },
    { header: "Região", width: 28 },
    { header: "Atendente", width: 20 },
    { header: "Consultor", width: 20 },
    { header: "Comercial", width: 20 },
  ];
  for (const c of clientes) {
    aba.addRow([c.nome, c.cidade, c.uf, c.regiao, c.atendente, c.consultor, c.comercial]);
  }
  aba.getRow(1).font = { bold: true };
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };

  const buffer = await planilha.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="clientes-presafra-${dataLocal.format(new Date())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
