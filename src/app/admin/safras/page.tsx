import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dataParaCampo, formatarData, statusInativoPorCliente } from "@/lib/dados";
import { plural } from "@/lib/texto";
import { obterSafraSelecionada } from "@/lib/safra";
import BotaoAcao from "@/app/BotaoAcao";
import Icone from "@/app/Icone";
import NovaSafra from "./NovaSafra";
import EditarSafra from "./EditarSafra";
import ExcluirSafra from "./ExcluirSafra";

const MOTIVO_EM_USO = "Esta é a safra selecionada agora.";

export const metadata = { title: "Safras · Pré-Safra" };

export default async function AdminSafras({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criada?: string }>;
}) {
  await exigirAdmin();
  const { erro, criada } = await searchParams;
  // Consultas independentes: em paralelo, cada uma custa uma ida ao banco (Neon, remoto).
  const [safras, safraAtual, clientes, statusPorCliente] = await Promise.all([
    prisma.safra.findMany({
      orderBy: { inicio: "asc" },
      include: { _count: { select: { preSafras: true } } },
    }),
    obterSafraSelecionada(),
    prisma.cliente.findMany({ select: { id: true } }),
    statusInativoPorCliente(),
  ]);
  const clientesInativos = clientes.filter((c) => statusPorCliente.get(c.id)).length;

  async function criarSafra(formData: FormData) {
    "use server";
    await exigirAdmin();
    const nome = String(formData.get("nome") ?? "").trim();
    const cultura = String(formData.get("cultura") ?? "").trim() || null;
    const inicioTexto = String(formData.get("inicio") ?? "");
    const prazoTexto = String(formData.get("prazo") ?? "");
    const inicio = inicioTexto ? new Date(`${inicioTexto}T00:00:00Z`) : null;
    const prazo = prazoTexto ? new Date(`${prazoTexto}T00:00:00Z`) : null;
    const existente = nome ? await prisma.safra.findUnique({ where: { nome } }) : null;
    if (!nome || !inicio || !prazo || prazo <= inicio || existente) {
      redirect("/admin/safras?erro=1");
    }
    const safra = await prisma.safra.create({
      data: { nome, cultura, inicio, prazo },
    });

    // Leva para a safra nova todo cliente cadastrado cujo Pré-Safra mais recente não esteja
    // marcado como inativo (cliente sem nenhum Pré-Safra ainda conta como ativo).
    const clientes = await prisma.cliente.findMany({ select: { id: true } });
    const statusPorCliente = await statusInativoPorCliente();
    const elegiveis = clientes.filter((c) => !statusPorCliente.get(c.id));
    const { count } = await prisma.preSafra.createMany({
      data: elegiveis.map((c) => ({ clienteId: c.id, safraId: safra.id })),
      skipDuplicates: true,
    });

    revalidatePath("/admin/safras");
    revalidatePath("/", "layout");
    redirect(`/admin/safras?criada=${count}`);
  }

  async function editarPeriodo(id: number, formData: FormData) {
    "use server";
    await exigirAdmin();
    const inicioTexto = String(formData.get("inicio") ?? "");
    const prazoTexto = String(formData.get("prazo") ?? "");
    const inicio = inicioTexto ? new Date(`${inicioTexto}T00:00:00Z`) : null;
    const prazo = prazoTexto ? new Date(`${prazoTexto}T00:00:00Z`) : null;
    if (!inicio || !prazo || prazo <= inicio) return;
    await prisma.safra.update({ where: { id }, data: { inicio, prazo } });
    revalidatePath("/admin/safras");
    revalidatePath("/", "layout");
  }

  async function alternarAtiva(id: number, ativa: boolean) {
    "use server";
    await exigirAdmin();
    // A safra selecionada por quem está logado não pode ser inativada (ver excluirSafra)
    if (!ativa && id === (await obterSafraSelecionada())?.id) return;
    await prisma.safra.update({ where: { id }, data: { ativa } });
    revalidatePath("/admin/safras");
    revalidatePath("/", "layout");
  }

  // Apaga a safra e, junto, os Pré-Safras dela (com o histórico de conclusões, que sai em
  // cascata). Os clientes em si continuam cadastrados e mantêm as outras safras. Exige o nome
  // da safra digitado (ExcluirSafra) e não vale para a safra selecionada por quem está logado,
  // que o admin precisa trocar antes no seletor; para só tirar do seletor sem perder nada, use Inativar.
  async function excluirSafra(id: number, formData: FormData) {
    "use server";
    await exigirAdmin();
    if (id === (await obterSafraSelecionada())?.id) return;
    const safra = await prisma.safra.findUnique({ where: { id } });
    if (!safra || String(formData.get("confirmacao") ?? "").trim() !== safra.nome) return;
    await prisma.$transaction([
      prisma.preSafra.deleteMany({ where: { safraId: id } }),
      prisma.safra.deleteMany({ where: { id } }),
    ]);
    revalidatePath("/admin/safras");
    revalidatePath("/", "layout");
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-base font-semibold">Safras</h2>
          <span className="text-sm text-muted">
            {plural(clientes.length, "cliente cadastrado", "clientes cadastrados")}
            {clientesInativos > 0 && (
              <> · {plural(clientesInativos, "inativo", "inativos")} (não entram em safras novas)</>
            )}
          </span>
        </div>
        <NovaSafra acao={criarSafra} />
      </div>

      {erro && (
        <p
          role="alert"
          className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg sm:mx-5"
        >
          <Icone nome="alerta" />
          Não foi possível criar a safra. Confira o nome (pode já existir) e se o prazo é depois do
          início.
        </p>
      )}

      {criada !== undefined && (
        <p
          role="status"
          className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-finalizado-dot/40 bg-finalizado-bg px-3 py-2 text-sm font-medium text-finalizado-fg sm:mx-5"
        >
          <Icone nome="check" />
          Safra criada. {criada} cliente(s) ativo(s) foram copiados para ela.
        </p>
      )}

      {safras.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nenhuma safra cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-2.5 sm:px-5">
                  Nome
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Cultura
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Período
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Situação
                </th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {safras.map((s) => {
                const emUso = s.id === safraAtual?.id;
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-ink sm:px-5">{s.nome}</td>
                    <td className="px-3 py-3 text-muted">{s.cultura || "—"}</td>
                    <td className="px-3 py-3">
                      <EditarSafra
                        exibicao={`${formatarData(s.inicio)} – ${formatarData(s.prazo)}`}
                        inicio={dataParaCampo(s.inicio)}
                        prazo={dataParaCampo(s.prazo)}
                        salvar={editarPeriodo.bind(null, s.id)}
                      />
                    </td>
                    <td className="px-3 py-3">{s.ativa ? "Ativa" : "Inativa"}</td>
                    <td className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={alternarAtiva.bind(null, s.id, !s.ativa)}>
                          <BotaoAcao
                            type="submit"
                            icone={s.ativa ? "bloquear" : "reabrir"}
                            tom="neutro"
                            rotulo={
                              emUso
                                ? `${MOTIVO_EM_USO} Troque no seletor para inativar.`
                                : s.ativa
                                  ? "Inativar"
                                  : "Reativar"
                            }
                            disabled={emUso}
                            soIcone
                          />
                        </form>
                        <ExcluirSafra
                          acao={excluirSafra.bind(null, s.id)}
                          nome={s.nome}
                          qtdPreSafras={s._count.preSafras}
                          bloqueadoMotivo={
                            emUso ? `${MOTIVO_EM_USO} Troque no seletor para excluir.` : undefined
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
