import { COR_STATUS, PONTO_STATUS } from "@/lib/dados";
import type { StatusPreSafra } from "@/lib/status";

const ROTULO: Record<StatusPreSafra, string> = {
  Finalizado: "Finalizado",
  "A Fazer": "A Fazer",
  "Agendado Online": "Agendado Online",
  "Agendado Presencial": "Agendado Presencial",
  Atrasado: "Atrasado",
  Inativo: "Inativo",
};

export default function Selo({ status }: { status: StatusPreSafra }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[status]}`}
    >
      <span className={`size-1.5 rounded-full ${PONTO_STATUS[status]}`} aria-hidden="true" />
      {ROTULO[status]}
    </span>
  );
}
