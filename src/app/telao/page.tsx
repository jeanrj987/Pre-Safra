import { headers } from "next/headers";
import QRCode from "qrcode";
import { carregarTelao } from "@/lib/telao";
import Telao from "./Telao";

export const metadata = { title: "Telão de ideias · Pré-Safra", robots: { index: false } };

// Página PÚBLICA de propósito: fica aberta no projetor do evento sem ninguém precisar entrar
// (há um botão para ela na tela de login). Só expõe primeiro nome, assunto e texto das ideias
// visíveis; WhatsApp e sobrenome nunca saem do servidor (ver paraTelao em src/lib/sugestoes.ts).
export default async function PaginaTelao() {
  // O QR aponta para o mesmo domínio em que o telão foi aberto (produção, preview ou local).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const urlFormulario = `${protocolo}://${host}/sugestao`;

  const [inicial, qrSvg] = await Promise.all([
    carregarTelao(),
    QRCode.toString(urlFormulario, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b2e3a", light: "#ffffff" },
    }),
  ]);

  return <Telao inicial={inicial} urlFormulario={urlFormulario} qrSvg={qrSvg} />;
}
