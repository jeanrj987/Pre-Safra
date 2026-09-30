// Cria ou atualiza um usuário (não há autocadastro no app). Também serve para redefinir a
// senha de alguém via linha de comando, já que é reexecutável (upsert por e-mail).
// Uso: npm run criar-usuario -- "Nome Completo" email@dominio.com senha123 [--admin | --painel]
// --painel cria uma conta restrita ao Painel (ex.: para deixar logada numa TV da sala).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSenha } from "../src/lib/senha";

const [nome, emailBruto, senha, ...flags] = process.argv.slice(2);
if (!nome || !emailBruto || !senha) {
  console.error(
    'Uso: npm run criar-usuario -- "Nome Completo" email@dominio.com senha [--admin | --painel]',
  );
  process.exit(1);
}
if (senha.length < 10) {
  console.error("A senha precisa ter pelo menos 10 caracteres.");
  process.exit(1);
}
const email = emailBruto.trim().toLowerCase();
const admin = flags.includes("--admin");
const somentePainel = flags.includes("--painel");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const senhaHash = await hashSenha(senha);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { nome, senhaHash, admin, somentePainel, ativo: true },
    create: { nome, email, senhaHash, admin, somentePainel },
  });
  const papel = admin ? "admin" : somentePainel ? "somente painel" : "comum";
  console.log(`Usuário "${usuario.nome}" <${usuario.email}> salvo (${papel}).`);
}

main().finally(() => prisma.$disconnect());
