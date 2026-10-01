import { cookies } from "next/headers";

// O cookie é gravado pelo BotaoTema, no navegador (ver src/app/BotaoTema.tsx).
export const COOKIE_TEMA = "presafra_tema";

export type Tema = "claro" | "escuro";

export async function obterTema(): Promise<Tema> {
  const valor = (await cookies()).get(COOKIE_TEMA)?.value;
  return valor === "escuro" ? "escuro" : "claro";
}
