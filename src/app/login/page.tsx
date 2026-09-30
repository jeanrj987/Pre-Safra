import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { autenticar, iniciarSessao } from "@/lib/auth";
import BotaoEnviar from "@/app/BotaoEnviar";
import CampoSenha from "@/app/CampoSenha";
import Icone from "@/app/Icone";

export default async function Login({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;

  async function entrar(formData: FormData) {
    "use server";
    const usuario = await autenticar(
      String(formData.get("email") ?? ""),
      String(formData.get("senha") ?? ""),
    );
    if (!usuario) redirect("/login?erro=1");
    await iniciarSessao(usuario);
    // O cache de navegação do cliente guarda o RSC de cada rota; sem isso, depois de
    // logar/deslogar ele pode reaproveitar conteúdo renderizado com a sessão anterior.
    revalidatePath("/", "layout");
    redirect("/");
  }

  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      {/* Painel da marca (só em telas grandes) */}
      <aside className="relative hidden overflow-hidden bg-night bg-[radial-gradient(ellipse_at_bottom_left,rgba(79,184,204,0.28),transparent_60%)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-9 w-auto self-start" />
        <div className="max-w-md">
          <p className="text-sm font-medium text-brand">Pré-Safra 2026</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
            Cada cliente pronto antes da safra começar.
          </h2>
          <p className="mt-4 text-base text-white/70">
            Acompanhe prazos, responsáveis e o andamento de todos os clientes em um só lugar.
          </p>
        </div>
        <p className="text-xs text-white/50">Uso interno · equipe de atendimento</p>
      </aside>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="inline-block rounded-lg bg-night px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-7 w-auto" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted">
            Entre com seu e-mail e senha para acessar o acompanhamento.
          </p>

          <form action={entrar} className="mt-6 space-y-4">
            <label className="block">
              <span className="rotulo">E-mail</span>
              <input
                type="email"
                name="email"
                autoFocus
                required
                autoComplete="username"
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? "erro-senha" : undefined}
                className="campo"
              />
            </label>
            <label className="block">
              <span className="rotulo">Senha</span>
              <CampoSenha
                name="senha"
                required
                autoComplete="current-password"
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? "erro-senha" : undefined}
              />
            </label>
            {erro && (
              <p
                id="erro-senha"
                role="alert"
                className="flex items-center gap-2 rounded-lg bg-atrasado-bg px-3 py-2 text-sm font-medium text-atrasado-fg"
              >
                <Icone nome="alerta" />
                E-mail ou senha incorretos. Tente novamente.
              </p>
            )}
            <BotaoEnviar pendente="Entrando…" className="btn-primario w-full">
              Entrar
            </BotaoEnviar>
          </form>

          {/* Telão do evento: página pública, não precisa de login */}
          <div className="mt-6 border-t border-line pt-6">
            <a href="/telao" className="btn-contorno w-full">
              <Icone nome="nota" />
              Abrir telão de ideias
            </a>
            <p className="ajuda text-center">Sem login — mostra o QR code e as ideias do evento.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
