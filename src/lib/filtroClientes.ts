import { normalizar } from "./texto";

// Filtros por coluna da tela Admin → Clientes (estilo autofiltro do Excel).
//
// Formato na URL: um parâmetro repetido por coluna, com o nome da coluna em minúsculas e um
// parâmetro para cada valor marcado. Exemplo:
//   /admin/clientes?regiao=Sorriso&regiao=Lucas do Rio Verde&situacao=Ativo&regiao=__vazio__
// Cada valor é um parâmetro inteiro, então vírgulas e barras no texto não atrapalham. As células
// vazias usam o valor especial VALOR_VAZIO. A comparação ignora caixa, acento e espaços nas pontas.
// Sem nenhum parâmetro da coluna, ela não filtra nada.

export const COLUNAS_FILTRO = [
  "nome",
  "cidade",
  "uf",
  "regiao",
  "atendimento",
  "consultor",
  "comercial",
  "situacao",
] as const;

export type ColunaFiltro = (typeof COLUNAS_FILTRO)[number];

/** Valor de URL que representa as células vazias de uma coluna. */
export const VALOR_VAZIO = "__vazio__";

export type Situacao = "Ativo" | "Inativo" | "Fora desta safra";

/** Só os campos de que os filtros precisam (serve ao registro do Prisma e a objetos de teste). */
export type ClienteFiltravel = {
  nome: string;
  cidade?: string | null;
  uf?: string | null;
  regiao?: string | null;
  atendente?: string | null;
  consultor?: string | null;
  comercial?: string | null;
  situacao: Situacao;
};

export type FiltrosColuna = Partial<Record<ColunaFiltro, string[]>>;

export type OpcaoFiltro = {
  /** Valor que vai para a URL. */
  valor: string;
  /** Texto mostrado na lista. */
  rotulo: string;
  /** Quantos clientes têm esse valor, com os outros filtros já aplicados. */
  quantidade: number;
  /** Faz parte do filtro atual da coluna. */
  marcada: boolean;
};

export const ROTULO_COLUNA: Record<ColunaFiltro, string> = {
  nome: "Nome",
  cidade: "Cidade",
  uf: "UF",
  regiao: "Região",
  atendimento: "Atendimento",
  consultor: "Consultor",
  comercial: "Comercial",
  situacao: "Situação",
};

/** Como a lista chama as células vazias: na região é "Sem região", como na tabela. */
export const ROTULO_VAZIO: Record<ColunaFiltro, string> = {
  nome: "(Vazias)",
  cidade: "(Vazias)",
  uf: "(Vazias)",
  regiao: "Sem região",
  atendimento: "(Vazias)",
  consultor: "(Vazias)",
  comercial: "(Vazias)",
  situacao: "(Vazias)",
};

export const situacaoDoCliente = (preSafra: { inativo: boolean } | undefined | null): Situacao =>
  !preSafra ? "Fora desta safra" : preSafra.inativo ? "Inativo" : "Ativo";

/** Texto da célula do cliente naquela coluna, sem espaços nas pontas ("" quando vazia). */
export function valorDaColuna(c: ClienteFiltravel, coluna: ColunaFiltro): string {
  const bruto = {
    nome: c.nome,
    cidade: c.cidade,
    uf: c.uf,
    regiao: c.regiao,
    atendimento: c.atendente,
    consultor: c.consultor,
    comercial: c.comercial,
    situacao: c.situacao,
  }[coluna];
  return (bruto ?? "").trim();
}

// Chave de comparação: "" (vazio) e VALOR_VAZIO viram a mesma coisa.
const chaveDoValor = (valor: string) => (valor === VALOR_VAZIO ? "" : normalizar(valor.trim()));
const chaveDaCelula = (c: ClienteFiltravel, coluna: ColunaFiltro) => normalizar(valorDaColuna(c, coluna));

type ParametrosBrutos = Record<string, string | string[] | undefined>;

