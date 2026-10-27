import Form from "next/form";
import Link from "next/link";
import Shell from "../Shell";
import Seletor from "../Seletor";
import { opcoesDeLista } from "../seletorOpcoes";
import BotaoImprimir from "./BotaoImprimir";
import Conferencia from "./Conferencia";
import Evolucao from "./Evolucao";
import Pessoas from "./Pessoas";
import Situacao from "./Situacao";
import { tirarFotoAgora } from "./acoes";
import { exigirAcessoCompleto } from "@/lib/auth";
import { formatarDataHora, listarLinhas } from "@/lib/dados";
import { limitesDasFotos, listarFotos } from "@/lib/fotos";
import { prisma } from "@/lib/db";
import { ITENS_FINALIZACAO, type MarcasFinalizacao } from "@/lib/finalizacao";
import { diaMesAno } from "@/lib/painel";
import { pode } from "@/lib/permissoes";
import {
  conferir,
  DIMENSOES,
  dimensaoValida,
  diaParaIso,
  filtrarLinhas,
  opcoesDeFiltro,
  periodoEvolucao,
  serieEvolucao,
  STATUS_RELATORIO,
  statusValido,
  tipoValido,
  TIPOS_RELATORIO,
  type FiltrosRelatorio,
  type TipoRelatorio,
} from "@/lib/relatorios";
import { obterSafraSelecionada, tituloPreSafra } from "@/lib/safra";
import { diaHoje } from "@/lib/status";

export const metadata = { title: "Relatórios" };

