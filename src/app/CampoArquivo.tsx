"use client";
import { useId, useState } from "react";

// input[type=file] nativo: o botão do navegador (::file-selector-button) não respeita a
// borda/altura do container em todos os navegadores. Em vez de estilizar isso, escondemos o
// input de verdade e usamos um <label> como botão — funciona com teclado (Tab + Enter/Espaço
// ainda ativam o input escondido) e o enquadramento fica sob nosso controle.
export default function CampoArquivo({
  name,
  accept,
  required,
}: {
  name: string;
  accept?: string;
  required?: boolean;
}) {
  const id = useId();
  const [nome, setNome] = useState<string | null>(null);

  return (
    <div className="flex h-10 items-stretch overflow-hidden rounded-lg border border-line-strong bg-surface transition hover:border-muted">
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="peer sr-only"
        onChange={(e) => setNome(e.currentTarget.files?.[0]?.name ?? null)}
      />
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center bg-subtle px-3 text-sm font-medium text-ink transition hover:bg-line/70 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-primary"
      >
        Escolher arquivo
      </label>
      <span className="flex min-w-0 flex-1 items-center truncate px-3 text-sm text-muted">
        {nome ?? "Nenhum arquivo escolhido"}
      </span>
    </div>
  );
}
