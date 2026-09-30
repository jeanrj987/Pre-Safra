// Minúsculas e sem acento, para comparar nomes na busca.
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// "1 cliente", "3 clientes".
export const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;
