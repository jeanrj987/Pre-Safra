import { redirect } from "next/navigation";
import { exigirAreaAdmin } from "@/lib/auth";
import { abaInicial } from "./abas";

export default async function AdminIndex() {
  const usuario = await exigirAreaAdmin();
  redirect(abaInicial(usuario) ?? "/");
}
