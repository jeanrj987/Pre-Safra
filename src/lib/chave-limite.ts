// Pedaço do limitador que não depende do banco, para os scripts (tsx) poderem usar o cliente do
// Prisma deles sem criar um segundo. A chave (e-mail, IP...) vira HMAC-SHA256 com AUTH_SECRET.
import { createHmac } from "node:crypto";

export const TIPO_LOGIN = "login";

export function hashDaChave(chave: string): string {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) throw new Error("AUTH_SECRET não configurado");
  return createHmac("sha256", segredo).update(`limitador:${chave}`).digest("hex");
}
