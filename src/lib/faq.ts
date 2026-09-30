import faq from "@/data/faq.json";

export interface PerguntaFaq {
  pergunta: string;
}

// ÚNICO ponto que conhece a origem do FAQ. Devolve os títulos dos artigos publicados na Base de
// Conhecimento, extraídos do backup por `npm run gerar-faq` (src/data/faq.json). Para atualizar,
// exporte um backup novo e rode o script de novo. Se um dia a fonte virar consulta ao banco ou
// API, troque só o corpo desta função mantendo o retorno { pergunta }[] — o formulário e a
// comparação não mudam. Se a fonte for lenta, embrulhe em cache.
export async function listarPerguntasFaq(): Promise<PerguntaFaq[]> {
  return faq;
}
