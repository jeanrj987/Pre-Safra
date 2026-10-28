// Itens de conferência marcados ao finalizar um cliente (janela "Finalizar Pré-Safra") e
// editáveis depois na página do registro. Cada chave é também uma coluna booleana de PreSafra
// e o prefixo do campo do formulário (`<chave>_<id>`), então acrescentar um item novo é
// acrescentar a coluna no schema e uma linha aqui.

export const ITENS_FINALIZACAO = [
  {
    chave: "melhoriasApresentadas",
    rotulo: "Melhorias apresentadas ao cliente",
    ajuda: "Marque se as novidades do sistema foram apresentadas.",
  },
  {
    chave: "sistemaAtualizado",
    rotulo: "Sistema atualizado",
    ajuda: "Marque se o cliente está na versão safra.",
  },
  {
    chave: "safraFechada",
    rotulo: "Fechamento da safra realizado",
    ajuda: "Marque se o fechamento da safra anterior foi feito.",
  },
  {
    chave: "safraNovaConfigurada",
    rotulo: "Safra nova configurada",
    ajuda: "Marque se a safra nova já foi configurada no sistema.",
  },
] as const;

export type ChaveItem = (typeof ITENS_FINALIZACAO)[number]["chave"];
export type MarcasFinalizacao = Record<ChaveItem, boolean>;

export const marcasVazias = (): MarcasFinalizacao => ({
  melhoriasApresentadas: false,
  sistemaAtualizado: false,
  safraFechada: false,
  safraNovaConfigurada: false,
});
