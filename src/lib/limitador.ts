// Limitador de tentativas guardado no banco (tabela TentativaAcesso), então vale para todas as
// instâncias do servidor e sobrevive a reinicializações (o antigo Map em memória zerava a cada
// cold start na Vercel). Cada tentativa é uma linha (tipo, chave, criadoEm); "quantas na janela"
// é um count nas linhas mais novas que a janela.
//
// A chave (e-mail, IP…) é guardada só como HMAC-SHA256 com AUTH_SECRET: não mantém dado pessoal em
// claro, não aceita texto de tamanho livre e, sem o segredo, ninguém consegue conferir se um
// e-mail ou IP está na tabela (um SHA-256 puro seria facilmente testável por dicionário).
//
// Regra de ouro: CONTA primeiro e só GRAVA a tentativa se o limite ainda não estourou. Assim o
// bloqueio expira sozinho (quem insiste durante o bloqueio não o prorroga) e a tabela não cresce
// além de `max` linhas por chave e janela. Limitação aceita: contar e gravar são dois passos, então
// requisições simultâneas podem passar do limite por poucas unidades; o custo é pequeno.
import { hashDaChave, TIPO_LOGIN } from "@/lib/chave-limite";
import { prisma } from "@/lib/db";

const UMA_HORA_MS = 60 * 60 * 1000;
// Nenhuma janela de limite é maior que 1 h; o dobro dá folga e mantém a tabela pequena.
export const RETENCAO_MS = 2 * UMA_HORA_MS;
// Chance de cada registro varrer as linhas vencidas (limpeza oportunista, sem cron). A varredura é
// barata: usa o índice de criadoEm e, com o teto acima, quase não há o que apagar.
const CHANCE_DE_LIMPEZA = 0.02;

export interface Limite {
  tipo: string;
  max: number;
  janelaMs: number;
}

export interface Tentativa {
  tipo: string;
  chave: string;
}

/** Um limite aplicado a uma chave (e-mail, IP…). */
export interface ItemLimite {
  limite: Limite;
  chave: string;
}

/** Apaga as tentativas mais velhas que a retenção (nenhuma janela de limite chega a tanto). */
export async function limparTentativasAntigas(): Promise<void> {
  await prisma.tentativaAcesso.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - RETENCAO_MS) } } });
}

/** Registra várias tentativas de uma vez (uma só ida ao banco). Não confere limite: veja registrarSeDentroDoLimite. */
export async function registrarTentativas(tentativas: Tentativa[]): Promise<void> {
  if (tentativas.length === 0) return;
  await prisma.tentativaAcesso.createMany({
    data: tentativas.map((t) => ({ tipo: t.tipo, chave: hashDaChave(t.chave) })),
  });
  if (Math.random() < CHANCE_DE_LIMPEZA) {
    try {
      await limparTentativasAntigas();
    } catch (e) {
      // A limpeza é só higiene: falhar nela não pode derrubar quem está tentando entrar.
      console.error("Falha ao limpar tentativas antigas", e);
    }
  }
}

export const registrarTentativa = (tipo: string, chave: string) => registrarTentativas([{ tipo, chave }]);

/** Quantas tentativas desse tipo/chave aconteceram nos últimos `janelaMs` milissegundos. */
export async function contarTentativas(tipo: string, chave: string, janelaMs: number): Promise<number> {
  return prisma.tentativaAcesso.count({
    where: { tipo, chave: hashDaChave(chave), criadoEm: { gte: new Date(Date.now() - janelaMs) } },
  });
}

/**
 * Confere os limites e, só se TODOS ainda tiverem folga (contagem < max), grava a tentativa em cada
 * um. Devolve true se a tentativa foi aceita e gravada; false se algum limite já estourou, caso em
 * que nada é gravado (o bloqueio não é prorrogado e a tabela não cresce).
 */
export async function registrarSeDentroDoLimite(itens: ItemLimite[]): Promise<boolean> {
  const contagens = await Promise.all(itens.map(({ limite, chave }) => contarTentativas(limite.tipo, chave, limite.janelaMs)));
  if (itens.some(({ limite }, i) => contagens[i] >= limite.max)) return false;
  await registrarTentativas(itens.map(({ limite, chave }) => ({ tipo: limite.tipo, chave })));
  return true;
}

/** Esquece todas as tentativas desse tipo/chave (ex.: login deu certo ou a senha foi redefinida). */
export async function limparTentativas(tipo: string, chave: string): Promise<void> {
  await prisma.tentativaAcesso.deleteMany({ where: { tipo, chave: hashDaChave(chave) } });
}

// --- Login: 8 tentativas em 10 minutos, por e-mail (não por IP: mais simples e suficiente para uma
// equipe pequena atrás de logins nominais; freia força bruta contra uma conta específica). A
// tentativa é gravada ANTES de conferir a senha e apagada no sucesso, então só as falhas ficam. ---
export const LIMITE_LOGIN: Limite = { tipo: TIPO_LOGIN, max: 8, janelaMs: 10 * 60 * 1000 };

/** Grava a tentativa de login. False = e-mail bloqueado (nada é gravado e a senha não deve ser conferida). */
export const registrarTentativaLogin = (email: string) => registrarSeDentroDoLimite([{ limite: LIMITE_LOGIN, chave: email }]);

export const limparTentativasLogin = (email: string) => limparTentativas(LIMITE_LOGIN.tipo, email);
