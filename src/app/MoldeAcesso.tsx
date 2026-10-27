import type { ReactNode } from "react";

// Moldura das telas públicas de acesso (redefinir senha): logo da marca e um bloco
// centralizado, no mesmo estilo da versão de celular da tela de login.
export default function MoldeAcesso({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="inline-block rounded-lg bg-night px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-controlsoft.webp" alt="ControlSoft" className="h-7 w-auto" />
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
