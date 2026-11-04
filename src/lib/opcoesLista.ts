import { pessoasDaDupla } from "./painel";
import { contemNome, normalizar, semRepetir } from "./texto";

// Opções das listas de escolha que a administração cadastra sozinha (tela Administração > Listas),
// sem depender de já existir um cliente com aquele valor.

export const TIPOS_OPCAO = ["regiao", "consultor", "responsavel", "atendimento", "comercial"] as const;
export type TipoOpcao = (typeof TIPOS_OPCAO)[number];

export const ehTipoOpcao = (valor: unknown): valor is TipoOpcao =>
  typeof valor === "string" && (TIPOS_OPCAO as readonly string[]).includes(valor);

/** Textos de cada lista na tela: título da seção, nome no singular, exemplo e ajuda do campo. */
export const TEXTOS_OPCAO: Record<
  TipoOpcao,
  { titulo: string; singular: string; semNome: string; repetida: string; exemplo: string; ajuda: string }
> = {
  regiao: {
    titulo: "Regiões",
    singular: "região",
    semNome: "Digite o nome da região.",
    repetida: "Já existe uma região com esse nome.",
    exemplo: "Ex.: Agro Integra a SP/PR/SC",
    ajuda: "Use o formato das demais: o nome, a letra a e as UFs separadas por barra. Ex.: Agro Integra a SP/PR/SC.",
  },
  consultor: {
    titulo: "Consultores",
    singular: "consultor",
    semNome: "Digite o nome do consultor.",
    repetida: "Já existe um consultor com esse nome.",
    exemplo: "Ex.: André",
    ajuda: "Escreva o nome como ele deve aparecer nas listas.",
  },
  responsavel: {
    titulo: "Responsáveis",
    singular: "responsável",
    semNome: "Digite o nome do responsável.",
    repetida: "Já existe um responsável com esse nome.",
    exemplo: "Ex.: Maria",
    ajuda: "Escreva o nome como ele deve aparecer nas listas e na ligação com o usuário.",
  },
  atendimento: {
    titulo: "Atendimento",
    singular: "atendente ou dupla de atendimento",
    semNome: "Digite o nome do atendente ou os nomes da dupla de atendimento.",
    repetida: "Já existe um atendimento com esse nome ou com esses nomes.",
    exemplo: "Ex.: Maria ou Maria e Jean",
    ajuda: "Escreva o nome de um atendente ou de uma dupla, com os dois nomes separados por \"e\". Ex.: Maria ou Maria e Jean.",
  },
  comercial: {
    titulo: "Comercial",
    singular: "comercial",
    semNome: "Digite o nome do comercial.",
    repetida: "Já existe um comercial com esse nome.",
    exemplo: "Ex.: Sidinei",
    ajuda: "Escreva o nome da pessoa do comercial como ele deve aparecer nas listas.",
  },
};

/** Tamanho máximo do nome de uma opção (as regiões mais longas passam pouco de 30 caracteres). */
export const NOME_OPCAO_MAXIMO = 60;

/** Tira espaços das pontas e junta os repetidos no meio ("Agro   Integra " vira "Agro Integra"). */
export const limparNomeOpcao = (nome: string) => nome.replace(/\s+/g, " ").trim();

/**
 * Confere o nome digitado e devolve o nome limpo, ou o motivo de não servir. `cadastradas` são as
 * opções já cadastradas daquele tipo: o nome não pode repetir nenhuma, ignorando maiúsculas,
 * acentos e espaços ("sao paulo" repete "São Paulo").
 */
export function validarNomeOpcao(
  tipo: TipoOpcao,
  bruto: string,
  cadastradas: readonly string[],
): { nome: string } | { erro: string } {
  const nome = limparNomeOpcao(bruto);
  const textos = TEXTOS_OPCAO[tipo];
  if (!nome) return { erro: textos.semNome };
  if (nome.length > NOME_OPCAO_MAXIMO) {
    return { erro: `O nome pode ter no máximo ${NOME_OPCAO_MAXIMO} caracteres.` };
  }
  // Quebras de linha e tabulações já viraram espaço acima; sobram só os demais caracteres de controle.
  if (/\p{Cc}/u.test(nome)) return { erro: "O nome tem caracteres que não podem ser usados." };
  // Atendimento: um atendente ou uma dupla (duas pessoas separadas por " e ", a mesma regra de
  // pessoasDaDupla). Partes vazias ("Maria e", "e Jean") e três ou mais pessoas não servem.
  if (tipo === "atendimento") {
    const pessoas = pessoasDaDupla(nome);
    // Um "e" sobrando na ponta de um nome ("Maria e", "e Jean") é uma parte vazia.
    const parteVazia = pessoas.some((p) => /^e(\s|$)|(^|\s)e$/i.test(p));
    if (pessoas.length < 1 || pessoas.length > 2 || parteVazia) {
      return { erro: 'Escreva um nome ou dois nomes separados por "e". Ex.: Maria ou Maria e Jean.' };
    }
  }
  if (contemNome([...cadastradas], nome)) return { erro: textos.repetida };
  return { nome };
}

/**
 * Junta várias listas de nomes numa só, sem repetição (ignorando maiúsculas, acentos e espaços nas
 * pontas) e em ordem alfabética. Vale a grafia da primeira lista em que o nome aparece; por isso as
 * fixas e as cadastradas vêm antes das tiradas dos clientes.
 */
export function mesclarOpcoes(...listas: readonly (readonly (string | null | undefined)[])[]): string[] {
  const nomes = listas.flat().filter((n): n is string => typeof n === "string");
  return semRepetir(nomes.map((n) => n.trim())).sort(
    (a, b) => a.localeCompare(b, "pt-BR") || normalizar(a).localeCompare(normalizar(b)),
  );
}
