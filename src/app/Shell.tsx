import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { encerrarSessao, usuarioAtual } from "@/lib/auth";
import {
  listarSafrasAtivas,
  obterSafraSelecionada,
  selecionarSafraCookie,
  tituloPreSafra,
} from "@/lib/safra";
import { COOKIE_TEMA } from "@/lib/tema";
import Icone, { type NomeIcone } from "./Icone";
import BotaoSidebar from "./BotaoSidebar";
import BotaoTema from "./BotaoTema";
import IndicadorLink from "./IndicadorLink";
import SeletorSafra from "./SeletorSafra";

type Pagina = "clientes" | "painel" | "calendario" | "novo" | "admin" | "telao";

type ItemNav = {
  id: Pagina;
  href: string;
  rotulo: string;
  icone: NomeIcone;
  // Rótulo enxuto para a barra do celular, onde cinco itens precisam caber lado a lado
  rotuloCurto: string;
  // Abre em outra aba (tela cheia para projetor/TV, sem a navegação do app)
  novaAba?: boolean;
};

// Guarda se a sidebar do desktop está escondida — o cookie deixa a preferência sobreviver a
// navegações e recarregamentos, sem precisar de JS no cliente (mesmo padrão do cookie de
// safra selecionada, ver src/lib/safra.ts).
const COOKIE_SIDEBAR = "presafra_sidebar_colapsada";

const NAV_CLIENTES: ItemNav = { id: "clientes", href: "/", rotulo: "Clientes", rotuloCurto: "Clientes", icone: "lista" };
// Só de leitura, liberado a todos os usuários (a conta "somente Painel", ex.: TV da sala, só vê isto e o Telão).
const NAV_PAINEL: ItemNav = { id: "painel", href: "/painel", rotulo: "Painel", rotuloCurto: "Painel", icone: "painel" };
// Lançamentos livres da equipe (avisos, atualizações de cliente…). Não aparece para a conta
// "somente Painel": ver exigirAcessoCompleto() em src/lib/auth.ts.
const NAV_CALENDARIO: ItemNav = {
  id: "calendario",
  href: "/calendario",
  rotulo: "Calendário",
  rotuloCurto: "Agenda",
  icone: "calendario",
};
const NAV_NOVO: ItemNav = { id: "novo", href: "/novo", rotulo: "Novo cliente", rotuloCurto: "Novo", icone: "mais" };
const NAV_ADMIN: ItemNav = { id: "admin", href: "/admin", rotulo: "Admin", rotuloCurto: "Admin", icone: "engrenagem" };
// Telão de ideias do evento: QR code do formulário de sugestões + as ideias chegando ao vivo.
// Admin e contas "somente Painel" (ex.: TV da sala).
const NAV_TELAO: ItemNav = {
  id: "telao",
  href: "/telao",
  rotulo: "Telão de ideias",
  rotuloCurto: "Telão",
  icone: "nota",
  novaAba: true,
};

