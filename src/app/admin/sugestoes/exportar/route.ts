import { FUSO_NEGOCIO } from "@/lib/fuso";
import { usuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatarWhatsapp } from "@/lib/whatsapp";

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: FUSO_NEGOCIO,
});

// Aspas duplicadas dentro de campo entre aspas (RFC 4180). Também neutraliza fórmulas do Excel:
// texto digitado pelo público que começa com = + - @ viraria fórmula ao abrir o arquivo.
function celula(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario?.admin) return new Response(null, { status: 401 });

  const sugestoes = await prisma.sugestao.findMany({ orderBy: { id: "asc" } });
  const linhas = [
    ["Data", "Nome", "WhatsApp", "Assunto", "Sugestão", "Possível duplicada", "Parecida com", "Oculta"],
    ...sugestoes.map((s) => [
      dataHora.format(s.criadoEm),
      s.nome,
      formatarWhatsapp(s.whatsapp),
      s.topico,
      s.texto,
      s.possivelDuplicada ? "Sim" : "Não",
      s.faqParecida ?? "",
      s.oculta ? "Sim" : "Não",
    ]),
  ];

  // Ponto e vírgula e BOM: é o que o Excel em português espera para abrir com acentos certos
  const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sugestoes-faq.csv"',
      "Cache-Control": "no-store",
    },
  });
}
