export type Papel = "comum" | "admin" | "painel";

// Escolha do papel do usuário, compartilhada entre "Novo usuário" e "Editar usuário".
export default function SeletorPapel({ padrao = "comum" }: { padrao?: Papel }) {
  return (
    <fieldset className="space-y-2">
      <legend className="rotulo">Papel</legend>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
        <input
          type="radio"
          name="papel"
          value="comum"
          defaultChecked={padrao === "comum"}
          className="size-4 accent-primary"
        />
        <span className="text-sm font-medium">Comum</span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
        <input
          type="radio"
          name="papel"
          value="admin"
          defaultChecked={padrao === "admin"}
          className="size-4 accent-primary"
        />
        <span className="text-sm font-medium">Administrador</span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40">
        <input
          type="radio"
          name="papel"
          value="painel"
          defaultChecked={padrao === "painel"}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="block text-sm font-medium">Somente Painel</span>
          <span className="block text-xs text-muted">
            Só acessa o Painel — ideal para deixar logado numa TV.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