/** Lê os filtros de coluna dos searchParams da página (ignora valores em branco e repetidos). */
export function lerFiltros(sp: ParametrosBrutos): FiltrosColuna {
  const filtros: FiltrosColuna = {};
  for (const coluna of COLUNAS_FILTRO) {
    const bruto = sp[coluna];
    const valores = (Array.isArray(bruto) ? bruto : bruto ? [bruto] : []).filter((v) => v.trim() !== "");
    const vistos = new Set<string>();
    const unicos = valores.filter((v) => {
      const chave = chaveDoValor(v);
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
    if (unicos.length > 0) filtros[coluna] = unicos;
  }
  return filtros;
}

export const temFiltroDeColuna = (filtros: FiltrosColuna) =>
  COLUNAS_FILTRO.some((coluna) => (filtros[coluna]?.length ?? 0) > 0);

/** Colunas que estão filtrando agora, na ordem da tabela. */
export const colunasFiltradas = (filtros: FiltrosColuna): ColunaFiltro[] =>
  COLUNAS_FILTRO.filter((coluna) => (filtros[coluna]?.length ?? 0) > 0);

/** Aplica os filtros de coluna; `ignorar` deixa uma coluna de fora (para listar as opções dela). */
export function aplicarFiltros<T extends ClienteFiltravel>(
  clientes: T[],
  filtros: FiltrosColuna,
  ignorar?: ColunaFiltro,
): T[] {
  const ativos = colunasFiltradas(filtros)
    .filter((coluna) => coluna !== ignorar)
    .map((coluna) => ({ coluna, chaves: new Set((filtros[coluna] ?? []).map(chaveDoValor)) }));
  if (ativos.length === 0) return clientes;
  return clientes.filter((c) => ativos.every(({ coluna, chaves }) => chaves.has(chaveDaCelula(c, coluna))));
}

/**
 * Valores da coluna para a lista de marcação, como no Excel: só os que existem entre os clientes
 * que passam pelos filtros das OUTRAS colunas (`clientes` já vem com busca, "sem região" e
 * "inativos" aplicados). Ordem alfabética pt-BR sem considerar acento; as vazias vão por último.
 * Valores já marcados que sumiram dessa visão continuam na lista, com quantidade 0, para a pessoa
 * poder desmarcá-los.
 */
export function opcoesDaColuna(
  clientes: ClienteFiltravel[],
  filtros: FiltrosColuna,
  coluna: ColunaFiltro,
): OpcaoFiltro[] {
  const marcadas = new Set((filtros[coluna] ?? []).map(chaveDoValor));
  const grupos = new Map<string, { valor: string; quantidade: number }>();
  for (const c of aplicarFiltros(clientes, filtros, coluna)) {
    const texto = valorDaColuna(c, coluna);
    const chave = normalizar(texto);
    const grupo = grupos.get(chave);
    if (grupo) grupo.quantidade += 1;
    else grupos.set(chave, { valor: texto === "" ? VALOR_VAZIO : texto, quantidade: 1 });
  }
  for (const valor of filtros[coluna] ?? []) {
    const chave = chaveDoValor(valor);
    if (!grupos.has(chave)) grupos.set(chave, { valor, quantidade: 0 });
  }

  const opcoes = [...grupos.entries()].map(([chave, g]) => ({
    chave,
    valor: g.valor,
    rotulo: g.valor === VALOR_VAZIO ? ROTULO_VAZIO[coluna] : g.valor,
    quantidade: g.quantidade,
    marcada: marcadas.has(chave),
  }));
  opcoes.sort((a, b) => {
    if ((a.chave === "") !== (b.chave === "")) return a.chave === "" ? 1 : -1;
    return a.chave.localeCompare(b.chave, "pt-BR", { numeric: true });
  });
  return opcoes.map(({ valor, rotulo, quantidade, marcada }) => ({ valor, rotulo, quantidade, marcada }));
}

/** Parâmetros de URL dos filtros de coluna (um por valor), para montar links e campos escondidos. */
export function paresDosFiltros(filtros: FiltrosColuna): [ColunaFiltro, string][] {
  return COLUNAS_FILTRO.flatMap((coluna) =>
    (filtros[coluna] ?? []).map((valor): [ColunaFiltro, string] => [coluna, valor]),
  );
}

/** Texto curto para o resumo dos filtros ativos: "Sorriso, Lucas do Rio Verde e mais 1". */
export function resumoDoFiltro(valores: string[], coluna: ColunaFiltro, maximo = 2): string {
  const rotulos = valores.map((v) => (v === VALOR_VAZIO ? ROTULO_VAZIO[coluna] : v));
  if (rotulos.length <= maximo) return rotulos.join(", ");
  const resto = rotulos.length - maximo;
  return `${rotulos.slice(0, maximo).join(", ")} e mais ${resto}`;
}
