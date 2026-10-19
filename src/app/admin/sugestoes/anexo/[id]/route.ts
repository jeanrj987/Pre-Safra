import { usuarioAtual } from "@/lib/auth";
import { pode } from "@/lib/permissoes";
import { prisma } from "@/lib/db";

// Abre um anexo de sugestão. Só o admin: o arquivo veio do público e pode ter dado de cliente.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual();
  if (!usuario || !pode(usuario, "sugestoes")) return new Response(null, { status: 401 });

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response(null, { status: 404 });

  const anexo = await prisma.anexoSugestao.findUnique({ where: { id } });
  if (!anexo) return new Response(null, { status: 404 });

  // O tipo foi detectado pelos bytes ao salvar (só imagem ou PDF), e o nosniff do next.config
  // impede o navegador de tratar o arquivo como outra coisa. O sandbox bloqueia scripts do PDF
  // sem estragar a imagem.
  return new Response(anexo.dados, {
    headers: {
      "Content-Type": anexo.tipo,
      "Content-Length": String(anexo.dados.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(anexo.nome)}`,
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}
