import { agruparPor, resumir, type Dimensao } from "@/lib/relatorios";
import type { Linha } from "@/lib/dados";
import { LINHA, NUM, TABELA, TD, TH } from "./tabela";

const TITULO: Record<Dimensao, string> = {
  responsavel: "Responsável",
  regiao: "Região",
  consultor: "Consultor",
};

function Barra({ pct }: { pct: number }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle print:w-12">
        <span className="block h-full rounded-full bg-st-fin" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-9 text-right tabular-nums">{pct}%</span>
    </span>
  );
}

export default function Pessoas({ linhas, dimensao }: { linhas: Linha[]; dimensao: Dimensao }) {
  const grupos = agruparPor(linhas, dimensao);
  const total = resumir("Total", linhas);

  if (grupos.length === 0) {
    return <p className="card p-6 text-sm text-muted">Nenhum cliente ativo neste recorte.</p>;
  }

  const linha = (g: typeof total, destaque = false) => (
    <tr key={g.nome} className={`${LINHA} ${destaque ? "bg-subtle/60 font-semibold" : ""}`}>
      <th scope="row" className={`${TD} text-left font-medium`}>{g.nome}</th>
      <td className={`${TD} ${NUM}`}>{g.total}</td>
      <td className={`${TD} ${NUM}`}>{g.finalizados}</td>
      <td className={`${TD} ${NUM}`}><Barra pct={g.pct} /></td>
      <td className={`${TD} ${NUM}`}>{g.agendados}</td>
      <td className={`${TD} ${NUM}`}>{g.aFazer}</td>
      <td className={`${TD} ${NUM} ${g.atrasados > 0 ? "text-atrasado-fg" : ""}`}>{g.atrasados}</td>
      <td className={`${TD} ${NUM}`}>{g.online}</td>
      <td className={`${TD} ${NUM}`}>{g.presencial}</td>
      <td className={`${TD} ${NUM}`}>
        {g.atrasoMedio === null ? "—" : `${g.atrasoMedio} ${g.atrasoMedio === 1 ? "dia" : "dias"} (${g.concluidosComAtraso})`}
      </td>
    </tr>
  );

  return (
    <section className="card overflow-hidden print:shadow-none">
      <p className="px-4 pt-3 pb-2 text-[13px] text-muted">
        Só clientes ativos. “Online” e “Presencial” somam finalizados e agendados. A última coluna é a média de dias
        que as finalizações passaram da data prevista (entre parênteses, quantas passaram).
      </p>
      <div className="overflow-x-auto">
        <table className={TABELA}>
          <thead>
            <tr className="border-y border-line bg-subtle/50 text-left">
              <th scope="col" className={TH}>{TITULO[dimensao]}</th>
              <th scope="col" className={`${TH} text-right`}>Clientes</th>
              <th scope="col" className={`${TH} text-right`}>Finalizados</th>
              <th scope="col" className={`${TH} text-right`}>% finalizado</th>
              <th scope="col" className={`${TH} text-right`}>Agendados</th>
              <th scope="col" className={`${TH} text-right`}>A Fazer</th>
              <th scope="col" className={`${TH} text-right`}>Atrasados</th>
              <th scope="col" className={`${TH} text-right`}>Online</th>
              <th scope="col" className={`${TH} text-right`}>Presencial</th>
              <th scope="col" className={`${TH} text-right`}>Atraso na conclusão</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => linha(g))}
            {grupos.length > 1 && linha(total, true)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
