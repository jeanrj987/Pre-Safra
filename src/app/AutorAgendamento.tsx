import type { AutorNaLista } from "@/lib/autorAgendamento";

/**
 * Linha "Agendado por Maria S." da lista de clientes. O nome abreviado é o que se vê; o texto
 * completo (nome inteiro e carimbo) vai no tooltip do mouse e, para leitores de tela e teclado,
 * num texto equivalente só para eles, já que o `title` sozinho não é lido por todos.
 * Logo abaixo, quando informado, a linha "Falou com Ana Paula" (a pessoa do cliente com quem se
 * agendou), cortada com reticências se for longa; o nome inteiro fica no tooltip.
 */
export default function AutorAgendamento({ autor, className = "" }: { autor: AutorNaLista; className?: string }) {
  return (
    <>
      <div title={autor.dica} className={`max-w-40 truncate text-xs text-muted ${autor.semAutor ? "italic" : ""} ${className}`}>
        <span aria-hidden="true">{autor.texto}</span>
        <span className="sr-only">{autor.dica}</span>
      </div>
      {autor.contato && (
        <div title={autor.contato} className="max-w-40 truncate text-xs font-bold text-muted">
          {autor.contato}
        </div>
      )}
    </>
  );
}
