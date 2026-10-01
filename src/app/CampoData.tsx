"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { motivoDiaBloqueado } from "@/lib/diasUteis";

// Campo de data prevista na própria linha da lista: grava assim que a data muda.
// Fica sem `name` para não ser enviado junto com o formulário de ações em lote.
// Sábados, domingos e feriados são recusados: o campo volta para a data anterior e explica o motivo.
export default function CampoData({
  id,
  nome,
  valor,
  salvar,
}: {
  id: number;
  nome: string;
  valor: string;
  salvar: (id: number, data: string) => Promise<void>;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState(false);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  // Última data válida: para onde o campo volta quando a escolhida é recusada.
  const ultimaValida = useRef(valor);

  useEffect(() => {
    if (!bloqueio) return;
    const t = setTimeout(() => setBloqueio(null), 5000);
    return () => clearTimeout(t);
  }, [bloqueio]);

  return (
    <div className="relative">
      <input
        type="date"
        defaultValue={valor}
        aria-busy={pendente}
        aria-label={`Data prevista de ${nome}`}
        aria-invalid={erro || !!bloqueio}
        title={erro ? "Não foi possível salvar. Tente de novo." : undefined}
        onChange={(e) => {
          const campo = e.currentTarget;
          const data = campo.value;
          // Enquanto se digita, a data pode estar incompleta (o navegador informa ""):
          // só limpa a data se o campo foi esvaziado, e nunca grava uma data pela metade.
          if (!data && !campo.validity.valid) return;
          const motivo = data ? motivoDiaBloqueado(data) : null;
          if (motivo) {
            campo.value = ultimaValida.current;
            setBloqueio(motivo);
            return;
          }
          setBloqueio(null);
          setErro(false);
          iniciar(async () => {
            try {
              await salvar(id, data);
              ultimaValida.current = data;
            } catch {
              setErro(true);
            }
          });
        }}
        // Enter dentro do campo não pode disparar a ação em lote do formulário da lista.
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className={`h-8 w-36 rounded-lg border bg-surface px-2 text-sm tabular-nums text-ink transition hover:border-muted focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ${
          pendente ? "opacity-60" : ""
        } ${erro || bloqueio ? "border-atrasado-dot" : "border-line-strong"}`}
      />
      {bloqueio && (
        <span
          role="alert"
          className="absolute left-0 top-full z-20 mt-1 w-56 whitespace-normal rounded-lg bg-atrasado-bg px-2.5 py-1.5 text-xs font-medium text-atrasado-fg shadow-pop"
        >
          {bloqueio}
        </span>
      )}
    </div>
  );
}
