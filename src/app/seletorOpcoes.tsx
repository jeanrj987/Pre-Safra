import type { GrupoEquipe } from "@/lib/equipe";
import type { OpcaoSeletor } from "./Seletor";

// Montagem das opções do Seletor. Fica fora de Seletor.tsx (que é "use client") para poder ser
// chamado também por componentes de servidor.

export function Avatar({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold uppercase text-primary"
    >
      {nome.trim().charAt(0)}
    </span>
  );
}

/** Bolinha de cor; as cores seguem as da tabela (azul Online, roxo Presencial). */
export function Bolinha({ cor }: { cor: "agendado" | "presencial" }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2.5 shrink-0 rounded-full ${cor === "agendado" ? "bg-agendado-dot" : "bg-presencial-dot"}`}
    />
  );
}

/** Uma opção por texto. */
export const opcoesDeLista = (lista: readonly string[]): OpcaoSeletor[] =>
  lista.map((v) => ({ valor: v, rotulo: v }));

/**
 * Pessoas com avatar, uma seção por grupo (ex.: "Da região", depois cada região), com o papel
 * ao lado do nome. `outros` são nomes sem região, listados no fim sem quem já apareceu antes.
 */
export function opcoesDePessoas(grupos: GrupoEquipe[], outros: string[] = []): OpcaoSeletor[] {
  const jaListados = new Set(grupos.flatMap((g) => g.pessoas.map((p) => p.nome)));
  const restantes = [...new Set(outros)].filter((n) => !jaListados.has(n));
  return [
    ...grupos.flatMap((g) =>
      g.pessoas.map((p) => ({ valor: p.nome, rotulo: p.nome, grupo: g.titulo, marca: <Avatar nome={p.nome} />, detalhe: p.papel })),
    ),
    ...restantes.map((n) => ({
      valor: n,
      rotulo: n,
      grupo: grupos.length ? "Outros" : "Responsáveis",
      marca: <Avatar nome={n} />,
    })),
  ];
}

/** Lista conhecida + o valor atual, caso seja um dado avulso que não está nela (senão a seleção "sumiria"). */
export const comValorAtual = (valor: string | null, lista: string[]) =>
  valor && !lista.includes(valor) ? [valor, ...lista] : lista;
