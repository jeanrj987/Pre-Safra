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
import Seletor, { type OpcaoSeletor } from "../Seletor";
import { Avatar, Bolinha } from "../seletorOpcoes";

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

  const opcoesRegiao: OpcaoSeletor[] = [
    { valor: "", rotulo: "Todas as regiões" },
    ...regioes.map((r) => ({ valor: r.nome, rotulo: r.nome })),
    ...(temSemRegiao ? [{ valor: SEM_REGIAO, rotulo: SEM_REGIAO }] : []),
  ];
  const opcoesResponsavel: OpcaoSeletor[] = [
    { valor: "", rotulo: "Todos os responsáveis" },
    { valor: SEM_RESPONSAVEL, rotulo: SEM_RESPONSAVEL },
    ...grupos.porRegiao.flatMap((g) =>
      g.pessoas.map((p) => ({ valor: p, rotulo: p, grupo: g.nome, marca: <Avatar nome={p} /> })),
    ),
    ...grupos.outros.map((p) => ({ valor: p, rotulo: p, grupo: "Outros", marca: <Avatar nome={p} /> })),
  ];
  const opcoesFormato: OpcaoSeletor[] = [
    { valor: "", rotulo: "Todos os formatos" },
    { valor: "Online", rotulo: "Online", marca: <Bolinha cor="agendado" /> },
    { valor: "Presencial", rotulo: "Presencial", marca: <Bolinha cor="presencial" /> },
    { valor: "Não definido", rotulo: "Não definido" },
  ];

  const alterar = (campo: keyof Filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const filtrando = Object.values(filtros).some(Boolean);

  return (
    <>
      <div role="group" aria-label="Filtros do painel" className="flex flex-wrap items-center gap-2">
        <Seletor
          rotulo="Região"
          ocultarRotulo
          tamanho="compacto"
          valor={filtros.regiao}
          onChange={(v) => alterar("regiao", v)}
          opcoes={opcoesRegiao}
        />
        <Seletor
          rotulo="Responsável"
          ocultarRotulo
          tamanho="compacto"
          valor={filtros.responsavel}
          onChange={(v) => alterar("responsavel", v)}
          opcoes={opcoesResponsavel}
        />
        <Seletor
          rotulo="Formato"
          ocultarRotulo
          tamanho="compacto"
          valor={filtros.formato}
          onChange={(v) => alterar("formato", v)}
          opcoes={opcoesFormato}
        />
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
