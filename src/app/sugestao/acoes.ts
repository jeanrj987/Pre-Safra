"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { listarPerguntasFaq } from "@/lib/faq";
import { acharPerguntaParecida } from "@/lib/similaridade";
import { LIMITE_ENVIOS, LIMITES, limparTexto, normalizarTopico } from "@/lib/sugestoes";
import { normalizarWhatsapp } from "@/lib/whatsapp";

export type Resultado =
  // revisar: salva porque a pessoa insistiu, mas a equipe ainda precisa conferir a semelhança
  | { status: "salva"; revisar?: boolean }
  // Já existe algo parecido no FAQ: nada foi salvo, a pessoa decide se muda a ideia ou insiste
  | { status: "faq"; pergunta: string }
  | { status: "erro"; mensagem: string };

const erro = (mensagem: string): Resultado => ({ status: "erro", mensagem });

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const UMA_HORA_MS = 60 * 60 * 1000;
const UM_MINUTO_MS = 60 * 1000;

// Sem Redis: conta no próprio banco (índices em criadoEm e em whatsapp+criadoEm). O teto por
// WhatsApp é folgado para quem tem várias ideias; o geral segura quem varia o número.
async function excedeuLimiteDeEnvios(whatsapp: string): Promise<boolean> {
  const agora = Date.now();
  const [doNumero, total] = await Promise.all([
    prisma.sugestao.count({ where: { whatsapp, criadoEm: { gte: new Date(agora - UMA_HORA_MS) } } }),
    prisma.sugestao.count({ where: { criadoEm: { gte: new Date(agora - UM_MINUTO_MS) } } }),
  ]);
  return doNumero >= LIMITE_ENVIOS.porWhatsappPorHora || total >= LIMITE_ENVIOS.totalPorMinuto;
}

// Rota PÚBLICA de propósito (qualquer pessoa com o QR code envia): por isso valida tudo no
// servidor e ignora o que o cliente disser sobre tamanhos.
export async function enviarSugestao(entrada: unknown): Promise<Resultado> {
  const dados = (typeof entrada === "object" && entrada !== null ? entrada : {}) as Record<
    string,
    unknown
  >;

  // Campo invisível para gente: quem preenche é robô. Finge que deu certo e não salva nada.
  if (limparTexto(dados.site)) return { status: "salva" };

  const nome = limparTexto(dados.nome);
  const topico = limparTexto(dados.topico);
  const texto = limparTexto(dados.texto);
  const whatsapp = normalizarWhatsapp(String(dados.whatsapp ?? ""));
  const confirmar = dados.confirmar === true;

  if (nome.length < LIMITES.nome.min || nome.length > LIMITES.nome.max) {
    return erro("Informe seu nome.");
  }
  if (!whatsapp) {
    return erro("Confira o WhatsApp: informe o DDD e o número, por exemplo (66) 99999-8888.");
  }
  if (topico.length < LIMITES.topico.min || topico.length > LIMITES.topico.max) {
    return erro(`Informe o assunto em até ${LIMITES.topico.max} caracteres.`);
  }
  // O texto da sugestão não tem mínimo, só não pode ficar vazio; o máximo evita que alguém
  // encha o banco e o telão (rota pública).
  if (!texto) return erro("Descreva sua sugestão.");
  if (texto.length > LIMITES.texto.max) {
    return erro(`A sugestão pode ter no máximo ${LIMITES.texto.max} caracteres.`);
  }

  try {
    if (await excedeuLimiteDeEnvios(whatsapp)) {
      return erro("Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo.");
    }

    const repetida = await prisma.sugestao.findFirst({
      where: { whatsapp, texto, criadoEm: { gte: new Date(Date.now() - UM_DIA_MS) } },
      select: { id: true },
    });
    if (repetida) return erro("Você já enviou essa mesma sugestão. Obrigado!");

    const parecida = acharPerguntaParecida(texto, await listarPerguntasFaq());
    if (parecida && !confirmar) return { status: "faq", pergunta: parecida.item.pergunta };

    await prisma.sugestao.create({
      data: {
        nome,
        whatsapp,
        topico,
        topicoNorm: normalizarTopico(topico),
        texto,
        // Só chega aqui com uma parecida se a pessoa escolheu "enviar mesmo assim"
        possivelDuplicada: !!parecida,
        faqParecida: parecida?.item.pergunta ?? null,
      },
    });
    revalidatePath("/admin/sugestoes");
    return { status: "salva", revisar: !!parecida };
  } catch (e) {
    console.error("Falha ao salvar sugestão", e);
    return erro("Não foi possível salvar agora. Tente novamente em instantes.");
  }
}
