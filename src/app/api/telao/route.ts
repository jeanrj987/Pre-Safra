import { carregarTelao } from "@/lib/telao";

// Consultada a cada poucos segundos pelo telão (ver Telao.tsx). PÚBLICA, como a página /telao:
// devolve só o que já aparece na tela (primeiro nome, assunto, texto). Route Handlers não são
// cacheados por padrão.
export async function GET() {
  return Response.json(await carregarTelao(), { headers: { "Cache-Control": "no-store" } });
}
