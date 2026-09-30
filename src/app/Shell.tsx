import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { encerrarSessao, usuarioAtual } from "@/lib/auth";
import { listarSafrasAtivas, obterSafraSelecionada, selecionarSafraCookie } from "@/lib/safra";
import { obterTema, salvarTemaCookie } from "@/lib/tema";
import Icone, { type NomeIcone } from "./Icone";
import SeletorSafra from "./SeletorSafra";

type Pagina = "clientes" | "painel" | "novo" | "admin" | "telao";

type ItemNav = {
  id: Pagina;
  href: string;
  rotulo: string;
  icone: NomeIcone;
  // Abre em outra aba (tela cheia para projetor/TV, sem a navegação do app)
  novaAba?: boolean;
};

// Guarda se a sidebar do desktop está escondida — o cookie deixa a preferência sobreviver a
// navegações e recarregamentos, sem precisar de JS no cliente (mesmo padrão do cookie de
// safra selecionada, ver src/lib/safra.ts).
const COOKIE_SIDEBAR = "presafra_sidebar_colapsada";

const NAV_CLIENTES: ItemNav = { id: "clientes", href: "/", rotulo: "Clientes", icone: "lista" };
// Liberado para admin e para contas "somente Painel" (ex.: TV da sala) — ver
// exigirAcessoPainel() em src/lib/auth.ts.
const NAV_PAINEL: ItemNav = { id: "painel", href: "/painel", rotulo: "Painel", icone: "painel" };
const NAV_NOVO: ItemNav = { id: "novo", href: "/novo", rotulo: "Novo cliente", icone: "mais" };
const NAV_ADMIN: ItemNav = { id: "admin", href: "/admin", rotulo: "Admin", icone: "engrenagem" };
// Telão de ideias do evento: QR code do formulário de sugestões + as ideias chegando ao vivo.
// Mesmo acesso do Painel (admin e contas "somente Painel"), ver exigirAcessoPainel().
const NAV_TELAO: ItemNav = {
  id: "telao",
  href: "/telao",
  rotulo: "Telão de ideias",
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

  async function alternarSidebar() {
    "use server";
    const jar = await cookies();
    const colapsada = jar.get(COOKIE_SIDEBAR)?.value === "1";
    jar.set(COOKIE_SIDEBAR, colapsada ? "0" : "1", {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    revalidatePath("/", "layout");
  }

  async function alternarTema() {
    "use server";
    const atual = await obterTema();
    await salvarTemaCookie(atual === "escuro" ? "claro" : "escuro");
    revalidatePath("/", "layout");
  }

  const [usuario, safras, safraAtual, cookieJar, tema] = await Promise.all([
    usuarioAtual(),
    listarSafrasAtivas(),
    obterSafraSelecionada(),
    cookies(),
    obterTema(),
  ]);
  const sidebarColapsada = cookieJar.get(COOKIE_SIDEBAR)?.value === "1";

  const NAV: ItemNav[] = usuario?.somentePainel
    ? [NAV_PAINEL, NAV_TELAO]
    : usuario?.admin
      ? [NAV_CLIENTES, NAV_PAINEL, NAV_NOVO, NAV_TELAO, NAV_ADMIN]
      : [NAV_CLIENTES, NAV_NOVO];

  const paginaAtual = NAV.find((n) => n.id === ativo);

  return (
    <div className={`min-h-screen ${sidebarColapsada ? "" : "lg:pl-60"}`}>
      {/* Desktop: sidebar fixa (navegação escala na vertical conforme surgem módulos).
          Escondida via cookie quando a pessoa clica em "Esconder menu" na topbar. */}
      {!sidebarColapsada && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-night text-white lg:flex">
          <Link
            href="/"
            className="flex h-14 items-center gap-3 border-b border-white/10 px-5"
            aria-label="Início"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-6 w-auto" />
          </Link>

          <nav aria-label="Principal" className="flex-1 space-y-1 px-3 py-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Pré-Safra
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
                  className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                    atual
                      ? "bg-primary text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icone nome={n.icone} className="size-[18px]" />
                  {n.rotulo}
                </Link>
              );
            })}
          </nav>

          {usuario && (
            <p className="truncate px-4 pb-1 text-xs text-white/50" title={usuario.email}>
              {usuario.nome}
            </p>
          )}
          <form action={sair} className="border-t border-white/10 p-3">
            <button className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
              <Icone nome="sair" className="size-[18px]" />
              Sair
            </button>
          </form>
        </aside>
      )}

      {/* Desktop: topbar fina só com o contexto (onde estou / qual safra) */}
      <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:flex">
        <form action={alternarSidebar}>
          <button
            type="submit"
            aria-label={sidebarColapsada ? "Mostrar menu" : "Esconder menu"}
            title={sidebarColapsada ? "Mostrar menu" : "Esconder menu"}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink"
          >
            <Icone nome="menu" />
          </button>
        </form>
        <span className="h-4 w-px bg-line-strong" aria-hidden="true" />
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
        <form action={alternarTema} className="ml-auto">
          <button
            type="submit"
            aria-label={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
            title={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink"
          >
            <Icone nome={tema === "escuro" ? "sol" : "lua"} />
          </button>
        </form>
      </header>

      {/* Celular e tablet: barra escura com a navegação em linha */}
      <header className="sticky top-0 z-30 bg-night text-white lg:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 sm:h-14 sm:flex-nowrap sm:px-8 sm:py-0">
          <Link href="/" className="flex items-center gap-3" aria-label="Início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-7 w-auto" />
            <span className="hidden h-5 w-px bg-white/20 sm:block" />
            <span className="hidden text-sm font-semibold text-white/90 sm:block">
              Pré-Safra
            </span>
          </Link>

          {safras.length > 0 && (
            <SeletorSafra
              safras={safras}
              selecionada={safraAtual?.id ?? null}
              salvar={selecionarSafra}
            />
          )}

          <nav
            aria-label="Principal"
            className="order-3 -mx-1 flex w-full gap-1 pb-2 sm:order-none sm:mx-0 sm:h-full sm:w-auto sm:pb-0"
          >
            {NAV.map((n) => {
              const atual = ativo === n.id;
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  target={n.novaAba ? "_blank" : undefined}
                  rel={n.novaAba ? "noopener" : undefined}
                  aria-current={atual ? "page" : undefined}
                  className={`relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition sm:rounded-none sm:py-0 ${
                    atual
                      ? "bg-white/10 text-white sm:bg-transparent"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {n.rotulo}
                  {atual && (
                    <span className="absolute inset-x-3 bottom-0 hidden h-0.5 rounded-full bg-brand sm:block" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <form action={alternarTema}>
              <button
                type="submit"
                aria-label={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
                title={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
                className="grid size-9 cursor-pointer place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <Icone nome={tema === "escuro" ? "sol" : "lua"} />
              </button>
            </form>

            <form action={sair}>
              <button className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white">
                <Icone nome="sair" />
                <span className="hidden sm:inline">Sair</span>
                <span className="sr-only sm:hidden">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full px-4 sm:px-8 ${
          // O Painel não tem a barra flutuante de ações em lote (fixa, só na lista de clientes),
          // então não precisa do respiro extra embaixo, ganha espaçamento mais compacto entre as
          // seções e usa mais largura (até 1800px) para caber os 4 gráficos numa linha só em
          // telas bem largas, como a TV da sala.
          ativo === "painel" ? "max-w-[1800px] space-y-4 pt-4 pb-8" : "max-w-7xl space-y-6 pt-8 pb-28"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
