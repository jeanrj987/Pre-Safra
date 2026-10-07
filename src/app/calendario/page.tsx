import Shell from "../Shell";
import Calendario, { NavegacaoMes, type AtividadeCalendario } from "./Calendario";
import { exigirAcessoCompleto } from "@/lib/auth";
import { chaveMes, mesDe, mesVizinho, NOMES_MES, semanasDoMes } from "@/lib/calendario";
import { prisma } from "@/lib/db";
import { hojeIso } from "@/lib/diasUteis";

export const metadata = { title: "Calendário · Pré-Safra" };

export default async function PaginaCalendario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const [, { mes: mesPedido }] = await Promise.all([exigirAcessoCompleto(), searchParams]);

  const hoje = hojeIso();
  const mes = mesDe(mesPedido, hoje);
  const semanas = semanasDoMes(mes);
  const primeiroDia = semanas[0][0];
  const ultimoDia = semanas[semanas.length - 1][6];

  // Traz também os dias de outros meses que completam a grade (as semanas inteiras aparecem na tela).
  const registros = await prisma.atividade.findMany({
    where: {
      data: { gte: new Date(`${primeiroDia}T00:00:00Z`), lte: new Date(`${ultimoDia}T00:00:00Z`) },
    },
    // Sem horário (dia inteiro) vem primeiro, depois por horário; empate pela ordem de lançamento.
    orderBy: [{ data: "asc" }, { horario: { sort: "asc", nulls: "first" } }, { id: "asc" }],
  });

  const atividades: AtividadeCalendario[] = registros.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    descricao: a.descricao,
    data: a.data.toISOString().slice(0, 10),
    horario: a.horario,
    concluida: a.concluida,
    criadoPor: a.criadoPor,
  }));

  const href = (m: { ano: number; mes: number }) => `/calendario?mes=${chaveMes(m)}`;

  return (
    <Shell ativo="calendario">
      <NavegacaoMes
        titulo={`${NOMES_MES[mes.mes - 1]} de ${mes.ano}`}
        anterior={href(mesVizinho(mes, -1))}
        proximo={href(mesVizinho(mes, 1))}
      />
      <Calendario semanas={semanas} mesAtual={mes.mes} hoje={hoje} atividades={atividades} />
    </Shell>
  );
}
