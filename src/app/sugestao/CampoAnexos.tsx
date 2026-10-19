"use client";
import { useId, useRef, useState, type ChangeEvent } from "react";
import Icone from "@/app/Icone";
import {
  ACCEPT_ANEXO,
  formatarTamanho,
  LIMITES_ANEXO,
  TEXTO_LIMITE_ANEXO,
  TIPOS_ANEXO,
  type TipoAnexo,
} from "@/lib/anexos";
import { reduzirImagem } from "./reduzirImagem";

const ehTipoAceito = (tipo: string): tipo is TipoAnexo => TIPOS_ANEXO.includes(tipo as TipoAnexo);

// A miniatura usa um endereço temporário do navegador, criado ao entrar na tela e liberado ao sair
// (a função devolvida pelo ref roda quando o arquivo sai da lista).
function Miniatura({ arquivo }: { arquivo: File }) {
  const imagem = arquivo.type.startsWith("image/");
  return (
    <span
      aria-hidden="true"
      ref={(el) => {
        if (!el || !imagem) return;
        const endereco = URL.createObjectURL(arquivo);
        el.style.backgroundImage = `url(${endereco})`;
        return () => URL.revokeObjectURL(endereco);
      }}
      className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft bg-cover bg-center text-primary"
    >
      {!imagem && <Icone nome="arquivo" className="size-5" />}
    </span>
  );
}

export default function CampoAnexos({
  arquivos,
  aoMudar,
  desabilitado,
}: {
  arquivos: File[];
  aoMudar: (arquivos: File[]) => void;
  desabilitado?: boolean;
}) {
  const idAjuda = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const cheio = arquivos.length >= LIMITES_ANEXO.arquivos;

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(e.target.files ?? []);
    // Limpa o campo para poder escolher de novo o mesmo arquivo depois de removê-lo
    e.target.value = "";
    if (escolhidos.length === 0) return;

    setLendo(true);
    setAviso(null);
    const novos = [...arquivos];
    const avisos: string[] = [];
    for (const original of escolhidos) {
      if (novos.length >= LIMITES_ANEXO.arquivos) {
        avisos.push(`Só cabem ${LIMITES_ANEXO.arquivos} arquivos.`);
        break;
      }
      if (!ehTipoAceito(original.type)) {
        avisos.push(`“${original.name}” não é imagem (PNG, JPG ou WebP) nem PDF.`);
        continue;
      }
      const arquivo = await reduzirImagem(original);
      const somaAtual = novos.reduce((soma, a) => soma + a.size, 0);
      if (arquivo.size > LIMITES_ANEXO.bytesPorArquivo) {
        avisos.push(`“${original.name}” passa de ${LIMITES_ANEXO.bytesPorArquivo / 1024 / 1024} MB.`);
        continue;
      }
      if (somaAtual + arquivo.size > LIMITES_ANEXO.bytesTotal) {
        avisos.push(`“${original.name}” não cabe: os anexos somam mais de ${LIMITES_ANEXO.bytesTotal / 1024 / 1024} MB.`);
        continue;
      }
      novos.push(arquivo);
    }
    aoMudar(novos);
    setAviso(avisos.length ? avisos.join(" ") : null);
    setLendo(false);
  }

  function remover(indice: number) {
    aoMudar(arquivos.filter((_, i) => i !== indice));
    setAviso(null);
    entrada.current?.focus();
  }

  return (
    <div className="mt-2.5">
      {arquivos.length > 0 && (
        <ul aria-label="Arquivos anexados" className="mb-2.5 space-y-2">
          {arquivos.map((a, i) => (
            <li
              key={`${a.name}-${a.size}-${i}`}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-primary-faint p-1.5"
            >
              <Miniatura arquivo={a} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{a.name}</span>
                <span className="text-xs text-muted">{formatarTamanho(a.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => remover(i)}
                disabled={desabilitado}
                aria-label={`Remover ${a.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-md text-muted transition hover:bg-subtle hover:text-atrasado-fg"
              >
                <Icone nome="x" className="size-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Botão que abre o seletor do aparelho (galeria, câmera ou arquivos) */}
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={desabilitado || lendo || cheio}
          aria-describedby={idAjuda}
          className="btn-contorno"
        >
          <Icone nome="clipe" className="size-[18px]" />
          {lendo
            ? "Preparando…"
            : arquivos.length === 0
              ? "Anexar imagem ou PDF"
              : "Anexar mais um"}
        </button>
        <span id={idAjuda} className="text-xs text-muted">
          {arquivos.length === 0
            ? TEXTO_LIMITE_ANEXO
            : `${arquivos.length} de ${LIMITES_ANEXO.arquivos} arquivos`}
        </span>
        <input
          ref={entrada}
          type="file"
          accept={ACCEPT_ANEXO}
          multiple
          tabIndex={-1}
          onChange={escolher}
          className="sr-only"
        />
      </div>

      <p role="alert" className="mt-2 text-sm font-medium text-atrasado-fg empty:hidden">
        {aviso}
      </p>
    </div>
  );
}
