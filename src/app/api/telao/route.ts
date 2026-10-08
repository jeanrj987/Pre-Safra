import { carregarTelao } from "@/lib/telao";

// Consultada a cada poucos segundos pelo telão (ver Telao.tsx). PÚBLICA, como a página /telao:
// devolve só o que já aparece na tela (primeiro nome, assunto, texto). Route Handlers não são
// cacheados pelo Next, mas o cache da CDN (s-maxage) junta todos os telões abertos numa só
// consulta ao banco por janela; esconder uma ideia no admin leva alguns segundos para valer.
export async function GET() {
  return Response.json(await carregarTelao(), {
    headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=10" },
  });
}
