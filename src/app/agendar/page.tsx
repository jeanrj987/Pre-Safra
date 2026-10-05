import { redirect } from "next/navigation";

// O agendamento agora é feito na janela "Agendar" de cada cliente, na lista principal.
export default function Agendar() {
  redirect("/");
}
