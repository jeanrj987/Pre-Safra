// Minúsculas e sem acento, para comparar nomes na busca.
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Tira os nomes repetidos, mesmo que difiram só na caixa, no acento ou nos espaços ("jose" e "José "),
// mantendo a primeira grafia. Os filtros e as listas comparam por normalizar(), então a lista não
// pode oferecer duas vezes a mesma pessoa.
export function semRepetir(nomes: string[]): string[] {
  const vistos = new Set<string>();
  return nomes.filter((n) => {
    const chave = normalizar(n.trim());
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** O nome está na lista, ignorando caixa, acento e espaços nas pontas? */
export const contemNome = (lista: string[], nome: string) => {
  const chave = normalizar(nome.trim());
  return lista.some((n) => normalizar(n.trim()) === chave);
};

// "1 cliente", "3 clientes".
export const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

// Padrão dos nomes de cliente: tudo em maiúsculas, sem espaços sobrando nas pontas ou no meio.
export const nomeMaiusculo = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
