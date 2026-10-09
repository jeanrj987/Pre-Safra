// Minúsculas e sem acento, para comparar nomes na busca.
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// "1 cliente", "3 clientes".
export const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

// Padrão dos nomes de cliente: tudo em maiúsculas, sem espaços sobrando nas pontas ou no meio.
export const nomeMaiusculo = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
