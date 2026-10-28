// Acerta o responsável dos clientes já agendados: quem agenda ou reagenda passa a ser o responsável
// (ver responsavelAoAgendar em src/lib/responsavel.ts), mas antes disso o usuário comum não assumia
// um cliente que já tinha dono. Aqui o responsável vira o nome ligado à conta de quem fez o último
// agendamento ("agendado por"). Rode `npm run corrigir-responsavel` para só ver o que mudaria e
// `npm run corrigir-responsavel -- --aplicar` para gravar. É seguro repetir.
//
// Só entram clientes ainda agendados (com formato), não finalizados nem inativos. Ficam de fora
// quem agendou com a permissão de escolher o responsável (o admin pode agendar em nome de outra
// pessoa de propósito) e as contas sem nome de responsável ligado.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { permissoesEfetivas, pode } from "../src/lib/permissoes";
import { normalizar } from "../src/lib/texto";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const chave = (s: string | null) => normalizar((s ?? "").trim());

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    select: { nome: true, admin: true, somentePainel: true, permissoes: true, nomeResponsavel: true },
  });
  const porNome = new Map(usuarios.map((u) => [chave(u.nome), u]));

  const registros = await prisma.preSafra.findMany({
    where: { inativo: false, configuradoSistema: false, formato: { not: null }, agendadoPor: { not: null } },
    select: {
      id: true,
      responsavel: true,
      agendadoPor: true,
      agendadoEm: true,
      cliente: { select: { nome: true } },
      clienteNomeManual: true,
    },
    orderBy: { id: "asc" },
  });

  const mudancas: { id: number; cliente: string; de: string | null; para: string; por: string }[] = [];
  let semConta = 0;
  for (const r of registros) {
    const quem = porNome.get(chave(r.agendadoPor));
    if (!quem) {
      semConta++;
      continue;
    }
    const permissoes = permissoesEfetivas(quem);
    if (pode({ permissoes }, "trocarResp") || !quem.nomeResponsavel?.trim()) continue;
    const novo = quem.nomeResponsavel.trim();
    if (chave(r.responsavel) === chave(novo)) continue;
    mudancas.push({
      id: r.id,
      cliente: r.cliente?.nome ?? r.clienteNomeManual ?? "(sem nome)",
      de: r.responsavel,
      para: novo,
      por: quem.nome,
    });
  }

  console.log(`${registros.length} cliente(s) agendado(s) conferido(s); ${semConta} sem conta correspondente em "agendado por".`);
  if (mudancas.length === 0) {
    console.log("Nada para corrigir.");
    return;
  }
  console.table(
    mudancas.map((m) => ({ id: m.id, cliente: m.cliente, "responsável hoje": m.de ?? "(vazio)", "passa a ser": m.para, "agendado por": m.por })),
  );

  if (!aplicar) {
    console.log(`${mudancas.length} cliente(s) mudariam. Nada foi gravado: rode de novo com --aplicar para gravar.`);
    return;
  }
  let gravados = 0;
  for (const m of mudancas) {
    // A condição vai na própria gravação: se alguém mudou o responsável nesse meio tempo, nada é sobrescrito.
    const { count } = await prisma.preSafra.updateMany({
      where: { id: m.id, responsavel: m.de },
      data: { responsavel: m.para },
    });
    gravados += count;
  }
  console.log(`${gravados} de ${mudancas.length} cliente(s) corrigido(s).`);
}

main().finally(() => prisma.$disconnect());
