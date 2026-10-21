import ExcelJS from "exceljs";
import { usuarioAtual } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { prisma } from "@/lib/db";
import { FUSO_NEGOCIO } from "@/lib/fuso";
import { rotuloMotivoPendencia } from "@/lib/pendencia";
import { rotuloDoTipo } from "@/lib/sugestoes";

// Backup em planilha: uma aba por tabela do banco, para consultar ou montar gráficos no Excel.
// Fica de fora, de propósito: senhaHash dos usuários e o WhatsApp de quem enviou sugestão.

type Valor = string | number | Date | null;
type Formato = "texto" | "numero" | "data" | "dataHora";
interface Coluna<T> {
  cabecalho: string;
  valor: (linha: T) => Valor;
  formato?: Formato;
  largura?: number;
}

const FORMATO_EXCEL: Partial<Record<Formato, string>> = {
  data: "dd/mm/yyyy",
  dataHora: "dd/mm/yyyy hh:mm",
};

const partesLocais = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_NEGOCIO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// O Excel não guarda fuso: grava-se a hora de parede de Mato Grosso como se fosse UTC, para a
// célula mostrar o mesmo horário que a equipe vê no sistema.
function horaLocal(data: Date): Date {
  const p = Object.fromEntries(partesLocais.formatToParts(data).map((x) => [x.type, Number(x.value)]));
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
}

const sim = (v: boolean) => (v ? "Sim" : "Não");