export default async function Shell({
  ativo,
  children,
}: {
  ativo: Pagina;
  children: ReactNode;
}) {
  async function sair() {
    "use server";
    await encerrarSessao();
    revalidatePath("/", "layout");
    redirect("/login");
  }

  async function selecionarSafra(safraId: number) {
    "use server";
    await selecionarSafraCookie(safraId);
    revalidatePath("/", "layout");
  }

  const [usuario, safras, safraAtual, cookieJar] = await Promise.all([
    usuarioAtual(),
    listarSafrasAtivas(),
    obterSafraSelecionada(),
    cookies(),
  ]);
  const sidebarColapsada = cookieJar.get(COOKIE_SIDEBAR)?.value === "1";

  const NAV: ItemNav[] = usuario?.somentePainel
    ? [NAV_PAINEL, NAV_TELAO]
    : usuario?.admin
      ? [NAV_CLIENTES, NAV_PAINEL, NAV_CALENDARIO, NAV_NOVO, NAV_TELAO, NAV_ADMIN]
      : [NAV_CLIENTES, NAV_PAINEL, NAV_CALENDARIO, NAV_NOVO];

  const paginaAtual = NAV.find((n) => n.id === ativo);

  return (
    <div
      data-shell
      data-colapsada={String(sidebarColapsada)}
      className="group/shell min-h-screen lg:data-[colapsada=false]:pl-60 lg:data-[colapsada=true]:pl-16"
    >
      {/* Desktop: sidebar fixa (navegação escala na vertical conforme surgem módulos).
          Quando a pessoa clica em "Esconder menu" na topbar, o botão troca o atributo
          data-colapsada no navegador (sem ir ao servidor) e o CSS reduz a sidebar a uma faixa
          estreita só com os ícones (rótulos escondidos, dicas no hover via title). */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col overflow-hidden bg-night text-white lg:flex lg:group-data-[colapsada=true]/shell:w-16">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 pl-5 pr-3 group-data-[colapsada=true]/shell:justify-center group-data-[colapsada=true]/shell:px-0">
          <Link
            href="/"
            className="flex items-center group-data-[colapsada=true]/shell:hidden"
            aria-label="Início"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-6 w-auto" />
          </Link>
          <BotaoSidebar
            colapsadaInicial={sidebarColapsada}
            nomeCookie={COOKIE_SIDEBAR}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          />
        </div>

        <nav aria-label="Principal" className="flex-1 space-y-1 px-3 py-4">
          <p className="truncate px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40 group-data-[colapsada=true]/shell:hidden">
            {tituloPreSafra(safraAtual)}
          </p>
          {NAV.map((n) => {
            const atual = ativo === n.id;
            return (
              <Link
                key={n.id}
                href={n.href}
                target={n.novaAba ? "_blank" : undefined}
                rel={n.novaAba ? "noopener" : undefined}
                aria-current={atual ? "page" : undefined}
                aria-label={n.rotulo}
                title={n.rotulo}
                className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition group-data-[colapsada=true]/shell:justify-center group-data-[colapsada=true]/shell:px-0 ${
                  atual
                    ? "bg-primary text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icone nome={n.icone} className="size-[18px] shrink-0" />
                <span className="truncate group-data-[colapsada=true]/shell:hidden">{n.rotulo}</span>
                {!n.novaAba && (
                  <IndicadorLink className="ml-auto group-data-[colapsada=true]/shell:absolute group-data-[colapsada=true]/shell:right-1 group-data-[colapsada=true]/shell:top-1 group-data-[colapsada=true]/shell:ml-0 group-data-[colapsada=true]/shell:size-2.5" />
                )}
              </Link>
            );
          })}
        </nav>

        {usuario && (
          <p
            className="truncate px-4 pb-1 text-xs text-white/50 group-data-[colapsada=true]/shell:hidden"
            title={usuario.email}
          >
            {usuario.nome}
          </p>
        )}
        <form action={sair} className="border-t border-white/10 p-3">
          <button
            aria-label="Sair"
            title="Sair"
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white group-data-[colapsada=true]/shell:justify-center group-data-[colapsada=true]/shell:px-0"
          >
            <Icone nome="sair" className="size-[18px] shrink-0" />
            <span className="group-data-[colapsada=true]/shell:hidden">Sair</span>
          </button>
        </form>
      </aside>

      {/* Desktop: topbar fina só com o contexto (onde estou / qual safra) */}
      <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:flex">
        <span className="text-sm font-semibold text-ink">{paginaAtual?.rotulo}</span>
        <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
        {safras.length > 0 ? (
          <SeletorSafra
            safras={safras}
            selecionada={safraAtual?.id ?? null}
            salvar={selecionarSafra}
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Icone nome="calendario" className="size-3.5" />
            Nenhuma safra cadastrada
          </span>
        )}
        <BotaoTema
          nomeCookie={COOKIE_TEMA}
          className="ml-auto grid size-9 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink"
        />
      </header>

      {/* Celular e tablet: barra escura. Primeira linha com marca, safra e atalhos; a navegação
          fica numa linha própria embaixo (ícone + rótulo curto no celular, rótulo completo a
          partir de sm), dividindo a largura igualmente — nada precisa rolar nem quebrar. */}
      <header className="sticky top-0 z-30 bg-night text-white lg:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-6 w-auto sm:h-7" />
            <span className="hidden h-5 w-px bg-white/20 sm:block" />
            <span className="hidden max-w-40 truncate text-sm font-semibold text-white/90 sm:block">
              {tituloPreSafra(safraAtual)}
            </span>
          </Link>

          {safras.length > 0 && (
            <div className="min-w-0">
              <SeletorSafra
                safras={safras}
                selecionada={safraAtual?.id ?? null}
                salvar={selecionarSafra}
              />
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <BotaoTema
              nomeCookie={COOKIE_TEMA}
              className="grid size-9 cursor-pointer place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
            />

            <form action={sair}>
              <button
                aria-label="Sair"
                title="Sair"
                className="inline-flex size-9 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white sm:w-auto sm:px-2.5"
              >
                <Icone nome="sair" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Principal" className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl px-1 sm:px-6">
            {NAV.map((n) => {
              const atual = ativo === n.id;
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  target={n.novaAba ? "_blank" : undefined}
                  rel={n.novaAba ? "noopener" : undefined}
                  aria-current={atual ? "page" : undefined}
                  className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition sm:flex-row sm:gap-2 sm:text-sm ${
                    atual ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  <Icone nome={n.icone} className="size-[18px] shrink-0" />
                  <span className="truncate sm:hidden">{n.rotuloCurto}</span>
                  <span className="hidden truncate sm:inline">{n.rotulo}</span>
                  {!n.novaAba && <IndicadorLink className="absolute right-2 top-2 sm:static sm:ml-0.5" />}
                  {atual && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main
        className={`mx-auto w-full px-4 sm:px-8 ${
          // O Painel não tem a barra flutuante de ações em lote (fixa, só na lista de clientes),
          // então não precisa do respiro extra embaixo, ganha espaçamento mais compacto entre as
          // seções e usa mais largura (até 1800px) para caber os 4 gráficos numa linha só em
          // telas bem largas, como a TV da sala. A lista de clientes também usa mais largura
          // (até 1600px) para os nomes não quebrarem de linha na tabela. O Calendário também
          // (sete colunas de atividades) e, como o Painel, não tem barra flutuante embaixo.
          ativo === "painel"
            ? "max-w-[1800px] space-y-4 pt-4 pb-8"
            : ativo === "calendario"
              ? "max-w-[1600px] space-y-4 pt-6 pb-8"
              : ativo === "clientes"
              ? "max-w-[1600px] space-y-6 pt-8 pb-28"
              : "max-w-7xl space-y-6 pt-8 pb-28"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
