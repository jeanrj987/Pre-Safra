// Popula um banco de DEMONSTRAÇÃO (nunca o banco real) com dados fictícios, só para gerar
// as capturas de tela dos manuais em PDF. Rode sempre com DATABASE_URL apontando para um
// banco descartável, nunca para o .env do projeto:
//   DATABASE_URL="postgresql://postgres:docspw@localhost:55432/presafra_docs" npx tsx docs/seed-demo.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSenha } from "../src/lib/senha";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function dia(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

async function main() {
  const senhaHash = await hashSenha("demo1234");

  await prisma.usuario.upsert({
    where: { email: "marina@demo.controlsoft.com.br" },
    update: { nome: "Marina Alves", senhaHash, admin: true, ativo: true },
    create: { nome: "Marina Alves", email: "marina@demo.controlsoft.com.br", senhaHash, admin: true },
  });
  await prisma.usuario.upsert({
    where: { email: "rafael@demo.controlsoft.com.br" },
    update: { nome: "Rafael Nunes", senhaHash, admin: false, ativo: true },
    create: { nome: "Rafael Nunes", email: "rafael@demo.controlsoft.com.br", senhaHash, admin: false },
  });

  const soja = await prisma.safra.upsert({
    where: { nome: "Soja 2026" },
    update: { inicio: dia(-70), prazo: dia(64), ativa: true },
    create: { nome: "Soja 2026", cultura: "Soja", inicio: dia(-70), prazo: dia(64), ativa: true },
  });
  const milho = await prisma.safra.upsert({
    where: { nome: "Milho 2026" },
    update: { inicio: dia(-10), prazo: dia(150), ativa: true },
    create: { nome: "Milho 2026", cultura: "Milho", inicio: dia(-10), prazo: dia(150), ativa: true },
  });

  const REGIAO_SUL = "Sul MT a SC/PR";
  const ATENDE_SUL = "Camila Duarte e Thiago Lima";
  const REGIAO_CO = "Centro-Oeste GO a DF/TO";
  const ATENDE_CO = "Fernanda Rocha e Bruno Castro";

  const clientesDef = [
    { nome: "Agropecuária Vale Verde", regiao: REGIAO_SUL, atendente: ATENDE_SUL, gerente: "Paulo Menezes", consultor: "Juliana Prado" },
    { nome: "Fazenda Boa Esperança", regiao: REGIAO_SUL, atendente: ATENDE_SUL, gerente: "Paulo Menezes", consultor: "Juliana Prado" },
    { nome: "Cooperativa Rio Claro", regiao: REGIAO_CO, atendente: ATENDE_CO, gerente: "Elaine Cardoso", consultor: "Diego Ferraz" },
    { nome: "Grãos Horizonte Agrícola", regiao: REGIAO_SUL, atendente: ATENDE_SUL, gerente: "Paulo Menezes", consultor: "Juliana Prado" },
    { nome: "Cerealista Nova Aurora", regiao: REGIAO_CO, atendente: ATENDE_CO, gerente: "Elaine Cardoso", consultor: "Diego Ferraz" },
    { nome: "Armazéns Terra Rica", regiao: REGIAO_CO, atendente: ATENDE_CO, gerente: "Elaine Cardoso", consultor: "Diego Ferraz" },
    { nome: "Revenda Agrotech Sul", regiao: REGIAO_SUL, atendente: ATENDE_SUL, gerente: "Paulo Menezes", consultor: "Juliana Prado" },
    { nome: "Fazenda Santa Luzia", regiao: REGIAO_CO, atendente: ATENDE_CO, gerente: "Elaine Cardoso", consultor: "Diego Ferraz" },
    { nome: "Distribuidora AgroPampa", regiao: REGIAO_SUL, atendente: ATENDE_SUL, gerente: "Paulo Menezes", consultor: "Juliana Prado" },
  ];

  const clientes: Record<string, number> = {};
  for (const c of clientesDef) {
    const row = await prisma.cliente.upsert({ where: { nome: c.nome }, update: c, create: c });
    clientes[c.nome] = row.id;
  }

  // Reexecutável: limpa os registros de Pré-Safra das safras de demonstração antes de recriar.
  await prisma.preSafra.deleteMany({ where: { safraId: { in: [soja.id, milho.id] } } });

  await prisma.preSafra.create({
    data: { clienteId: clientes["Agropecuária Vale Verde"], safraId: soja.id, responsavel: "Camila Duarte", dataPrevista: dia(-10) },
  });
  await prisma.preSafra.create({
    data: { clienteId: clientes["Fazenda Boa Esperança"], safraId: soja.id, responsavel: "Thiago Lima", dataPrevista: dia(-3) },
  });
  await prisma.preSafra.create({
    data: { clienteId: clientes["Cooperativa Rio Claro"], safraId: soja.id, dataPrevista: dia(-20) },
  });
  await prisma.preSafra.create({
    data: { clienteId: clientes["Grãos Horizonte Agrícola"], safraId: soja.id, responsavel: "Camila Duarte", dataPrevista: dia(5) },
  });
  await prisma.preSafra.create({
    data: { clienteId: clientes["Cerealista Nova Aurora"], safraId: soja.id, responsavel: "Fernanda Rocha", dataPrevista: dia(25) },
  });
  await prisma.preSafra.create({
    data: { clienteId: clientes["Armazéns Terra Rica"], safraId: soja.id },
  });
  await prisma.preSafra.create({
    data: {
      clienteId: clientes["Distribuidora AgroPampa"], safraId: soja.id,
      inativo: true, motivoInativacao: "Contrato encerrado em 2025.",
    },
  });
  await prisma.preSafra.create({
    data: { clienteNomeManual: "Sítio Recanto das Águas", safraId: soja.id, dataPrevista: dia(12) },
  });

  const santaLuzia = await prisma.preSafra.create({
    data: {
      clienteId: clientes["Fazenda Santa Luzia"], safraId: soja.id, responsavel: "Fernanda Rocha",
      dataPrevista: dia(-15), configuradoSistema: true, melhoriasApresentadas: false, formato: "Presencial",
    },
  });
  await prisma.conclusao.create({
    data: { preSafraId: santaLuzia.id, autor: "Rafael Nunes", observacao: "Configuração concluída sem pendências.", criadoEm: dia(-14) },
  });

  const agrotech = await prisma.preSafra.create({
    data: {
      clienteId: clientes["Revenda Agrotech Sul"], safraId: soja.id, responsavel: "Thiago Lima",
      dataPrevista: dia(-30), configuradoSistema: true, melhoriasApresentadas: true, formato: "Online",
    },
  });
  await prisma.conclusao.create({
    data: {
      preSafraId: agrotech.id, autor: "Thiago Lima", observacao: "Primeira configuração realizada.",
      criadoEm: dia(-29), reabertoEm: dia(-20), reabertoPor: "Marina Alves",
      motivoReabertura: "Cliente pediu ajuste na tabela de preços.",
    },
  });
  await prisma.conclusao.create({
    data: {
      preSafraId: agrotech.id, autor: "Thiago Lima",
      observacao: "Ajuste realizado e novidades apresentadas novamente.", criadoEm: dia(-18),
    },
  });

  await prisma.preSafra.create({
    data: { clienteId: clientes["Agropecuária Vale Verde"], safraId: milho.id, responsavel: "Camila Duarte", dataPrevista: dia(40) },
  });
  await prisma.preSafra.create({
    data: { clienteId: clientes["Cooperativa Rio Claro"], safraId: milho.id, dataPrevista: dia(60) },
  });

  console.log("Dados de demonstração criados com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
