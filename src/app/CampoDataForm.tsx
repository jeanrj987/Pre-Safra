"use client";
import { useRef } from "react";
import { motivoDiaBloqueado } from "@/lib/diasUteis";

// Campo de data prevista dos formulários (Novo cliente e Registro). Impede enviar o formulário
// com sábado, domingo ou feriado: o navegador mostra o motivo ao tentar salvar. Uma data antiga
// já salva (ex.: importada da planilha) não bloqueia o formulário enquanto não for alterada.
export default function CampoDataForm({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const original = useRef(defaultValue);
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      className="campo"
      onChange={(e) => {
        const campo = e.currentTarget;
        const motivo =
          campo.value && campo.value !== original.current ? motivoDiaBloqueado(campo.value) : null;
        campo.setCustomValidity(motivo ?? "");
        if (motivo) campo.reportValidity();
      }}
    />
  );
}
