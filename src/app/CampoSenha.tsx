"use client";
import { useState, type ComponentProps } from "react";
import Icone from "./Icone";

// Campo de senha com o "olhinho" para mostrar/esconder o que foi digitado. Aceita as mesmas
// props de um <input>; o type é controlado aqui.
export default function CampoSenha(props: Omit<ComponentProps<"input">, "type">) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visivel ? "text" : "password"} className="campo pr-10" />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        title={visivel ? "Esconder senha" : "Mostrar senha"}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
        aria-pressed={visivel}
        className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center text-muted transition hover:text-ink"
      >
        <Icone nome={visivel ? "olhoFechado" : "olho"} />
      </button>
    </div>
  );
}
