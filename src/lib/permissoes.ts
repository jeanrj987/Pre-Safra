// Permissões que um administrador pode liberar, uma a uma, para um usuário "Personalizado"
// (Admin → Usuários). O administrador total tem todas e é o único a gerenciar usuários: quem
// gerencia usuários poderia liberar qualquer coisa para si mesmo, por isso isso não se delega.
// Sem imports de servidor: a tela de edição (cliente) também usa este catálogo.

export interface ItemPermissao {
  chave: string;
  rotulo: string;
  descricao: string;
}

export interface GrupoPermissoes {
  titulo: string;
  itens: readonly ItemPermissao[];
}

export const GRUPOS_PERMISSOES = [
  {
    titulo: "Administração",
    itens: [
      { chave: "clientes", rotulo: "Clientes", descricao: "Editar, inativar, importar e exportar a base de clientes." },
      { chave: "safras", rotulo: "Safras", descricao: "Criar, editar, arquivar e excluir safras." },
      {
        chave: "sugestoes",
        rotulo: "Sugestões",
        descricao: "Moderar ideias, definir a meta de FAQ, ver anexos e exportar.",
      },
      { chave: "backup", rotulo: "Backup em Excel", descricao: "Baixar todas as tabelas em uma planilha." },
      { chave: "telao", rotulo: "Telão de ideias", descricao: "Ver o atalho do telão do evento no menu." },
    ],
  },
  {
    titulo: "No dia a dia",
    itens: [
      {
        chave: "todosClientes",
        rotulo: "Alterar clientes de qualquer responsável",
        descricao: "Sem isso, só altera os clientes do responsável ligado à conta.",
      },
      {
        chave: "trocarResp",
        rotulo: "Trocar ou limpar o responsável ao agendar",
        descricao: "Escolher quem atende o cliente ao agendar.",
      },
      {
        chave: "cadastrar",
        rotulo: "Criar e editar cadastros de clientes",
        descricao: "Usar “Criar cadastro” no registro e editar cidade, região e equipe do cliente.",
      },
      {
        chave: "atividades",
        rotulo: "Editar atividades de outras pessoas",
        descricao: "No Calendário, alterar, concluir ou excluir o que outros lançaram.",
      },
    ],
  },
] as const satisfies readonly GrupoPermissoes[];

export type Permissao = (typeof GRUPOS_PERMISSOES)[number]["itens"][number]["chave"];

export const TODAS_PERMISSOES: readonly Permissao[] = GRUPOS_PERMISSOES.flatMap((g) =>
  g.itens.map((i) => i.chave),
);

export const ROTULO_PERMISSAO: Record<Permissao, string> = Object.fromEntries(
  GRUPOS_PERMISSOES.flatMap((g) => g.itens.map((i) => [i.chave, i.rotulo])),
) as Record<Permissao, string>;

/** Permissões que dão acesso à área de Administração (abas e botão de backup). */
export const PERMISSOES_ADMIN: readonly Permissao[] = ["clientes", "safras", "sugestoes", "backup"];

export function permissaoValida(valor: string): valor is Permissao {
  return (TODAS_PERMISSOES as readonly string[]).includes(valor);
}

/** Do que vem do banco ou do formulário, só as permissões que existem, sem repetição. */
export function filtrarPermissoes(valores: readonly string[]): Permissao[] {
  return [...new Set(valores.filter(permissaoValida))];
}

/**
 * O que a conta pode de fato: o administrador total tem tudo; a conta "somente Painel" nada; as
 * demais, o que foi liberado para elas.
 */
export function permissoesEfetivas(usuario: {
  admin: boolean;
  somentePainel: boolean;
  permissoes: readonly string[];
}): Permissao[] {
  if (usuario.admin) return [...TODAS_PERMISSOES];
  if (usuario.somentePainel) return [];
  return filtrarPermissoes(usuario.permissoes);
}

export function pode(usuario: { permissoes: readonly string[] }, permissao: Permissao): boolean {
  return usuario.permissoes.includes(permissao);
}

/** Entra na área de Administração: administrador total ou quem tem alguma permissão de lá. */
export function podeAcessarAdmin(usuario: { admin: boolean; permissoes: readonly string[] }): boolean {
  return usuario.admin || PERMISSOES_ADMIN.some((p) => usuario.permissoes.includes(p));
}

export type Papel = "comum" | "personalizado" | "admin" | "painel";

/** O papel que a conta tem, deduzido dos campos salvos (não existe coluna própria para ele). */
export function papelDe(usuario: { admin: boolean; somentePainel: boolean; permissoes: readonly string[] }): Papel {
  if (usuario.admin) return "admin";
  if (usuario.somentePainel) return "painel";
  return filtrarPermissoes(usuario.permissoes).length > 0 ? "personalizado" : "comum";
}

export const ROTULO_PAPEL: Record<Papel, string> = {
  comum: "Comum",
  personalizado: "Personalizado",
  admin: "Administrador",
  painel: "Somente Painel",
};
