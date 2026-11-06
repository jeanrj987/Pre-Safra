import ExcelJS from "exceljs";
import { usuarioAtual } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { prisma } from "@/lib/db";
import { ITENS_FINALIZACAO } from "@/lib/finalizacao";
import { horaLocal, montarLinhasFinalizados, slugDaSafra } from "@/lib/exportarFinalizados";

// Planilha só com os Pré-Safras finalizados de uma safra (?safra=<id>). Inativos ficam de fora,
// mesmo configurados no sistema: a regra é a de calcularStatus em lib/status.ts.

export async function GET(request: Request) {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario, "safras")) return new Response(null, { status: 401 });

  const texto = new URL(request.url).searchParams.get("safra") ?? "";
  const safraId = /^\d{1,9}$/.test(texto) ? Number(texto) : null;
  if (safraId === null) return new Response("Safra inválida.", { status: 400 });

  const safra = await prisma.safra.findUnique({ where: { id: safraId }, select: { nome: true } });
  if (!safra) return new Response("Safra não encontrada.", { status: 404 });

  const registros = await prisma.preSafra.findMany({
    where: { safraId, configuradoSistema: true, inativo: false },
    select: {
      clienteNomeManual: true,
      responsavel: true,
      formato: true,
      dataPrevista: true,
      configuradoSistema: true,
      inativo: true,
      melhoriasApresentadas: true,
      sistemaAtualizado: true,
      safraFechada: true,
      safraNovaConfigurada: true,
      cliente: { select: { nome: true, cidade: true, uf: true, regiao: true, consultor: true } },
      conclusoes: {
        where: { reabertoEm: null },
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { observacao: true, autor: true, criadoEm: true, reabertoEm: true },
      },
    },
  });
  const linhas = montarLinhasFinalizados(registros);

  const planilha = new ExcelJS.Workbook();
  planilha.creator = "Pré-Safra";
  planilha.created = new Date();
  const aba = planilha.addWorksheet("Finalizados", { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = [
    { header: "Cliente", width: 44 },
    { header: "Cidade", width: 24 },
    { header: "UF", width: 6 },
    { header: "Região", width: 28 },
    { header: "Consultor", width: 20 },
    { header: "Responsável", width: 20 },
    { header: "Formato realizado", width: 18 },
    { header: "Data prevista", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Finalizado em", width: 17, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Atraso na conclusão (dias)", width: 26 },
    ...ITENS_FINALIZACAO.map((i) => ({ header: i.rotulo, width: 30 })),
    { header: "Observação da finalização", width: 50 },
    { header: "Finalizado por", width: 20 },
  ];
  for (const l of linhas) {
    aba.addRow([
      l.cliente,
      l.cidade,
      l.uf,
      l.regiao,
      l.consultor,
      l.responsavel,
      l.formato,
      l.dataPrevista,
      l.finalizadoEm ? horaLocal(l.finalizadoEm) : null,
      l.atrasoDias,
      ...l.itens,
      l.observacao,
      l.finalizadoPor,
    ]);
  }
  aba.getRow(1).font = { bold: true };
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.columnCount } };

  const hoje = horaLocal(new Date()).toISOString().slice(0, 10);
  const buffer = await planilha.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // O slug é só [a-z0-9-], então é seguro dentro das aspas do cabeçalho
      "Content-Disposition": `attachment; filename="pre-safras-finalizados-${slugDaSafra(safra.nome)}-${hoje}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
