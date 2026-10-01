"use client";
import BotaoEnviar from "@/app/BotaoEnviar";
import { SEGUNDOS_PAGINA_TELAO } from "@/lib/sugestoes";

// Quanto cada página de ideias fica no telão antes de girar para a próxima. O telão aplica o valor
// novo sozinho, na próxima consulta (alguns segundos), sem precisar recarregar.
export default function TempoTelao({
  segundos,
  salvar,
}: {
  segundos: number;
  salvar: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={salvar} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="rotulo text-xs">Tempo de cada página no telão (segundos)</span>
        <input
          type="number"
          name="segundos"
          defaultValue={segundos}
          min={SEGUNDOS_PAGINA_TELAO.min}
          max={SEGUNDOS_PAGINA_TELAO.max}
          step={1}
          required
          inputMode="numeric"
          className="campo w-28"
        />
      </label>
      <BotaoEnviar pendente="Salvando…" className="btn-primario btn-sm">
        Salvar
      </BotaoEnviar>
    </form>
  );
}
