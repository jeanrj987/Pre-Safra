// Redefinição de senha por link gerado pelo ADMINISTRADOR (ver recuperacao-admin.ts).
//
// Como funciona:
//  1. O admin gera o link (gerarLinkRedefinicaoAdmin) e o entrega à pessoa. O token é aleatório
//     (32 bytes, base64url); no banco fica só o SHA-256 dele. Vale 24 horas e só uma vez. O link usa
//     FRAGMENTO (`/redefinir-senha#token=...`): o navegador não envia o fragmento ao servidor, então
//     ele não aparece em log de acesso nem no Referer; a página lê o fragmento no cliente, apaga da
//     barra de endereço e manda o token por POST (Server Action).
//  2. redefinirComToken consome o token e grava a nova senha na MESMA transação. Trocar o senhaHash
//     já derruba as sessões abertas (o cookie é assinado com ele; ver auth.ts). Não há login automático.
//
// O link é montado só com APP_URL (variável de ambiente), nunca com cabeçalhos da requisição
// (Host / x-forwarded-host), que o atacante controla.
import { createHash } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { limparTentativasLogin, registrarSeDentroDoLimite, type ItemLimite, type Limite } from "@/lib/limitador";
import { emailSistemaConfigurado, enviarEmailSistema } from "@/lib/notificacoes/sistema";
import { hashSenha } from "@/lib/senha";
import { validarNovaSenha, MENSAGEM_ERRO_SENHA } from "@/lib/politica-senha";

const UM_MINUTO_MS = 60 * 1000;
const UM_DIA_MS = 24 * 60 * UM_MINUTO_MS;
const DEZ_MINUTOS_MS = 10 * UM_MINUTO_MS;
const CHANCE_DE_LIMPEZA = 0.1;

// Um token tem 32 bytes = 43 caracteres em base64url. Qualquer outra coisa nem vai ao banco.
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Tentativas de usar um link (adivinhar token): o token é impossível de adivinhar, o limite
// serve para proteger o banco e o custo de CPU de quem insiste. Só por IP, sem limite "global": um teto
// para todo mundo deixaria um atacante anônimo bloquear a redefinição de todos os usuários.
export const LIMITES_REDEFINICAO = {
  porIp: { tipo: "redefinir-ip", max: 20, janelaMs: DEZ_MINUTOS_MS },
} satisfies Record<string, Limite>;

const MENSAGEM_LINK_INVALIDO = "Link inválido ou expirado. Peça ao administrador um novo link.";
const MENSAGEM_LIMITE = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
const MENSAGEM_FALHA = "Não foi possível redefinir a senha agora. Tente novamente.";

class LinkInvalido extends Error {}

export const hashDoToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Confere os limites e só grava a tentativa se nenhum estourou (a contagem vem antes, então um
 * bloqueio expira sozinho e a tabela não cresce). Devolve true se algum limite já estourou.
 */
async function registrarEVerificar(itens: ItemLimite[]): Promise<boolean> {
  return !(await registrarSeDentroDoLimite(itens));
}

/**
 * Base do link: APP_URL sem barra no fim. Aceita http(s) em desenvolvimento; em produção
 * (NODE_ENV === "production") exige https, para o link com o token nunca trafegar sem criptografia.
 * Null se faltar ou for inválida.
 */
export function urlBase(env: Record<string, string | undefined> = process.env): string | null {
  const bruto = env.APP_URL?.trim();
  if (!bruto) return null;
  try {
    const url = new URL(bruto);
    const producao = env.NODE_ENV === "production";
    if (url.protocol !== "https:" && (producao || url.protocol !== "http:")) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Apaga tokens vencidos ou usados há mais de 24 h (higiene; os pendentes válidos nunca são tocados). */
export async function limparTokensAntigos(): Promise<void> {
  const corte = new Date(Date.now() - UM_DIA_MS);
  await prisma.tokenRecuperacao.deleteMany({ where: { OR: [{ expiraEm: { lt: corte } }, { usadoEm: { lt: corte } }] } });
}

async function limpezaOportunista(): Promise<void> {
  if (Math.random() >= CHANCE_DE_LIMPEZA) return;
  try {
    await limparTokensAntigos();
  } catch (e) {
    console.error("Falha ao limpar tokens de recuperação antigos", e);
  }
}

/** Marca como usados todos os links de recuperação ainda pendentes do usuário. */
export function invalidarTokensDoUsuario(usuarioId: number, cliente: Pick<typeof prisma, "tokenRecuperacao"> = prisma) {
  return cliente.tokenRecuperacao.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: new Date() } });
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || "";
const saudacao = (nome: string) => (primeiroNome(nome) ? `Olá, ${primeiroNome(nome)}!` : "Olá!");

/**
 * E-mail "sua senha foi alterada" (nunca leva a senha). Quem chama deve rodá-lo dentro de after().
 * Nunca lança. Sem e-mail configurado não há o que avisar: sai em silêncio, sem poluir o log a cada
 * troca de senha; só uma falha de envio com o e-mail configurado é registrada (por enviarEmailSistema).
 */
