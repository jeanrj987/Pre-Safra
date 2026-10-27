import { timingSafeEqual } from "node:crypto";
import { registrarFotos } from "@/lib/fotos";

// Chamada uma vez por dia pelo cron da Vercel (ver vercel.json), que envia
// "Authorization: Bearer <CRON_SECRET>". Sem CRON_SECRET configurada, a rota recusa tudo: não
// existe modo aberto. Tirar a foto de novo no mesmo dia só refaz a foto daquele dia.
export const maxDuration = 60;

function autorizado(cabecalho: string | null): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || !cabecalho) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const recebido = Buffer.from(cabecalho);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get("authorization"))) return new Response(null, { status: 401 });
  const { dia, total } = await registrarFotos();
  return Response.json({ dia: new Date(dia).toISOString().slice(0, 10), total }, { headers: { "Cache-Control": "no-store" } });
}
