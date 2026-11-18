import { useId } from "react";

// Campo "Aparece como responsável" do cadastro de usuário (novo e edição): liga a conta a um
// nome da lista de responsáveis dos clientes.
export default function SeletorNomeResponsavel({
  nomes,
  atual = "",
  obrigatorio = false,
}: {
  /** Nomes da lista de responsáveis dos clientes. */
  nomes: string[];
  /** Ligação já salva; continua escolhível mesmo se o nome saiu da lista. */
  atual?: string;
  /** Admin da região: sem nome ligado ela não seria responsável por nenhum cliente. */
  obrigatorio?: boolean;
}) {
  const idAjuda = useId();
  return (
    <label className="block">
      <span className="rotulo">Aparece como responsável</span>
      <select
        name="nomeResponsavel"
        defaultValue={atual}
        required={obrigatorio}
        aria-describedby={idAjuda}
        className="campo"
      >
        <option value="">{obrigatorio ? "Escolha um nome" : "Nenhum (só visualiza os clientes)"}</option>
        {[...new Set([...nomes, ...(atual ? [atual] : [])])].map((n) => (
          <option key={n}>{n}</option>
        ))}
      </select>
      <span id={idAjuda} className="mt-1 block text-xs text-muted">
        {obrigatorio
          ? "Obrigatório para o Admin da região: é este nome que aparece como responsável padrão dos clientes das regiões escolhidas."
          : "O usuário comum só altera os clientes em que este nome é o responsável; os demais ele apenas vê. Administradores alteram todos e não precisam de ligação."}
      </span>
    </label>
  );
}
