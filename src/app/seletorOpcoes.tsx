import { TITULO_DA_REGIAO, type GrupoEquipe } from "@/lib/equipe";
import Icone from "./Icone";
import type { OpcaoSeletor } from "./Seletor";

// Montagem das opções do Seletor. Fica fora de Seletor.tsx (que é "use client") para poder ser
// chamado também por componentes de servidor.

const TOM_AVATAR = {
  destaque: "bg-finalizado-bg text-finalizado-fg",
  neutro: "bg-subtle text-muted",
  normal: "bg-primary-soft text-primary",
};

/** Com `safra`, uma estrela dourada no canto do avatar marca o responsável da Pré-Safra da dupla. */
export function Avatar({ nome, tom, safra = false }: { nome: string; tom?: keyof typeof TOM_AVATAR; safra?: boolean }) {
  return (
    <span aria-hidden="true" className="relative shrink-0">
      <span
        className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold uppercase ${TOM_AVATAR[tom ?? "normal"]}`}
      >
        {nome.trim().charAt(0)}
      </span>
      {safra && (
        <span
          title="Responsável da Pré-Safra"
          className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-afazer-dot text-[#3a2a00] ring-2 ring-surface"
        >
          <Icone nome="estrela" className="size-2.5 fill-current" />
        </span>
      )}
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
 * Quem responde pela Pré-Safra da dupla (`safra`) ganha a folhinha no avatar, em cada grupo em que aparece.
 */
export function opcoesDePessoas(grupos: GrupoEquipe[], outros: string[] = []): OpcaoSeletor[] {
  const jaListados = new Set(grupos.flatMap((g) => g.pessoas.map((p) => p.nome)));
  // Só há "indicados" quando o cliente tem região; sem eles, ninguém fica em cinza.
  const haIndicados = grupos.some((g) => g.titulo === TITULO_DA_REGIAO);
  const restantes = [...new Set(outros)].filter((n) => !jaListados.has(n));
  return [
    ...grupos.flatMap((g) =>
      g.pessoas.map((p) => {
        // Quem é da região do cliente é o indicado (verde); as demais regiões ficam em cinza.
        const tom = g.titulo === TITULO_DA_REGIAO ? ("destaque" as const) : haIndicados ? ("neutro" as const) : undefined;
        return { valor: p.nome, rotulo: p.nome, grupo: g.titulo, marca: <Avatar nome={p.nome} tom={tom} safra={!!p.safra} />, detalhe: p.papel, tom };
      }),
    ),
    ...restantes.map((n) => ({
      valor: n,
      rotulo: n,
      grupo: grupos.length ? "Outros" : "Responsáveis",
      marca: <Avatar nome={n} tom={haIndicados ? "neutro" : "normal"} />,
      tom: haIndicados ? ("neutro" as const) : undefined,
    })),
  ];
}

/** Lista conhecida + o valor atual, caso seja um dado avulso que não está nela (senão a seleção "sumiria"). */
export const comValorAtual = (valor: string | null, lista: string[]) =>
  valor && !lista.includes(valor) ? [valor, ...lista] : lista;
