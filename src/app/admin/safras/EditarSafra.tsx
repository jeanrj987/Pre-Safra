"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import Icone from "@/app/Icone";

// Alterna entre "ver" e "editar": início/prazo precisam ser validados juntos antes de
// gravar, então não é autosave por campo (diferente de CampoResponsavel/CampoData).
export default function EditarSafra({
  exibicao,
  inicio,
  prazo,
  salvar,
}: {
  exibicao: string;
  inicio: string;
  prazo: string;
  salvar: (formData: FormData) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        <span className="tabular-nums">{exibicao}</span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar datas"
          title="Editar datas"
          className="text-muted transition hover:text-primary"
        >
          <Icone nome="calendario" className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await salvar(formData);
        setEditando(false);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="block">
        <span className="rotulo text-xs">Início</span>
        <input type="date" name="inicio" defaultValue={inicio} required className="campo" />
      </label>
      <label className="block">
        <span className="rotulo text-xs">Prazo</span>
        <input type="date" name="prazo" defaultValue={prazo} required className="campo" />
      </label>
      <BotaoEnviar pendente="Salvando…" className="btn-primario btn-sm">
        Salvar
      </BotaoEnviar>
      <button type="button" onClick={() => setEditando(false)} className="btn-contorno btn-sm">
        Cancelar
      </button>
    </form>
  );
}
