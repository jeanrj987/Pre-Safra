import Shell from "../Shell";
import Calendario, { NavegacaoMes, type AtividadeCalendario, type AgendamentoNaTela } from "./Calendario";
import { exigirAcessoCompleto } from "@/lib/auth";
import {
  agendamentosDoCalendario,
  chaveMes,
  mesDe,
  mesVizinho,
  NOMES_MES,
  podeAlterarAtividade,
  semanasDoMes,
  STATUS_NO_CALENDARIO,
} from "@/lib/calendario";
import { prisma } from "@/lib/db";
import { PONTO_STATUS } from "@/lib/dados";
import { hojeIso } from "@/lib/diasUteis";
import { obterSafraSelecionada } from "@/lib/safra";

export const metadata = { title: "Calendário" };

export default async function PaginaCalendario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const [sessao, { mes: mesPedido }, safra] = await Promise.all([
    exigirAcessoCompleto(),
    searchParams,
    obterSafraSelecionada(),
  ]);

  const hoje = hojeIso();
  const mes = mesDe(mesPedido, hoje);
  const semanas = semanasDoMes(mes);
  const primeiroDia = new Date(`${semanas[0][0]}T00:00:00Z`);
  const ultimoDia = new Date(`${semanas[semanas.length - 1][6]}T00:00:00Z`);
  const periodo = { gte: primeiroDia, lte: ultimoDia };

  // Traz também os dias de outros meses que completam a grade (as semanas inteiras aparecem na tela).
  const [registros, preSafras] = await Promise.all([
    prisma.atividade.findMany({
      where: { data: periodo },
      // Sem horário vem primeiro, depois por horário; empate pela ordem de lançamento.
      orderBy: [{ data: "asc" }, { horario: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    }),
    // Clientes da safra selecionada com data no período que podem entrar no calendário: os que
    // têm formato (agendados), os atrasados (data já passou) e os finalizados. O status exato e o
    // filtro final ficam em agendamentosDoCalendario().
    safra
      ? prisma.preSafra.findMany({
          where: {
            safraId: safra.id,
            inativo: false,
            dataPrevista: periodo,
            OR: [
              { configuradoSistema: true },
              { formato: { not: null } },
              { dataPrevista: { lt: new Date(`${hoje}T00:00:00Z`) } },
            ],
          },
          include: { cliente: { select: { nome: true } } },
        })
      : Promise.resolve([]),
  ]);

  const atividades: AtividadeCalendario[] = registros.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    data: a.data.toISOString().slice(0, 10),
    horario: a.horario,
    concluida: a.concluida,
    criadoPor: a.criadoPor,
    podeEditar: podeAlterarAtividade(sessao, a),
  }));

  const agendamentos: AgendamentoNaTela[] = agendamentosDoCalendario(
    preSafras.map((p) => ({
      id: p.id,
      nome: p.cliente?.nome ?? p.clienteNomeManual ?? "(sem nome)",
      dataPrevista: p.dataPrevista,
      horario: p.horario,
      formato: p.formato,
      configuradoSistema: p.configuradoSistema,
      inativo: p.inativo,
      responsavel: p.responsavel,
    })),
  ).map((a) => ({ ...a, ponto: PONTO_STATUS[a.status] }));

  const legenda = STATUS_NO_CALENDARIO.map((s) => ({ rotulo: s, ponto: PONTO_STATUS[s] }));

  const href = (m: { ano: number; mes: number }) => `/calendario?mes=${chaveMes(m)}`;

  return (
    <Shell ativo="calendario">
      <NavegacaoMes
        titulo={`${NOMES_MES[mes.mes - 1]} de ${mes.ano}`}
        anterior={href(mesVizinho(mes, -1))}
        proximo={href(mesVizinho(mes, 1))}
      />
      <Calendario
        semanas={semanas}
        mesAtual={mes.mes}
        hoje={hoje}
        atividades={atividades}
        agendamentos={agendamentos}
        legenda={legenda}
        safra={safra?.nome ?? null}
      />
    </Shell>
  );
}
