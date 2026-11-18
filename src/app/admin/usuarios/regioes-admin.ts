// Regras do papel "Admin da região" no cadastro de usuários: cada região tem no máximo um admin
// regional ativo, o papel exige ao menos uma região e um nome ligado na lista de responsáveis.
// Funções puras (sem banco): as Server Actions de page.tsx só buscam os dados e chamam estas.
import { normalizar } from "@/lib/texto";

/** O que interessa de cada conta para saber quem ocupa uma região. */
export interface ContaComRegioes {
  id: number;
  nome: string;
  ativo: boolean;
  regioesAdmin: readonly string[];
}

/** Quem ocupa cada região (chave sem acento e em minúsculas): só contas ativas, exceto `ignorarId`. */
function donosDasRegioes(contas: readonly ContaComRegioes[], ignorarId?: number): Map<string, string> {
  const donos = new Map<string, string>();
  for (const c of contas) {
    if (!c.ativo || c.id === ignorarId) continue;
    for (const r of c.regioesAdmin) {
      const chave = normalizar(r.trim());
      if (chave && !donos.has(chave)) donos.set(chave, c.nome);
    }
  }
  return donos;
}

/** Para cada região da lista já ocupada por outra conta ativa, o nome de quem a ocupa. */
export function regioesOcupadas(
  contas: readonly ContaComRegioes[],
  regioes: readonly string[],
  ignorarId?: number,
): Record<string, string> {
  const donos = donosDasRegioes(contas, ignorarId);
  const resultado: Record<string, string> = {};
  for (const r of regioes) {
    const dono = donos.get(normalizar(r.trim()));
    if (dono) resultado[r] = dono;
  }
  return resultado;
}

/** Regiões que já têm outro admin regional ativo, com o nome da conta (ao reativar uma conta, por exemplo). */
export function conflitosDeRegioes(
  regioes: readonly string[],
  contas: readonly ContaComRegioes[],
  ignorarId?: number,
): { regiao: string; dono: string }[] {
  const donos = donosDasRegioes(contas, ignorarId);
  return regioes.flatMap((regiao) => {
    const dono = donos.get(normalizar(regiao.trim()));
    return dono ? [{ regiao, dono }] : [];
  });
}

/** Frase para o aviso de conflito, ex.: "Leste MT (conta de Maria) e Sul PR (conta de João)". */
export function descreverConflitos(conflitos: readonly { regiao: string; dono: string }[]): string {
  const partes = conflitos.map((c) => `${c.regiao} (conta de ${c.dono})`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}` : (partes[0] ?? "");
}

/**
 * Confere os dados de um Admin da região e devolve as regiões a gravar (com a grafia da lista, sem
 * repetição) ou o motivo de não servir. Regiões que não estão em `regioesValidas` são ignoradas.
 * `conferirOcupacao` é falso ao salvar uma conta inativa: o conflito é conferido quando ela voltar a ficar ativa.
 */
export function validarAcessoRegional({
  regioesEscolhidas,
  regioesValidas,
  nomeResponsavel,
  outrasContas,
  ignorarId,
  conferirOcupacao = true,
}: {
  regioesEscolhidas: readonly string[];
  regioesValidas: readonly string[];
  nomeResponsavel: string | null;
  outrasContas: readonly ContaComRegioes[];
  ignorarId?: number;
  conferirOcupacao?: boolean;
}): { regioes: string[] } | { erro: string } {
  const porChave = new Map(regioesValidas.map((r) => [normalizar(r.trim()), r.trim()] as const));
  const regioes = [
    ...new Set(regioesEscolhidas.flatMap((r) => porChave.get(normalizar(r.trim())) ?? [])),
  ];
  if (regioes.length === 0) return { erro: "Escolha ao menos uma região para o Admin da região." };
  if (!nomeResponsavel) {
    return { erro: "O Admin da região precisa estar ligado a um nome da lista de responsáveis." };
  }
  if (conferirOcupacao) {
    const conflitos = conflitosDeRegioes(regioes, outrasContas, ignorarId);
    if (conflitos.length > 0) {
      return {
        erro: `${
          conflitos.length > 1 ? "Estas regiões já têm" : "Esta região já tem"
        } um Admin da região: ${descreverConflitos(conflitos)}. Cada região só pode ter um; retire-a${
          conflitos.length > 1 ? "s" : ""
        } dessa conta antes.`,
      };
    }
  }
  return { regioes };
}
