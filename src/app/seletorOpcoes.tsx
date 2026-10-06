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

/** Pessoas com avatar, as da região primeiro. */
export function opcoesDePessoas(daRegiao: string[], outros: string[]): OpcaoSeletor[] {
  const resto = outros.filter((o) => !daRegiao.includes(o));
  const grupoResto = daRegiao.length ? "Outros" : "Responsáveis";
  const pessoa = (p: string, grupo: string): OpcaoSeletor => ({
    valor: p,
    rotulo: p,
    grupo,
    marca: <Avatar nome={p} />,
  });
  return [
    ...daRegiao.map((p) => pessoa(p, "Da região")),
    ...resto.map((p) => pessoa(p, grupoResto)),
  ];
}

/** Lista conhecida + o valor atual, caso seja um dado avulso que não está nela (senão a seleção "sumiria"). */
export const comValorAtual = (valor: string | null, lista: string[]) =>
  valor && !lista.includes(valor) ? [valor, ...lista] : lista;
