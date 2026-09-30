import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dataParaCampo, formatarData, statusInativoPorCliente } from "@/lib/dados";
import { plural } from "@/lib/texto";
import Icone from "@/app/Icone";
import NovaSafra from "./NovaSafra";
import EditarSafra from "./EditarSafra";

export const metadata = { title: "Safras · Pré-Safra" };

export default async function AdminSafras({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; criada?: string }>;
}) {
  await exigirAdmin();
  const { erro, criada } = await searchParams;
  const safras = await prisma.safra.findMany({ orderBy: { inicio: "asc" } });
  const clientes = await prisma.cliente.findMany({ select: { id: true } });
  const statusPorCliente = await statusInativoPorCliente();
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
    const safra = await prisma.safra.create({ data: { nome, cultura, inicio, prazo } });

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
    await prisma.safra.update({ where: { id }, data: { ativa } });
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
              <>
                {" "}
                · {plural(clientesInativos, "inativo", "inativos")} (não entram em safras
                novas)
              </>
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
          Não foi possível criar a safra. Confira o nome (pode já existir) e se o prazo é
          depois do início.
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
                <th scope="col" className="px-4 py-2.5 sm:px-5">Nome</th>
                <th scope="col" className="px-3 py-2.5">Cultura</th>
                <th scope="col" className="px-3 py-2.5">Período</th>
                <th scope="col" className="px-3 py-2.5">Situação</th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {safras.map((s) => (
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
                    <form action={alternarAtiva.bind(null, s.id, !s.ativa)} className="inline">
                      <button type="submit" className="btn-discreto btn-sm">
                        {s.ativa ? "Inativar" : "Reativar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
