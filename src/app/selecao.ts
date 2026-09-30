// Guarda quais clientes estão marcados na lista, sobrevivendo a buscas/paginação: cada uma
// dessas ações navega para uma nova página (novo recorte de linhas), então uma linha marcada
// que a busca "esconde" (deixa de vir na resposta do servidor) perderia a marcação se ela
// vivesse só no atributo `checked` do checkbox. Usa sessionStorage (dura a aba, não o
// navegador todo) guardando também o nome, já que o checkbox de um cliente escondido pela
// busca não está mais no DOM para ser lido depois.
const CHAVE = "presafra:selecao";
const CAIXAS = 'input[name="ids"]';

function lerMapa(): Map<string, string> {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return new Map(bruto ? JSON.parse(bruto) : []);
  } catch {
    return new Map();
  }
}

function gravarMapa(mapa: Map<string, string>) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify([...mapa]));
  } catch {
    // Armazenamento indisponível (ex.: navegação privada) — a seleção só dura enquanto o
    // checkbox continuar no DOM, igual ao comportamento antes desta persistência existir.
  }
}

export function caixasVisiveis(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>(CAIXAS));
}

/** Leva o que está marcado na tela agora para o armazenamento persistido. */
export function sincronizarSelecao() {
  const mapa = lerMapa();
  caixasVisiveis().forEach((c) => {
    if (c.checked) mapa.set(c.value, c.dataset.cliente ?? c.value);
    else mapa.delete(c.value);
  });
  gravarMapa(mapa);
}

/** Aplica a seleção persistida às caixas da tela (ex.: depois de uma busca trazer de volta
 * um cliente que já estava marcado). Avisa quem escuta "change" quando muda algo. */
export function restaurarSelecao() {
  const mapa = lerMapa();
  let mudou = false;
  caixasVisiveis().forEach((c) => {
    if (mapa.has(c.value) && !c.checked) {
      c.checked = true;
      mudou = true;
    }
  });
  if (mudou) document.dispatchEvent(new Event("change"));
}

/** Todos os clientes marcados, incluindo os que a busca/paginação escondeu da tela agora. */
export function lerSelecionados(): { id: string; nome: string }[] {
  sincronizarSelecao();
  return [...lerMapa()].map(([id, nome]) => ({ id, nome }));
}

/** Limpa a seleção inteira — usada tanto pelo botão "Limpar seleção" quanto depois de uma
 * ação em lote concluída (os clientes agiu não devem continuar marcados). */
export function limparSelecao() {
  gravarMapa(new Map());
  caixasVisiveis().forEach((c) => (c.checked = false));
  document.dispatchEvent(new Event("change"));
}
