// Guarda quais sugestões estão marcadas na lista, sobrevivendo à troca de página: cada página
// é uma nova resposta do servidor, então a marcação não pode viver só no checkbox. Usa
// sessionStorage (dura a aba) e fica separada da seleção de clientes (../../selecao.ts) para
// que as duas listas nunca se misturem. Segue o contrato do useSyncExternalStore.
const CHAVE = "presafra:selecao-sugestoes";
const VAZIO: number[] = [];

const ouvintes = new Set<() => void>();
// null = ainda não lida do sessionStorage. A referência só muda quando a seleção muda, que é
// o que o useSyncExternalStore exige de um snapshot estável.
let atual: number[] | null = null;

function ler(): number[] {
  if (atual === null) {
    try {
      const bruto = JSON.parse(sessionStorage.getItem(CHAVE) ?? "[]");
      atual = Array.isArray(bruto) ? bruto.filter(Number.isInteger) : [];
    } catch {
      atual = [];
    }
  }
  return atual;
}

function gravar(ids: number[]) {
  atual = ids;
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(ids));
  } catch {
    // Armazenamento indisponível (ex.: navegação privada) — a seleção só dura enquanto a
    // página continuar aberta.
  }
  ouvintes.forEach((o) => o());
}

export function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export const instantaneo = ler;
export const instantaneoServidor = () => VAZIO;

export function marcar(ids: number[], marcado: boolean) {
  const conjunto = new Set(ler());
  ids.forEach((id) => (marcado ? conjunto.add(id) : conjunto.delete(id)));
  gravar([...conjunto]);
}

export function limpar() {
  gravar([]);
}
