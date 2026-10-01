import Link from "next/link";
import Icone from "./Icone";

// Navegação entre páginas de uma lista (primeira, anterior, próxima, última) — mesmo visual
// da lista de clientes. Quem usa decide o endereço de cada página em `href`.
export default function Paginacao({
  paginaAtual,
  totalPaginas,
  href,
}: {
  paginaAtual: number;
  totalPaginas: number;
  href: (pagina: number) => string;
}) {
  if (totalPaginas <= 1) return null;
  const desativado = "btn-discreto btn-sm pointer-events-none opacity-50";
  const temAnterior = paginaAtual > 1;
  const temProxima = paginaAtual < totalPaginas;

  return (
    <nav
      aria-label="Páginas"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5"
    >
      <span className="text-sm text-muted">
        Página {paginaAtual} de {totalPaginas}
      </span>
      <div className="flex gap-2">
        {temAnterior ? (
          <>
            <Link href={href(1)} className="btn-discreto btn-sm !px-2" title="Primeira página">
              <Icone nome="extremo" />
              <span className="sr-only">Primeira</span>
            </Link>
            <Link href={href(paginaAtual - 1)} className="btn-discreto btn-sm">
              <Icone nome="voltar" />
              Anterior
            </Link>
          </>
        ) : (
          <>
            <span className={`${desativado} !px-2`}>
              <Icone nome="extremo" />
              <span className="sr-only">Primeira</span>
            </span>
            <span className={desativado}>
              <Icone nome="voltar" />
              Anterior
            </span>
          </>
        )}
        {temProxima ? (
          <>
            <Link href={href(paginaAtual + 1)} className="btn-discreto btn-sm">
              Próxima
              <Icone nome="voltar" className="rotate-180" />
            </Link>
            <Link href={href(totalPaginas)} className="btn-discreto btn-sm !px-2" title="Última página">
              <span className="sr-only">Última</span>
              <Icone nome="extremo" className="rotate-180" />
            </Link>
          </>
        ) : (
          <>
            <span className={desativado}>
              Próxima
              <Icone nome="voltar" className="rotate-180" />
            </span>
            <span className={`${desativado} !px-2`}>
              <span className="sr-only">Última</span>
              <Icone nome="extremo" className="rotate-180" />
            </span>
          </>
        )}
      </div>
    </nav>
  );
}
