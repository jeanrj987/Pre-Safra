import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatarWhatsapp, linkWhatsapp } from "@/lib/whatsapp";
import { plural } from "@/lib/texto";
import BotaoAcao from "@/app/BotaoAcao";
import BotaoExcluir from "@/app/BotaoExcluir";
import Icone from "@/app/Icone";

export const metadata = { title: "Sugestões · Pré-Safra" };

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function AdminSugestoes() {
  await exigirAdmin();
  const sugestoes = await prisma.sugestao.findMany({ orderBy: { id: "desc" } });

  async function alternarOculta(id: number, oculta: boolean) {
    "use server";
    await exigirAdmin();
    await prisma.sugestao.update({ where: { id }, data: { oculta } });
    revalidatePath("/admin/sugestoes");
  }

  async function excluir(id: number) {
    "use server";
    await exigirAdmin();
    await prisma.sugestao.deleteMany({ where: { id } });
    revalidatePath("/admin/sugestoes");
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <h2 className="text-base font-semibold">Sugestões para o FAQ</h2>
          <p className="text-sm text-muted">{plural(sugestoes.length, "sugestão", "sugestões")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/admin/sugestoes/exportar" className="btn-primario">
            <Icone nome="upload" className="rotate-180" />
            Exportar CSV
          </a>
        </div>
      </div>

      {sugestoes.length === 0 ? (
        <p className="p-6 text-sm text-muted">
          Nenhuma sugestão ainda. O formulário público fica em{" "}
          <a href="/sugestao" className="font-medium text-primary underline">
            /sugestao
          </a>{" "}
          e o QR code fica no “Telão de ideias”, no menu lateral.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle/70 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="px-4 py-2.5 sm:px-5">Quando</th>
                <th scope="col" className="px-3 py-2.5">Pessoa</th>
                <th scope="col" className="px-3 py-2.5">Assunto</th>
                <th scope="col" className="px-3 py-2.5">Sugestão</th>
                <th scope="col" className="px-3 py-2.5">Situação</th>
                <th scope="col" className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sugestoes.map((s) => (
                <tr key={s.id} className={s.oculta ? "opacity-60" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted num sm:px-5">
                    {dataHora.format(s.criadoEm)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink">{s.nome}</p>
                    <a
                      href={linkWhatsapp(s.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="num whitespace-nowrap text-primary underline"
                    >
                      {formatarWhatsapp(s.whatsapp)}
                    </a>
                  </td>
                  <td className="px-3 py-3 font-medium">{s.topico}</td>
                  <td className="max-w-md px-3 py-3">{s.texto}</td>
                  <td className="px-3 py-3">
                    {s.possivelDuplicada && (
                      <p className="text-xs text-afazer-fg">
                        <strong>Possível duplicada.</strong> Parecida com: “{s.faqParecida}”
                      </p>
                    )}
                    {s.oculta && <p className="text-xs text-muted">Oculta no telão</p>}
                    {!s.possivelDuplicada && !s.oculta && (
                      <span className="text-xs text-finalizado-fg">Nova</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right sm:pr-5">
                    <div className="flex items-center justify-end gap-1.5">
                      <form action={alternarOculta.bind(null, s.id, !s.oculta)}>
                        <BotaoAcao
                          type="submit"
                          icone={s.oculta ? "reabrir" : "bloquear"}
                          tom="neutro"
                          rotulo={s.oculta ? "Mostrar no telão" : "Ocultar do telão"}
                          soIcone
                        />
                      </form>
                      <form action={excluir.bind(null, s.id)}>
                        <BotaoExcluir
                          mensagem={`Excluir a sugestão de ${s.nome}? Isso não pode ser desfeito.`}
                        />
                      </form>
                    </div>
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
