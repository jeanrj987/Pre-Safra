"use client";
import { useRef } from "react";
import { dataMaximaIso, hojeIso, motivoDataIndisponivel } from "@/lib/diasUteis";

// Campo de data prevista dos formulários (Novo cliente e Registro). Impede enviar o formulário
// com data passada, sábado, domingo ou feriado: o navegador mostra o motivo ao tentar salvar. Uma
// data antiga já salva (ex.: importada da planilha) não bloqueia o formulário enquanto não for alterada.
export default function CampoDataForm({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const original = useRef(defaultValue);
  const hoje = hojeIso();
  const limite = dataMaximaIso();
  return (
    <input
      type="date"
      name={name}
      defaultValue={defaultValue}
      // Com uma data antiga já salva, o `min` travaria o envio mesmo sem mexer no campo.
      min={defaultValue && defaultValue < hoje ? undefined : hoje}
      max={defaultValue && defaultValue > limite ? undefined : limite}
      className="campo"
      onChange={(e) => {
        const campo = e.currentTarget;
        const motivo =
          campo.value && campo.value !== original.current ? motivoDataIndisponivel(campo.value) : null;
        campo.setCustomValidity(motivo ?? "");
        // Digitando o ano, o valor passa por "0002", "0020"…: só avisa quando o ano está completo.
        if (motivo && Number(campo.value.slice(0, 4)) >= 1000) campo.reportValidity();
      }}
    />
  );
}
