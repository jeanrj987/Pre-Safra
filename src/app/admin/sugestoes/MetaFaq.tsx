"use client";
import BotaoEnviar from "@/app/BotaoEnviar";
import { META_FAQ } from "@/lib/sugestoes";

// Meta de sugestões de FAQ mostrada no telão. O telão aplica o valor novo sozinho, na próxima
// consulta (alguns segundos). Campo vazio remove a meta e a barra some do telão.
export default function MetaFaq({
  meta,
  salvar,
}: {
  meta: number | null;
  salvar: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={salvar} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="rotulo text-xs">Meta de sugestões de FAQ no telão</span>
        <input
          type="number"
          name="meta"
          defaultValue={meta ?? ""}
          min={META_FAQ.min}
          max={META_FAQ.max}
          step={1}
          inputMode="numeric"
          placeholder="Sem meta"
          className="campo w-28"
        />
      </label>
      <BotaoEnviar pendente="Salvando…" className="btn-primario btn-sm">
        Salvar
      </BotaoEnviar>
    </form>
  );
}