export async function avisarSenhaAlterada(email: string, nome: string): Promise<void> {
  if (!emailSistemaConfigurado()) return;
  await enviarEmailSistema(email, {
    assunto: "Sua senha do Pré-Safra foi alterada",
    texto:
      `${saudacao(nome)}\n\n` +
      "A senha da sua conta no Pré-Safra acabou de ser alterada. Quem estava conectado com a senha antiga precisa entrar de novo.\n\n" +
      "Se não foi você, avise a administração do sistema agora mesmo.",
  });
}

// --- Usar o link ----------------------------------------------------------------------------

async function limiteDeRedefinicaoEstourou(ip?: string): Promise<boolean> {
  const L = LIMITES_REDEFINICAO;
  return registrarEVerificar(ip ? [{ limite: L.porIp, chave: ip }] : []);
}

/** Acha o token pendente e válido, com a conta que pode usá-lo. Null por qualquer motivo, sem distinguir. */
async function buscarTokenValido(token: string) {
  if (!FORMATO_TOKEN.test(token)) return null;
  const registro = await prisma.tokenRecuperacao.findUnique({
    where: { tokenHash: hashDoToken(token) },
    include: { usuario: { select: { id: true, nome: true, email: true, ativo: true, somentePainel: true } } },
  });
  if (!registro || registro.usadoEm || registro.expiraEm.getTime() <= Date.now()) return null;
  if (!registro.usuario.ativo || registro.usuario.somentePainel) return null;
  return registro;
}

/**
 * Só para a página decidir se mostra o formulário; não consome o token. Também conta no limite de
 * tentativas, porque é uma forma de testar tokens.
 */
export async function validarToken(token: string, ip?: string): Promise<"valido" | "invalido" | "limitado"> {
  if (await limiteDeRedefinicaoEstourou(ip)) return "limitado";
  return (await buscarTokenValido(token)) ? "valido" : "invalido";
}

/** `linkInvalido` marca o erro "este link não serve (mais)", para a tela mandar a pessoa procurar o administrador. */
export type ResultadoRedefinicao = { ok: true } | { ok: false; mensagem: string; linkInvalido?: true };

const RESULTADO_LINK_INVALIDO = { ok: false, mensagem: MENSAGEM_LINK_INVALIDO, linkInvalido: true } as const;

/**
 * Troca a senha usando o token. A política e a confirmação são conferidas primeiro (barato); o hash
 * da senha (caro) só roda depois de provar que o token é válido. O token é consumido de forma
 * atômica e a senha é gravada na mesma transação: duas tentativas simultâneas com o mesmo link
 * resultam em uma só vitória (testar isso de verdade exige um Postgres; os testes unitários só
 * simulam a corrida). Não inicia sessão.
 */
export async function redefinirComToken(
  token: string,
  novaSenha: string,
  confirmacao: string,
  ip?: string,
): Promise<ResultadoRedefinicao> {
  const problema = validarNovaSenha(novaSenha, confirmacao);
  if (problema) return { ok: false, mensagem: MENSAGEM_ERRO_SENHA[problema] };

  if (await limiteDeRedefinicaoEstourou(ip)) return { ok: false, mensagem: MENSAGEM_LIMITE };

  try {
    const registro = await buscarTokenValido(token);
    if (!registro) return RESULTADO_LINK_INVALIDO;
    const { usuario } = registro;

    const senhaHash = await hashSenha(novaSenha);
    const agora = new Date();

    await prisma.$transaction(async (tx) => {
      // Consumo atômico: só um dos concorrentes consegue marcar o token (count === 1).
      const consumido = await tx.tokenRecuperacao.updateMany({
        where: { tokenHash: registro.tokenHash, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      });
      if (consumido.count !== 1) throw new LinkInvalido();

      // A conta pode ter sido desativada entre a leitura e agora; se for o caso, desfaz o consumo.
      const atualizado = await tx.usuario.updateMany({
        where: { id: usuario.id, ativo: true, somentePainel: false },
        data: { senhaHash },
      });
      if (atualizado.count !== 1) throw new LinkInvalido();

      // Os demais links pendentes deste usuário deixam de valer.
      await invalidarTokensDoUsuario(usuario.id, tx);
    });

    // A senha JÁ foi trocada (a transação foi confirmada): nada daqui para baixo pode transformar o
    // sucesso em erro. Cada passo tem o seu try/catch e só registra uma linha curta, sem dados.
    try {
      await limparTentativasLogin(usuario.email);
    } catch {
      console.error("Falha ao limpar as tentativas de login depois de redefinir a senha.");
    }
    try {
      after(async () => {
        try {
          await avisarSenhaAlterada(usuario.email, usuario.nome);
          await limpezaOportunista();
        } catch {
          console.error("Falha ao enviar o aviso de senha alterada.");
        }
      });
    } catch {
      console.error("Falha ao agendar o aviso de senha alterada.");
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof LinkInvalido) return RESULTADO_LINK_INVALIDO;
    console.error("Falha ao redefinir a senha com token", e instanceof Error ? e.name : "erro desconhecido");
    return { ok: false, mensagem: MENSAGEM_FALHA };
  }
}
