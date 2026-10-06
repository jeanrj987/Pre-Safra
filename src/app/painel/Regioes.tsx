"use client";
import { COR, nf } from "./cores";
import { SEM_REGIAO } from "./filtros";
import { SITUACOES, situacao, type ClientePainel, type Regiao, type Situacao } from "@/lib/painel";
import { plural } from "@/lib/texto";

interface Grupo {
  nome: string;
  curto: string;
  cobre: string;
  atendentes: string;
  semRegiao: boolean;
}

// Uma linha de cartões, um por região. O cartão selecionado filtra o painel inteiro.
export default function Regioes({
  clientes,
  regioes,
  hoje,
  selecionada,
  onSelecionar,
}: {
  /** Clientes já filtrados, exceto pela região (para as quatro regiões continuarem visíveis). */
  clientes: ClientePainel[];
  regioes: Regiao[];
  hoje: number;
  selecionada: string;
  onSelecionar: (nome: string) => void;
}) {
  const grupos: Grupo[] = [
    ...regioes.map((r) => ({ ...r, semRegiao: false })),
    { nome: SEM_REGIAO, curto: SEM_REGIAO, cobre: "", atendentes: "", semRegiao: true },
  ];

  const dados = grupos.map((g) => {
    const set = clientes.filter((c) => (c.regiao ?? SEM_REGIAO) === g.nome);
    const por: Record<Situacao, number> = { F: 0, A: 0, T: 0, S: 0 };
    set.forEach((c) => por[situacao(c, hoje)]++);
    return { g, n: set.length, por, pct: set.length ? por.F / set.length : 0 };
  });

  const reais = dados.filter((d) => !d.g.semRegiao && d.n > 0);
  const sem = dados[dados.length - 1];
  const menor = [...reais].sort((a, b) => a.pct - b.pct)[0];
  const maisAtrasos = [...reais].sort((a, b) => b.por.T - a.por.T)[0];

  const titulo = !reais.length
    ? "Nenhum cliente com região neste recorte"
    : reais.every((d) => d.por.F === 0)
      ? "Nenhuma região finalizou clientes ainda"
      : `${menor.g.nome} tem o menor avanço (${Math.round(menor.pct * 100)}%)${
        maisAtrasos.por.T > 0
          ? maisAtrasos === menor
            ? ` e mais atrasos (${maisAtrasos.por.T})`
            : ` e ${maisAtrasos.g.nome} concentra mais atrasos (${maisAtrasos.por.T})`
          : ""
      }`;
  const aviso = sem.n ? ` ${plural(sem.n, "cliente está", "clientes estão")} sem região definida no cadastro.` : "";

  return (
    <section aria-label="Regiões">
      <div className="mb-2">
        <h2 className="text-base font-semibold leading-snug">{titulo}</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          Andamento por região de atendimento.{aviso} Clique em uma região para filtrar o painel inteiro.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
        {dados
          .filter((d) => !d.g.semRegiao || d.n > 0 || selecionada === d.g.nome)
          .map(({ g, n, por, pct }) => {
            const sel = selecionada === g.nome;
            return (
              <button
                key={g.nome}
                type="button"
                aria-pressed={sel}
                onClick={() => onSelecionar(sel ? "" : g.nome)}
                aria-label={`${g.nome}: ${Math.round(pct * 100)}% finalizado, ${plural(n, "cliente", "clientes")}, ${por.T} atrasados${g.atendentes ? `. Atendentes: ${g.atendentes}` : ""}`}
                className={`card flex min-w-0 cursor-pointer flex-col gap-1.5 px-3.5 py-2.5 text-left hover:border-line-strong ${
                  g.semRegiao ? "border-dashed bg-subtle shadow-none" : ""
                } ${sel ? "!border-primary ring-1 ring-primary" : ""}`}
              >
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  <b className="text-[14.5px] font-semibold">
                    {g.curto}
                    {g.cobre && ` a ${g.cobre}`}
                  </b>
                  {g.semRegiao && <span className="text-[12.5px] text-muted">cadastro incompleto</span>}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl leading-tight font-semibold tracking-tight">{Math.round(pct * 100)}%</span>
                  <span className="text-[12.5px] text-muted capitalize">
                    finalizado ·{plural(n, "cliente", "clientes")}
                  </span>
                </span>
                <span aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded bg-subtle">
                  {SITUACOES.map((s) =>
                    por[s.k] ? (
                      <i key={s.k} className={`block min-w-[3px] ${COR[s.cor].bg}`} style={{ flex: por[s.k] }} />
                    ) : null,
                  )}
                </span>
                <span className="flex flex-wrap justify-between gap-x-2 text-[12.5px]">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <i className="size-2 rounded-full bg-st-atr" />
                    {plural(por.T, "atrasado", "atrasados")}
                  </span>
                  <span className="text-muted">{nf.format(por.S)} sem data</span>
                </span>
                <span className="border-t border-line pt-1.5 text-[12.5px] text-muted">
                  {g.semRegiao ? (
                    "Ajuste a região no cadastro do cliente."
                  ) : (
                    <>
                      Atendentes <span className="text-ink">{g.atendentes}</span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
