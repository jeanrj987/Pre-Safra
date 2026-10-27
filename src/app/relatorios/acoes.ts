"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth";
import { registrarFotos } from "@/lib/fotos";

// Tira a foto do dia sem esperar o cron (ex.: logo depois de publicar, para o relatório
// "Evolução" já ter o primeiro ponto). Quem gerencia safras pode; repetir no mesmo dia só refaz a foto.
export async function tirarFotoAgora() {
  await exigirPermissao("safras");
  await registrarFotos();
  revalidatePath("/relatorios");
}
