// Restaura num banco LOCAL a planilha gerada em Administração > Backup em Excel.
// Uso: npx tsx scripts/restaurar-backup.ts caminho/backup-presafra-AAAA-MM-DD.xlsx [--limpar]
// Só roda se o DATABASE_URL apontar para localhost (nunca contra o banco de produção).
// O backup não traz senhas, WhatsApp de quem sugeriu nem anexos: todos os usuários restaurados
// ficam com a senha local abaixo, e as sugestões ficam com um WhatsApp fictício por nome.
import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSenha } from "../src/lib/senha";
import { normalizar } from "../src/lib/texto";
import { TIPOS_SUGESTAO, normalizarTopico, rotuloDoTipo } from "../src/lib/sugestoes";
import { MOTIVOS_PENDENCIA } from "../src/lib/pendencia";
import { filtrarPermissoes } from "../src/lib/permissoes";

const SENHA_LOCAL = "senhalocal123";
// O backup grava a hora de parede de Mato Grosso (UTC-4, sem horário de verão) como se fosse UTC.
const HORAS_DE_MATO_GROSSO = 4;

const [caminho, ...flags] = process.argv.slice(2);
if (!caminho) {
  console.error("Uso: npx tsx scripts/restaurar-backup.ts caminho/backup.xlsx [--limpar]");
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {}
if (host !== "localhost" && host !== "127.0.0.1") {
  console.error(`Recusado: o DATABASE_URL aponta para "${host || "(vazio)"}", e este script só roda em localhost.`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type Linha = Record<string, unknown>;

function texto(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && !(v instanceof Date)) {
    const o = v as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (o.richText) return texto(o.richText.map((p) => p.text).join(""));
    if (o.text != null) return texto(o.text);
    if (o.result != null) return texto(o.result);
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}
const obrigatorio = (v: unknown, onde: string) => {
  const s = texto(v);
  if (s == null) throw new Error(`Valor obrigatório vazio em ${onde}`);
  return s;
};
const numero = (v: unknown) => (texto(v) == null ? null : Number(texto(v)));
const sim = (v: unknown) => texto(v) === "Sim";
const dia = (v: unknown) => (v instanceof Date ? v : null);
const diaObrigatorio = (v: unknown, onde: string) => {
  const d = dia(v);
  if (!d) throw new Error(`Data obrigatória vazia em ${onde}`);
  return d;
};
const dataHora = (v: unknown) =>
  v instanceof Date ? new Date(v.getTime() + HORAS_DE_MATO_GROSSO * 3_600_000) : null;
const dataHoraObrigatoria = (v: unknown, onde: string) => {
  const d = dataHora(v);
  if (!d) throw new Error(`Data e hora obrigatórias vazias em ${onde}`);
  return d;
};

function lerAba(planilha: ExcelJS.Workbook, nome: string): Linha[] {
  const aba = planilha.getWorksheet(nome);
  if (!aba) throw new Error(`Aba "${nome}" não encontrada na planilha.`);
  const cabecalhos = (aba.getRow(1).values as unknown[]).slice(1).map((c) => texto(c) ?? "");
  const linhas: Linha[] = [];
  aba.eachRow((row, i) => {
    if (i === 1) return;
    const valores = (row.values as unknown[]).slice(1);
    if (valores.every((v) => texto(v) == null)) return;
    linhas.push(Object.fromEntries(cabecalhos.map((c, j) => [c, valores[j]])));
  });
  return linhas;
}

const motivoPorRotulo = (v: unknown) => {
  const rotulo = texto(v);
  return MOTIVOS_PENDENCIA.find((m) => m.rotulo === rotulo)?.valor ?? null;
};
const tipoPorRotulo = (v: unknown) => TIPOS_SUGESTAO.find((t) => rotuloDoTipo(t) === texto(v)) ?? "faq";
const formato = (v: unknown) => (texto(v) === "Online" || texto(v) === "Presencial" ? (texto(v) as "Online" | "Presencial") : null);

async function main() {
  const planilha = new ExcelJS.Workbook();
  await planilha.xlsx.readFile(caminho);

  const existentes = await prisma.cliente.count();
  if (existentes > 0 && !flags.includes("--limpar")) {
    throw new Error("O banco local já tem dados. Rode de novo com --limpar para apagá-los antes de restaurar.");
  }
  if (flags.includes("--limpar")) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "AnexoSugestao","Sugestao","Notificacao","Conclusao","PreSafra","Atividade","Cliente","Safra","Usuario","Configuracao" RESTART IDENTITY CASCADE`,
    );
  }

  const senhaHash = await hashSenha(SENHA_LOCAL);
  const contagens: [string, number][] = [];

  const usuarios = lerAba(planilha, "Usuários").map((l) => ({
    id: numero(l["ID"])!,
    nome: obrigatorio(l["Nome"], "Usuários/Nome"),
    email: obrigatorio(l["E-mail"], "Usuários/E-mail").toLowerCase(),
    senhaHash,
    admin: sim(l["Admin"]),
    somentePainel: sim(l["Somente Painel"]),
    permissoes: filtrarPermissoes((texto(l["Permissões"]) ?? "").split(",").map((p) => p.trim()).filter(Boolean)),
    nomeResponsavel: texto(l["Nome de responsável"]),
    ativo: sim(l["Ativo"]),
    criadoEm: dataHoraObrigatoria(l["Criado em"], "Usuários/Criado em"),
    atualizadoEm: dataHoraObrigatoria(l["Atualizado em"], "Usuários/Atualizado em"),
  }));
  await prisma.usuario.createMany({ data: usuarios });
  contagens.push(["Usuario", usuarios.length]);

  const safras = lerAba(planilha, "Safras").map((l) => ({
    id: numero(l["ID"])!,
    nome: obrigatorio(l["Nome"], "Safras/Nome"),
    cultura: texto(l["Cultura"]),
    inicio: diaObrigatorio(l["Início"], "Safras/Início"),
    prazo: diaObrigatorio(l["Prazo"], "Safras/Prazo"),
    ativa: sim(l["Ativa"]),
    criadoEm: dataHoraObrigatoria(l["Criado em"], "Safras/Criado em"),
    atualizadoEm: dataHoraObrigatoria(l["Atualizado em"], "Safras/Atualizado em"),
  }));
  await prisma.safra.createMany({ data: safras });
  contagens.push(["Safra", safras.length]);

  const clientes = lerAba(planilha, "Clientes").map((l) => ({
    id: numero(l["ID"])!,
    nome: obrigatorio(l["Nome"], "Clientes/Nome"),
    cidade: texto(l["Cidade"]),
    uf: texto(l["UF"]),
    regiao: texto(l["Região"]),
    consultor: texto(l["Consultor"]),
    atendente: texto(l["Atendente"]),
    comercial: texto(l["Comercial"]),
    gerente: texto(l["Gerente"]),
    whatsapp: texto(l["WhatsApp"]),
    email: texto(l["E-mail"]),
    criadoEm: dataHoraObrigatoria(l["Criado em"], "Clientes/Criado em"),
    atualizadoEm: dataHoraObrigatoria(l["Atualizado em"], "Clientes/Atualizado em"),
  }));
  await prisma.cliente.createMany({ data: clientes });
  contagens.push(["Cliente", clientes.length]);

  const preSafras = lerAba(planilha, "Pré-Safras").map((l) => {
    const clienteId = numero(l["Cliente ID"]);
    return {
      id: numero(l["ID"])!,
      clienteId,
      // Sem cliente cadastrado, a coluna "Cliente" do backup traz o nome digitado à mão
      clienteNomeManual: clienteId == null ? texto(l["Cliente"]) : null,
      safraId: numero(l["Safra ID"])!,
      responsavel: texto(l["Responsável"]),
      dataPrevista: dia(l["Data prevista"]),
      horario: texto(l["Horário"]),
      formato: formato(l["Formato"]),
      configuradoSistema: sim(l["Configurado no sistema"]),
      melhoriasApresentadas: sim(l["Melhorias apresentadas"]),
      agendadoPor: texto(l["Agendado por"]),
      agendadoEm: dataHora(l["Agendado em"]),
      inativo: sim(l["Inativo"]),
      motivoInativacao: texto(l["Motivo da inativação"]),
      observacoes: texto(l["Observações"]),
      motivoPendencia: motivoPorRotulo(l["Motivo da pendência"]),
      observacaoPendencia: texto(l["Observação da pendência"]),
      criadoEm: dataHoraObrigatoria(l["Criado em"], "Pré-Safras/Criado em"),
      atualizadoEm: dataHoraObrigatoria(l["Atualizado em"], "Pré-Safras/Atualizado em"),
      atualizadoPor: texto(l["Atualizado por"]),
    };
  });
  await prisma.preSafra.createMany({ data: preSafras });
  contagens.push(["PreSafra", preSafras.length]);

  const conclusoes = lerAba(planilha, "Conclusões").map((l) => ({
    id: numero(l["ID"])!,
    preSafraId: numero(l["Pré-Safra ID"])!,
    observacao: texto(l["Observação"]),
    autor: texto(l["Autor"]),
    criadoEm: dataHoraObrigatoria(l["Finalizado em"], "Conclusões/Finalizado em"),
    reabertoEm: dataHora(l["Reaberto em"]),
    reabertoPor: texto(l["Reaberto por"]),
    motivoReabertura: texto(l["Motivo da reabertura"]),
  }));
  await prisma.conclusao.createMany({ data: conclusoes });
  contagens.push(["Conclusao", conclusoes.length]);

  const notificacoes = lerAba(planilha, "Notificações").map((l) => ({
    id: numero(l["ID"])!,
    preSafraId: numero(l["Pré-Safra ID"])!,
    canal: obrigatorio(l["Canal"], "Notificações/Canal"),
    evento: obrigatorio(l["Evento"], "Notificações/Evento"),
    destino: obrigatorio(l["Destino"], "Notificações/Destino"),
    ok: sim(l["Enviado"]),
    erro: texto(l["Erro"]),
    autor: texto(l["Autor"]),
    criadoEm: dataHoraObrigatoria(l["Data"], "Notificações/Data"),
  }));
  await prisma.notificacao.createMany({ data: notificacoes });
  contagens.push(["Notificacao", notificacoes.length]);

  const atividades = lerAba(planilha, "Atividades").map((l) => ({
    id: numero(l["ID"])!,
    titulo: obrigatorio(l["Título"], "Atividades/Título"),
    descricao: texto(l["Descrição"]),
    data: diaObrigatorio(l["Data"], "Atividades/Data"),
    horario: texto(l["Horário"]),
    concluida: sim(l["Concluída"]),
    criadoPor: texto(l["Criada por"]),
    criadoEm: dataHoraObrigatoria(l["Criado em"], "Atividades/Criado em"),
    atualizadoEm: dataHoraObrigatoria(l["Atualizado em"], "Atividades/Atualizado em"),
  }));
  await prisma.atividade.createMany({ data: atividades });
  contagens.push(["Atividade", atividades.length]);

  const sugestoes = lerAba(planilha, "Sugestões").map((l) => {
    const nome = obrigatorio(l["Nome"], "Sugestões/Nome");
    const topico = obrigatorio(l["Assunto"], "Sugestões/Assunto");
    return {
      id: numero(l["ID"])!,
      nome,
      // O backup não traz o WhatsApp: um valor fictício por nome mantém o ranking por pessoa
      whatsapp: `sem-whatsapp:${normalizar(nome)}`,
      topico,
      topicoNorm: normalizarTopico(topico),
      texto: obrigatorio(l["Sugestão"], "Sugestões/Sugestão"),
      possivelDuplicada: sim(l["Possível duplicada"]),
      faqParecida: texto(l["Parecida com"]),
      oculta: sim(l["Oculta"]),
      criadoEm: dataHoraObrigatoria(l["Data"], "Sugestões/Data"),
      tipo: tipoPorRotulo(l["Tipo"]),
    };
  });
  await prisma.sugestao.createMany({ data: sugestoes });
  contagens.push(["Sugestao", sugestoes.length]);

  const configuracoes = lerAba(planilha, "Configurações").map((l) => ({
    chave: obrigatorio(l["Chave"], "Configurações/Chave"),
    valor: texto(l["Valor"]) ?? "",
  }));
  await prisma.configuracao.createMany({ data: configuracoes });
  contagens.push(["Configuracao", configuracoes.length]);

  // Os IDs entraram explícitos: a sequência precisa continuar depois do maior deles
  for (const tabela of ["Usuario", "Safra", "Cliente", "PreSafra", "Conclusao", "Notificacao", "Atividade", "Sugestao"]) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${tabela}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tabela}"), 1), (SELECT COUNT(*) > 0 FROM "${tabela}"))`,
    );
  }

  console.log("Restaurado:");
  for (const [nome, total] of contagens) console.log(`  ${nome}: ${total}`);
  console.log(`Todos os usuários restaurados entram com a senha local "${SENHA_LOCAL}".`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
