"use client";
import { useMemo, useState } from "react";
import Cobertura from "./Cobertura";
import GraficoCarga from "./GraficoCarga";
import GraficoRitmo from "./GraficoRitmo";
import GraficoVencimentos from "./GraficoVencimentos";
import Regioes from "./Regioes";
import { AndamentoGeral } from "./Resumo";
import { SEM_FILTROS, SEM_REGIAO, aplicarFiltros, type Filtros } from "./filtros";
import {
  listarRegioes,
  metricas,
  pessoasDaDupla,
  type ClientePainel,
  type PeriodoSafra,
} from "@/lib/painel";
import { nf } from "./cores";

const SEM_RESPONSAVEL = "Sem responsável";

export default function Painel({
  clientes,
  hoje,
  periodo,
}: {
  clientes: ClientePainel[];
  hoje: number;
  periodo: PeriodoSafra;
}) {
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);

  const set = useMemo(() => aplicarFiltros(clientes, filtros), [clientes, filtros]);
  const m = useMemo(() => metricas(set, hoje, periodo), [set, hoje, periodo]);
  const regioes = useMemo(() => listarRegioes(clientes), [clientes]);
  const paraRegioes = useMemo(
    () => (filtros.regiao ? aplicarFiltros(clientes, filtros) : aplicarFiltros(clientes, filtros, "regiao")),
    [clientes, filtros],
  );

  const temSemRegiao = clientes.some((c) => !c.regiao);
  const grupos = useMemo(() => {
    const daDupla = new Set<string>();
    const porRegiao = regioes.map((r) => {
      const pessoas = pessoasDaDupla(r.atendentes);
      pessoas.forEach((p) => daDupla.add(p));
      return { nome: r.curto, pessoas };
    });
    const outros = [...new Set(clientes.map((c) => c.responsavel).filter((r): r is string => !!r && !daDupla.has(r)))].sort();
    return { porRegiao, outros };
  }, [clientes, regioes]);

  const alterar = (campo: keyof Filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const filtrando = Object.values(filtros).some(Boolean);

  return (
    <>
      <div role="group" aria-label="Filtros do painel" className="flex flex-wrap items-center gap-2">
        <label>
          <span className="sr-only">Região</span>
          <select value={filtros.regiao} onChange={(e) => alterar("regiao", e.target.value)} className="campo !h-9 !w-auto">
            <option value="">Todas as regiões</option>
            {regioes.map((r) => (
              <option key={r.nome} value={r.nome}>{r.nome}</option>
            ))}
            {temSemRegiao && <option value={SEM_REGIAO}>{SEM_REGIAO}</option>}
          </select>
        </label>
        <label>
          <span className="sr-only">Responsável</span>
          <select value={filtros.responsavel} onChange={(e) => alterar("responsavel", e.target.value)} className="campo !h-9 !w-auto">
            <option value="">Todos os responsáveis</option>
            {grupos.porRegiao.map((g) => (
              <optgroup key={g.nome} label={g.nome}>
                {g.pessoas.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </optgroup>
            ))}
            {grupos.outros.length > 0 && (
              <optgroup label="Outros">
                {grupos.outros.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </optgroup>
            )}
            <option value={SEM_RESPONSAVEL}>{SEM_RESPONSAVEL}</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Formato</span>
          <select value={filtros.formato} onChange={(e) => alterar("formato", e.target.value)} className="campo !h-9 !w-auto">
            <option value="">Todos os formatos</option>
            <option>Online</option>
            <option>Presencial</option>
            <option>Não definido</option>
          </select>
        </label>
        {filtrando && (
          <button type="button" onClick={() => setFiltros(SEM_FILTROS)} className="btn-discreto">
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-[13px] text-muted" aria-live="polite">
          Exibindo {nf.format(set.length)} de {nf.format(clientes.length)} clientes ativos
        </span>
      </div>

      <AndamentoGeral m={m} />

      <Regioes
        clientes={paraRegioes}
        regioes={regioes}
        hoje={hoje}
        selecionada={filtros.regiao}
        onSelecionar={(nome) => alterar("regiao", nome)}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <GraficoRitmo set={set} m={m} hoje={hoje} periodo={periodo} />
        <GraficoCarga clientes={clientes} filtros={filtros} hoje={hoje} onFiltrar={alterar} />
        <GraficoVencimentos set={set} m={m} hoje={hoje} periodo={periodo} />
        <Cobertura m={m} />
      </div>
    </>
  );
}