function adicionarAba<T>(planilha: ExcelJS.Workbook, nome: string, colunas: Coluna<T>[], linhas: T[]) {
  const aba = planilha.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = colunas.map((c) => ({
    header: c.cabecalho,
    width: c.largura ?? (c.formato === "dataHora" ? 17 : c.formato === "data" ? 12 : 18),
    style: FORMATO_EXCEL[c.formato ?? "texto"] ? { numFmt: FORMATO_EXCEL[c.formato ?? "texto"] } : {},
  }));
  for (const linha of linhas) {
    aba.addRow(
      colunas.map((c) => {
        const v = c.valor(linha);
        return c.formato === "dataHora" && v instanceof Date ? horaLocal(v) : v;
      }),
    );
  }
  const cabecalho = aba.getRow(1);
  cabecalho.font = { bold: true };
  cabecalho.alignment = { vertical: "middle" };
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  return linhas.length;
}

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario, "backup")) return new Response(null, { status: 401 });

  const [clientes, safras, preSafras, conclusoes, notificacoes, atividades, sugestoes, usuarios, configuracoes] =
    await Promise.all([
      prisma.cliente.findMany({ orderBy: { id: "asc" } }),
      prisma.safra.findMany({ orderBy: { id: "asc" } }),
      prisma.preSafra.findMany({
        orderBy: { id: "asc" },
        include: { cliente: { select: { nome: true } }, safra: { select: { nome: true } } },
      }),
      prisma.conclusao.findMany({
        orderBy: { id: "asc" },
        include: { preSafra: { select: { cliente: { select: { nome: true } }, clienteNomeManual: true, safra: { select: { nome: true } } } } },
      }),
      prisma.notificacao.findMany({
        orderBy: { id: "asc" },
        include: { preSafra: { select: { cliente: { select: { nome: true } }, clienteNomeManual: true } } },
      }),
      prisma.atividade.findMany({ orderBy: { id: "asc" } }),
      prisma.sugestao.findMany({ orderBy: { id: "asc" } }),
      prisma.usuario.findMany({ orderBy: { id: "asc" } }),
      prisma.configuracao.findMany({ orderBy: { chave: "asc" } }),
    ]);

  const planilha = new ExcelJS.Workbook();
  planilha.creator = "Pré-Safra";
  planilha.created = new Date();
  // Criada antes das outras para ser a primeira aba; preenchida no fim, quando as contagens existem
  const leiaMe = planilha.addWorksheet("Leia-me", { properties: { tabColor: { argb: "FF888888" } } });

  const contagens: [string, number][] = [];
  const registrar = (nome: string, total: number) => contagens.push([nome, total]);

  registrar(
    "Clientes",
    adicionarAba(
      planilha,
      "Clientes",
      [
        { cabecalho: "ID", valor: (c) => c.id, formato: "numero", largura: 8 },
        { cabecalho: "Nome", valor: (c) => c.nome, largura: 40 },
        { cabecalho: "Cidade", valor: (c) => c.cidade },
        { cabecalho: "UF", valor: (c) => c.uf, largura: 6 },
        { cabecalho: "Região", valor: (c) => c.regiao, largura: 26 },
        { cabecalho: "Consultor", valor: (c) => c.consultor },
        { cabecalho: "Atendente", valor: (c) => c.atendente },
        { cabecalho: "Comercial", valor: (c) => c.comercial },
        { cabecalho: "Gerente", valor: (c) => c.gerente },
        { cabecalho: "WhatsApp", valor: (c) => c.whatsapp, largura: 16 },
        { cabecalho: "E-mail", valor: (c) => c.email, largura: 30 },
        { cabecalho: "Criado em", valor: (c) => c.criadoEm, formato: "dataHora" },
        { cabecalho: "Atualizado em", valor: (c) => c.atualizadoEm, formato: "dataHora" },
      ],
      clientes,
    ),
  );

  registrar(
    "Safras",
    adicionarAba(
      planilha,
      "Safras",
      [
        { cabecalho: "ID", valor: (s) => s.id, formato: "numero", largura: 8 },
        { cabecalho: "Nome", valor: (s) => s.nome, largura: 24 },
        { cabecalho: "Cultura", valor: (s) => s.cultura },
        { cabecalho: "Início", valor: (s) => s.inicio, formato: "data" },
        { cabecalho: "Prazo", valor: (s) => s.prazo, formato: "data" },
        { cabecalho: "Ativa", valor: (s) => sim(s.ativa), largura: 8 },
        { cabecalho: "Criado em", valor: (s) => s.criadoEm, formato: "dataHora" },
        { cabecalho: "Atualizado em", valor: (s) => s.atualizadoEm, formato: "dataHora" },
      ],
      safras,
    ),
  );

  registrar(
    "Pré-Safras",
    adicionarAba(
      planilha,
      "Pré-Safras",
      [
        { cabecalho: "ID", valor: (p) => p.id, formato: "numero", largura: 8 },
        { cabecalho: "Cliente ID", valor: (p) => p.clienteId, formato: "numero", largura: 11 },
        { cabecalho: "Cliente", valor: (p) => p.cliente?.nome ?? p.clienteNomeManual, largura: 40 },
        { cabecalho: "Safra ID", valor: (p) => p.safraId, formato: "numero", largura: 10 },
        { cabecalho: "Safra", valor: (p) => p.safra.nome, largura: 24 },
        { cabecalho: "Responsável", valor: (p) => p.responsavel },
        { cabecalho: "Data prevista", valor: (p) => p.dataPrevista, formato: "data", largura: 14 },
        { cabecalho: "Horário", valor: (p) => p.horario, largura: 9 },
        { cabecalho: "Formato", valor: (p) => p.formato, largura: 12 },
        { cabecalho: "Configurado no sistema", valor: (p) => sim(p.configuradoSistema), largura: 22 },
        { cabecalho: "Melhorias apresentadas", valor: (p) => sim(p.melhoriasApresentadas), largura: 22 },
        { cabecalho: "Agendado por", valor: (p) => p.agendadoPor },
        { cabecalho: "Agendado em", valor: (p) => p.agendadoEm, formato: "dataHora" },
        { cabecalho: "Inativo", valor: (p) => sim(p.inativo), largura: 9 },
        { cabecalho: "Motivo da inativação", valor: (p) => p.motivoInativacao, largura: 30 },
        { cabecalho: "Observações", valor: (p) => p.observacoes, largura: 40 },
        {
          cabecalho: "Motivo da pendência",
          valor: (p) => (p.motivoPendencia ? rotuloMotivoPendencia(p.motivoPendencia) : null),
          largura: 24,
        },
        { cabecalho: "Observação da pendência", valor: (p) => p.observacaoPendencia, largura: 30 },
        { cabecalho: "Criado em", valor: (p) => p.criadoEm, formato: "dataHora" },
        { cabecalho: "Atualizado em", valor: (p) => p.atualizadoEm, formato: "dataHora" },
        { cabecalho: "Atualizado por", valor: (p) => p.atualizadoPor },
      ],
      preSafras,
    ),
  );

  registrar(
    "Conclusões",
    adicionarAba(
      planilha,
      "Conclusões",
      [
        { cabecalho: "ID", valor: (c) => c.id, formato: "numero", largura: 8 },
        { cabecalho: "Pré-Safra ID", valor: (c) => c.preSafraId, formato: "numero", largura: 13 },
        {
          cabecalho: "Cliente",
          valor: (c) => c.preSafra.cliente?.nome ?? c.preSafra.clienteNomeManual,
          largura: 40,
        },
        { cabecalho: "Safra", valor: (c) => c.preSafra.safra.nome, largura: 24 },
        { cabecalho: "Observação", valor: (c) => c.observacao, largura: 50 },
        { cabecalho: "Autor", valor: (c) => c.autor },
        { cabecalho: "Finalizado em", valor: (c) => c.criadoEm, formato: "dataHora" },
        { cabecalho: "Reaberto em", valor: (c) => c.reabertoEm, formato: "dataHora" },
        { cabecalho: "Reaberto por", valor: (c) => c.reabertoPor },
        { cabecalho: "Motivo da reabertura", valor: (c) => c.motivoReabertura, largura: 40 },
      ],
      conclusoes,
    ),
  );

  registrar(
    "Notificações",
    adicionarAba(
      planilha,
      "Notificações",
      [
        { cabecalho: "ID", valor: (n) => n.id, formato: "numero", largura: 8 },
        { cabecalho: "Pré-Safra ID", valor: (n) => n.preSafraId, formato: "numero", largura: 13 },
        { cabecalho: "Cliente", valor: (n) => n.preSafra.cliente?.nome ?? n.preSafra.clienteNomeManual, largura: 40 },
        { cabecalho: "Canal", valor: (n) => n.canal, largura: 11 },
        { cabecalho: "Evento", valor: (n) => n.evento, largura: 16 },
        { cabecalho: "Destino", valor: (n) => n.destino, largura: 28 },
        { cabecalho: "Enviado", valor: (n) => sim(n.ok), largura: 10 },
        { cabecalho: "Erro", valor: (n) => n.erro, largura: 36 },
        { cabecalho: "Autor", valor: (n) => n.autor },
        { cabecalho: "Data", valor: (n) => n.criadoEm, formato: "dataHora" },
      ],
      notificacoes,
    ),
  );

  registrar(
    "Atividades",
    adicionarAba(
      planilha,
      "Atividades",
      [
        { cabecalho: "ID", valor: (a) => a.id, formato: "numero", largura: 8 },
        { cabecalho: "Título", valor: (a) => a.titulo, largura: 36 },
        { cabecalho: "Descrição", valor: (a) => a.descricao, largura: 50 },
        { cabecalho: "Data", valor: (a) => a.data, formato: "data" },
        { cabecalho: "Horário", valor: (a) => a.horario, largura: 9 },
        { cabecalho: "Concluída", valor: (a) => sim(a.concluida), largura: 11 },
        { cabecalho: "Criada por", valor: (a) => a.criadoPor },
        { cabecalho: "Criado em", valor: (a) => a.criadoEm, formato: "dataHora" },
        { cabecalho: "Atualizado em", valor: (a) => a.atualizadoEm, formato: "dataHora" },
      ],
      atividades,
    ),
  );

  registrar(
    "Sugestões",
    adicionarAba(
      planilha,
      "Sugestões",
      [
        { cabecalho: "ID", valor: (s) => s.id, formato: "numero", largura: 8 },
        { cabecalho: "Data", valor: (s) => s.criadoEm, formato: "dataHora" },
        { cabecalho: "Tipo", valor: (s) => rotuloDoTipo(s.tipo), largura: 16 },
        { cabecalho: "Nome", valor: (s) => s.nome },
        { cabecalho: "Assunto", valor: (s) => s.topico, largura: 24 },
        { cabecalho: "Sugestão", valor: (s) => s.texto, largura: 60 },
        { cabecalho: "Possível duplicada", valor: (s) => sim(s.possivelDuplicada), largura: 19 },
        { cabecalho: "Parecida com", valor: (s) => s.faqParecida, largura: 40 },
        { cabecalho: "Oculta", valor: (s) => sim(s.oculta), largura: 9 },
      ],
      sugestoes,
    ),
  );

  registrar(
    "Usuários",
    adicionarAba(
      planilha,
      "Usuários",
      [
        { cabecalho: "ID", valor: (u) => u.id, formato: "numero", largura: 8 },
        { cabecalho: "Nome", valor: (u) => u.nome, largura: 28 },
        { cabecalho: "E-mail", valor: (u) => u.email, largura: 32 },
        { cabecalho: "Admin", valor: (u) => sim(u.admin), largura: 8 },
        { cabecalho: "Somente Painel", valor: (u) => sim(u.somentePainel), largura: 15 },
        { cabecalho: "Permissões", valor: (u) => u.permissoes.join(", "), largura: 30 },
        { cabecalho: "Nome de responsável", valor: (u) => u.nomeResponsavel, largura: 21 },
        { cabecalho: "Ativo", valor: (u) => sim(u.ativo), largura: 8 },
        { cabecalho: "Criado em", valor: (u) => u.criadoEm, formato: "dataHora" },
        { cabecalho: "Atualizado em", valor: (u) => u.atualizadoEm, formato: "dataHora" },
      ],
      usuarios,
    ),
  );

  registrar(
    "Configurações",
    adicionarAba(
      planilha,
      "Configurações",
      [
        { cabecalho: "Chave", valor: (c) => c.chave, largura: 28 },
        { cabecalho: "Valor", valor: (c) => c.valor, largura: 30 },
      ],
      configuracoes,
    ),
  );

  leiaMe.columns = [{ width: 24 }, { width: 14 }];
  leiaMe.addRow(["Backup do Pré-Safra"]).font = { bold: true, size: 14 };
  leiaMe.addRow(["Gerado em", horaLocal(new Date())]).getCell(2).numFmt = "dd/mm/yyyy hh:mm";
  leiaMe.addRow(["Gerado por", usuario.nome]);
  leiaMe.addRow([]);
  leiaMe.addRow(["Aba", "Linhas"]).font = { bold: true };
  for (const [nome, total] of contagens) leiaMe.addRow([nome, total]);
  leiaMe.addRow([]);
  leiaMe.addRow(["Não incluídos: senhas dos usuários e WhatsApp de quem enviou sugestões."]);

  const buffer = await planilha.xlsx.writeBuffer();
  const hoje = horaLocal(new Date()).toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup-presafra-${hoje}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
