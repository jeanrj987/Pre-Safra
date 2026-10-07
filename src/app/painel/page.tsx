import Shell from "../Shell";
import Painel from "./Painel";
import { exigirLogin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { diaMesAno, type ClientePainel } from "@/lib/painel";
import { obterSafraSelecionada, periodoDe } from "@/lib/safra";
import { diaHoje } from "@/lib/status";

export const metadata = { title: "Painel" };

export default async function PaginaPainel() {
  // Painel só de leitura, aberto a todo usuário logado (inclusive a conta "somente Painel" da TV).
  // Login e safra em paralelo: cada ida ao banco custa um round-trip, então sequenciar à toa
  // soma latência a cada navegação.
  const [, safra] = await Promise.all([exigirLogin(), obterSafraSelecionada()]);
  if (!safra) {
    return (
      <Shell ativo="painel">
        <p className="card p-6 text-sm text-muted">
          Nenhuma safra cadastrada ainda. Peça a um administrador para criar uma em Admin →
          Safras.
        </p>
      </Shell>
    );
  }

  const registros = await prisma.preSafra.findMany({
    where: { safraId: safra.id, inativo: false },
    include: {
      cliente: { select: { nome: true, regiao: true, atendente: true, consultor: true } },
      // A data da finalização em vigor (a que ainda não foi reaberta) é a data de conclusão.
      conclusoes: {
        where: { reabertoEm: null },
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { criadoEm: true },
      },
    },
  });

  const hoje = diaHoje(new Date());
  const periodo = periodoDe(safra);
  const clientes: ClientePainel[] = registros.map((r) => ({
    id: r.id,
    nome: r.cliente?.nome ?? r.clienteNomeManual ?? "(sem nome)",
    regiao: r.cliente?.regiao ?? null,
    atendentes: r.cliente?.atendente ?? null,
    consultor: r.cliente?.consultor ?? null,
    responsavel: r.responsavel,
    formato: r.formato,
    data: r.dataPrevista ? r.dataPrevista.getTime() : null,
    // Finalizado sem entrada no histórico (dado antigo): usa a última alteração do registro.
    fin: r.configuradoSistema ? diaHoje(r.conclusoes[0]?.criadoEm ?? r.atualizadoEm) : null,
    melhorias: r.melhoriasApresentadas,
  }));

  return (
    <Shell ativo="painel">
      {/* Sticky abaixo da topbar (h-14): em telas grandes, como a TV da sala, o título continua
          visível mesmo quando a página é rolada para mostrar só os cartões do painel. */}
      <div className="lg:sticky lg:top-14 lg:z-20 lg:-mt-2 lg:bg-canvas lg:pt-2 lg:pb-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Painel de Acompanhamento — Pré-Safra {safra.nome}
        </h1>
        <p className="text-sm text-muted">
          Situação em {diaMesAno(hoje)} · Prazo final em {diaMesAno(periodo.prazo)}
        </p>
      </div>

      <Painel clientes={clientes} hoje={hoje} periodo={periodo} />
    </Shell>
  );
}
