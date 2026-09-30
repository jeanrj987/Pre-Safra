import type { Metadata } from "next";
import FormSugestao from "./FormSugestao";

// Página PÚBLICA (aberta pelo QR code do evento): não pede login e não usa o Shell do app.
export const metadata: Metadata = {
  title: "Sugira um tema para o FAQ",
  description: "Diga qual dúvida ou tema deveria ter no FAQ da ControlSoft.",
  robots: { index: false, follow: false },
};

export default function PaginaSugestao() {
  return (
    <>
      <header className="bg-night px-4 py-4">
        <div className="mx-auto max-w-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-7 w-auto" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sua ideia para o FAQ</h1>
        <p className="mt-1 mb-5 text-sm text-muted">
          Conte o que você gostaria de ver no FAQ. Vamos conferir se já existe e, se for novo,
          guardamos a sua sugestão e ela aparece no telão.
        </p>
        <FormSugestao />
      </main>
    </>
  );
}
