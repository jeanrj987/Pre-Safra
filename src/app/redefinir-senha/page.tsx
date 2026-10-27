import MoldeAcesso from "@/app/MoldeAcesso";
import FormularioRedefinicao from "./FormularioRedefinicao";

export const metadata = { title: "Nova senha" };

// Página pública: a pessoa chega por um link gerado pelo administrador. O token vem no fragmento da URL
// (#token=...), que o navegador não envia ao servidor; quem lê é o componente de cliente.
export default function RedefinirSenha() {
  return (
    <MoldeAcesso>
      <FormularioRedefinicao />
    </MoldeAcesso>
  );
}
