import { cookies } from "next/headers";

const COOKIE_TEMA = "presafra_tema";

export type Tema = "claro" | "escuro";

export async function obterTema(): Promise<Tema> {
  const valor = (await cookies()).get(COOKIE_TEMA)?.value;
  return valor === "escuro" ? "escuro" : "claro";
}

export async function salvarTemaCookie(tema: Tema) {
  (await cookies()).set(COOKIE_TEMA, tema, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
