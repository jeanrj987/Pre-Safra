// Admin da região: de cada região, quem é o responsável padrão (o nomeResponsavel do usuário ativo que tem a
// região em Usuario.regioesAdmin). A regra de uso está em src/lib/responsavel.ts.
import { prisma } from "./db";
import { normalizar } from "./texto";

/** Região (normalizada: sem acento, minúscula, sem espaços nas pontas) -> nome do admin da região. */
export type AdminsPorRegiao = ReadonlyMap<string, string>;

const chaveRegiao = (regiao: string) => normalizar(regiao.trim());

export interface UsuarioAdminRegional {
  nomeResponsavel: string | null;
  regioesAdmin: readonly string[];
}

/**
 * Monta o mapa a partir dos usuários (já filtrados: ativos, que não são admin total nem somente Painel). Quem
 * não tem nome ligado à conta não pode ser responsável e fica de fora. Região com dois admins (o cadastro
 * não deveria permitir): vale o primeiro da lista, para o resultado não depender de sorte.
 */
export function montarAdminsPorRegiao(usuarios: readonly UsuarioAdminRegional[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const u of usuarios) {
    const nome = u.nomeResponsavel?.trim();
    if (!nome) continue;
    for (const regiao of u.regioesAdmin) {
      const chave = chaveRegiao(regiao);
      if (chave && !mapa.has(chave)) mapa.set(chave, nome);
    }
  }
  return mapa;
}

/** O admin dessa região, ou null se ela não tem um (ou se o cliente não tem região). */
export function adminDaRegiao(admins: AdminsPorRegiao, regiao: string | null | undefined): string | null {
  return regiao?.trim() ? (admins.get(chaveRegiao(regiao)) ?? null) : null;
}

/** Carrega, de uma vez, o admin de cada região (uma consulta, sem consulta por cliente). */
export async function carregarAdminsPorRegiao(): Promise<Map<string, string>> {
  const usuarios = await prisma.usuario.findMany({
    where: {
      ativo: true,
      admin: false,
      somentePainel: false,
      nomeResponsavel: { not: null },
      NOT: { regioesAdmin: { isEmpty: true } },
    },
    select: { nomeResponsavel: true, regioesAdmin: true },
    orderBy: { id: "asc" },
  });
  return montarAdminsPorRegiao(usuarios);
}