// Parâmetro que pode vir repetido (?regiao=A&regiao=B): lista sem vazios nem repetidos.
const lista = (v: string | string[] | undefined) => [
  ...new Set((Array.isArray(v) ? v : [v ?? ""]).map((x) => x.trim()).filter(Boolean)),
];
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaRelatorios({ searchParams }: PageProps<"/relatorios">) {
  const usuario = await exigirAcessoCompleto();
  const sp = await searchParams;

  const safra = await obterSafraSelecionada();
  if (!safra) {
    return (
      <Shell ativo="relatorios">
        <p className="card p-6 text-sm text-muted">
          Nenhuma safra cadastrada ainda. Peça a um administrador para criar uma em Admin → Safras.
        </p>
      </Shell>
    );
  }

  const tipo = tipoValido(um(sp.r));
  const dimensao = dimensaoValida(um(sp.por));
  const filtros: FiltrosRelatorio = {
    regioes: lista(sp.regiao),
    responsaveis: lista(sp.responsavel),
    status: tipo === "situacao" ? lista(sp.status).filter(statusValido) : [],
  };

  const todas = await listarLinhas(safra.id);
  const opcoes = opcoesDeFiltro(todas);
  const recorte = filtrarLinhas(todas, { ...filtros, status: [] });
  const rotulo = TIPOS_RELATORIO.find((t) => t.id === tipo)!.rotulo;
  const agora = new Date();

  // Cada relatório monta só o que precisa.
  let conteudo: React.ReactNode;
  let periodoTexto = "";
  let de = "";
  let ate = "";
  if (tipo === "situacao") {
    const clientes = filtros.status.length > 0 ? filtrarLinhas(recorte, filtros) : recorte.filter((l) => l.status !== "Inativo");
    conteudo = <Situacao base={recorte} lista={clientes} />;
  } else if (tipo === "pessoas") {
    conteudo = <Pessoas linhas={recorte} dimensao={dimensao} />;
  } else if (tipo === "conferencia") {
    const registros = await prisma.preSafra.findMany({
      where: { safraId: safra.id, configuradoSistema: true, inativo: false },
      select: { id: true, melhoriasApresentadas: true, sistemaAtualizado: true, safraFechada: true, safraNovaConfigurada: true },
    });
    const marcas = new Map<number, MarcasFinalizacao>(
      registros.map((r) => [
        r.id,
        Object.fromEntries(ITENS_FINALIZACAO.map((i) => [i.chave, r[i.chave]])) as MarcasFinalizacao,
      ]),
    );
    conteudo = <Conferencia dados={conferir(recorte, marcas)} />;
  } else {
    const periodo = periodoEvolucao(um(sp.de), um(sp.ate), diaHoje(agora));
    const [fotos, limites] = await Promise.all([
      listarFotos(safra.id, periodo.inicio, periodo.fim),
      limitesDasFotos(safra.id),
    ]);
    de = diaParaIso(periodo.inicio);
    ate = diaParaIso(periodo.fim);
    periodoTexto = `Período: ${diaMesAno(periodo.inicio)} a ${diaMesAno(periodo.fim)}`;
    conteudo = (
      <Evolucao
        pontos={serieEvolucao(fotos, filtros)}
        haFotos={limites.ultima !== null}
        primeira={limites.primeira}
        tirarFoto={pode(usuario, "safras") ? tirarFotoAgora : undefined}
      />
    );
  }

  // Resumo dos filtros em uso, para sair também no PDF.
  const partesFiltro = [
    periodoTexto,
    tipo === "pessoas" && `Agrupado por ${DIMENSOES.find((d) => d.id === dimensao)!.rotulo.toLowerCase()}`,
    filtros.regioes.length > 0 && `Região: ${filtros.regioes.join(", ")}`,
    filtros.responsaveis.length > 0 && `Responsável: ${filtros.responsaveis.join(", ")}`,
    filtros.status.length > 0 && `Status: ${filtros.status.join(", ")}`,
  ].filter(Boolean);

  // Os filtros de região e responsável acompanham a pessoa ao trocar de relatório.
  const hrefDaAba = (id: TipoRelatorio) => {
    const q = new URLSearchParams({ r: id });
    filtros.regioes.forEach((v) => q.append("regiao", v));
    filtros.responsaveis.forEach((v) => q.append("responsavel", v));
    return `/relatorios?${q}`;
  };

  return (
    <Shell ativo="relatorios">
      {/* O @page vale só para o documento impresso: A4 deitado para as tabelas largas, e as cores
          (selos, barras, linhas do gráfico) saem como na tela. */}
      <style>{`@page { size: A4 landscape; margin: 12mm; }
@media print { * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } body { background: #fff; } }`}</style>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {rotulo} — {tituloPreSafra(safra)}
          </h1>
          <p className="text-sm text-muted">
            Gerado em {formatarDataHora(agora)} · Prazo final em {diaMesAno(safra.prazo.getTime())}
          </p>
          {partesFiltro.length > 0 && <p className="hidden text-sm text-muted print:block">{partesFiltro.join(" · ")}</p>}
        </div>
        <div className="print:hidden">
          <BotaoImprimir nomeArquivo={`${rotulo} - ${tituloPreSafra(safra)}`} />
        </div>
      </div>

      <nav aria-label="Relatórios" className="flex flex-wrap gap-1 border-b border-line print:hidden">
        {TIPOS_RELATORIO.map((t) => (
          <Link
            key={t.id}
            href={hrefDaAba(t.id)}
            aria-current={t.id === tipo ? "page" : undefined}
            title={t.descricao}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              t.id === tipo ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.rotulo}
          </Link>
        ))}
      </nav>

      <Form action="/relatorios" className="flex flex-wrap items-center gap-2 print:hidden">
        <input type="hidden" name="r" value={tipo} />
        <Seletor
          nome="regiao"
          rotulo="Filtrar por região"
          ocultarRotulo
          tamanho="compacto"
          multiplo
          valoresIniciais={filtros.regioes}
          unidadePlural="regiões"
          placeholder="Todas as regiões"
          enviarAoMudar
          opcoes={opcoesDeLista(opcoes.regioes)}
        />
        <Seletor
          nome="responsavel"
          rotulo="Filtrar por responsável"
          ocultarRotulo
          tamanho="compacto"
          multiplo
          valoresIniciais={filtros.responsaveis}
          unidadePlural="responsáveis"
          placeholder="Todos os responsáveis"
          enviarAoMudar
          opcoes={opcoesDeLista(opcoes.responsaveis)}
        />
        {tipo === "situacao" && (
          <Seletor
            nome="status"
            rotulo="Filtrar por status"
            ocultarRotulo
            tamanho="compacto"
            multiplo
            valoresIniciais={filtros.status}
            unidadePlural="status"
            placeholder="Todos os status (menos inativos)"
            enviarAoMudar
            opcoes={opcoesDeLista(STATUS_RELATORIO)}
          />
        )}
        {tipo === "pessoas" && (
          <Seletor
            nome="por"
            rotulo="Agrupar por"
            ocultarRotulo
            tamanho="compacto"
            valorInicial={dimensao}
            enviarAoMudar
            opcoes={DIMENSOES.map((d) => ({ valor: d.id, rotulo: `Agrupar por ${d.rotulo.toLowerCase()}` }))}
          />
        )}
        {tipo === "evolucao" && (
          <>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              De
              <input type="date" name="de" defaultValue={de} className="campo !h-9 !w-auto" />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              até
              <input type="date" name="ate" defaultValue={ate} className="campo !h-9 !w-auto" />
            </label>
            <button type="submit" className="btn-contorno btn-sm">Aplicar</button>
          </>
        )}
        {(filtros.regioes.length > 0 || filtros.responsaveis.length > 0 || filtros.status.length > 0) && (
          <Link href={`/relatorios?r=${tipo}`} className="btn-discreto btn-sm">Limpar filtros</Link>
        )}
      </Form>

      {conteudo}
    </Shell>
  );
}
