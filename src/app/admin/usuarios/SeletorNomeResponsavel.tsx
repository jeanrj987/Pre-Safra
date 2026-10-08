// Campo "Aparece como responsável" do cadastro de usuário (novo e edição): liga a conta a um
// nome da lista de responsáveis dos clientes.
export default function SeletorNomeResponsavel({
  nomes,
  atual = "",
}: {
  /** Nomes da lista de responsáveis dos clientes. */
  nomes: string[];
  /** Ligação já salva; continua escolhível mesmo se o nome saiu da lista. */
  atual?: string;
}) {
  return (
    <label className="block">
      <span className="rotulo">Aparece como responsável</span>
      <select name="nomeResponsavel" defaultValue={atual} className="campo">
        <option value="">Nenhum (só visualiza os clientes)</option>
        {[...new Set([...nomes, ...(atual ? [atual] : [])])].map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-muted">
        O usuário comum só altera os clientes em que este nome é o responsável; os demais ele apenas vê.
        Administradores alteram todos e não precisam de ligação.
      </span>
    </label>
  );
}
