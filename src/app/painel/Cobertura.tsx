import { nf } from "./cores";
import type { Metricas } from "@/lib/painel";
import { plural } from "@/lib/texto";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

// Quanto do cadastro está preenchido. Sem data e sem responsável, prazos e cargas ficam incompletos.
export default function Cobertura({ m }: { m: Metricas }) {
  const medidores = [
    { nome: "Com data prevista", a: m.comData, b: m.n, un: "clientes" },
    { nome: "Com responsável definido", a: m.comResponsavel, b: m.n, un: "clientes" },
    { nome: "Melhorias apresentadas", a: m.comMelhorias, b: m.finalizados, un: "finalizados" },
  ];
  return (
    <section className="card min-w-0 p-4 lg:col-span-5 min-[1800px]:col-span-3">
      <h2 className="text-base font-semibold leading-snug text-balance">
        {plural(m.semData, "cliente sem data", "clientes sem data")} e {plural(m.semResponsavel, "sem responsável", "sem responsável")}
      </h2>
      <p className="mt-0.5 text-[13px] text-muted">Sem esses campos, prazos e cargas por pessoa ficam incompletos.</p>
      <div className="mt-3 flex flex-col gap-3">
        {medidores.map((x) => (
          <div key={x.nome}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13.5px]">
              <b className="font-semibold">{x.nome}</b>
              <span className="text-[12.5px] text-muted">
                {nf.format(x.a)} de {nf.format(x.b)} {x.un} · {pct(x.a, x.b)}%
              </span>
            </div>
            <div role="img" aria-label={`${x.nome}: ${pct(x.a, x.b)}%`} className="h-2.5 overflow-hidden rounded-full bg-st-age/15">
              <i className="block h-full rounded-full bg-st-age" style={{ width: `${pct(x.a, x.b)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-subtle px-3 py-2.5 text-[13px] text-muted">
        {m.semResponsavel > 0 || m.semData > 0
          ? "Definir o responsável mostra a carga de cada pessoa dentro da dupla da região. Definir a data permite acompanhar prazos."
          : "Todos os clientes deste recorte têm data e responsável."}
      </p>
    </section>
  );
}
