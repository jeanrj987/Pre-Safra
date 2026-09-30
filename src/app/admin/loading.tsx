// Mostrado na hora ao trocar de aba do admin, enquanto o servidor busca os dados da aba nova
// (o layout com o título e as abas continua na tela).
export default function CarregandoAdmin() {
  return (
    <section className="card" aria-busy="true" aria-label="Carregando">
      <div className="border-b border-line px-4 py-3.5 sm:px-5">
        <div className="h-5 w-32 animate-pulse rounded bg-subtle" />
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-subtle" />
        ))}
      </div>
    </section>
  );
}
