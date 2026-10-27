"use client";
import Icone from "../Icone";

// Abre a janela de impressão do navegador, onde "Salvar como PDF" gera o arquivo. O nome sugerido
// para o PDF é o título da aba, então ele troca de título só durante a impressão.
export default function BotaoImprimir({ nomeArquivo }: { nomeArquivo: string }) {
  function imprimir() {
    const tituloAntes = document.title;
    document.title = nomeArquivo;
    window.addEventListener("afterprint", () => (document.title = tituloAntes), { once: true });
    window.print();
  }

  return (
    <button type="button" onClick={imprimir} className="btn-primario btn-sm">
      <Icone nome="arquivo" />
      Salvar em PDF
    </button>
  );
}
