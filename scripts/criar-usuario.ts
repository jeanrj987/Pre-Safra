// Cria ou atualiza um usuário (não há autocadastro no app). Também serve para redefinir a
// senha de alguém via linha de comando, já que é reexecutável (upsert por e-mail).
// Uso: npm run criar-usuario -- "Nome Completo" email@dominio.com senha123 [--admin | --painel]
// --painel cria uma conta restrita ao Painel (ex.: para deixar logada numa TV da sala).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSenha } from "../src/lib/senha";
import { MENSAGEM_ERRO_SENHA, validarSenha } from "../src/lib/politica-senha";
import { hashDaChave, TIPO_LOGIN } from "../src/lib/chave-limite";

const [nome, emailBruto, senha, ...flags] = process.argv.slice(2);
if (!nome || !emailBruto || !senha) {
  console.error(
    'Uso: npm run criar-usuario -- "Nome Completo" email@dominio.com senha [--admin | --painel]',
  );
  process.exit(1);
}
const problemaSenha = validarSenha(senha);
if (problemaSenha) {
  console.error(MENSAGEM_ERRO_SENHA[problemaSenha]);
  process.exit(1);
}
const email = emailBruto.trim().toLowerCase();
const admin = flags.includes("--admin");
const somentePainel = flags.includes("--painel");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// P2021 = "a tabela não existe no banco" (o `npm run db:push` ainda não foi rodado). Só esse caso vira
// aviso; qualquer outro erro (conexão, permissão...) é um problema de verdade e interrompe o script.
async function avisarSeTabelaFaltar(o: string, acao: () => Promise<unknown>) {
  try {
    await acao();
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2021") throw e;
    console.warn(`Aviso: não foi possível limpar ${o} porque a tabela não existe no banco (rode npm run db:push).`);
  }
}

async function main() {
  const senhaHash = await hashSenha(senha);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { nome, senhaHash, admin, somentePainel, ativo: true },
    create: { nome, email, senhaHash, admin, somentePainel },
  });
  // Quem redefine a senha por aqui não quer que um link de redefinição antigo ainda funcione, nem
  // que o bloqueio por excesso de tentativas de login (como faz o admin ao redefinir) continue valendo.
  await avisarSeTabelaFaltar("links de redefinição pendentes", () =>
    prisma.tokenRecuperacao.updateMany({ where: { usuarioId: usuario.id, usadoEm: null }, data: { usadoEm: new Date() } }),
  );
  await avisarSeTabelaFaltar("bloqueio de tentativas de login", () =>
    prisma.tentativaAcesso.deleteMany({ where: { tipo: TIPO_LOGIN, chave: hashDaChave(email) } }),
  );
  const papel = admin ? "admin" : somentePainel ? "somente painel" : "comum";
  console.log(`Usuário "${usuario.nome}" <${usuario.email}> salvo (${papel}).`);
}

main().finally(() => prisma.$disconnect());
