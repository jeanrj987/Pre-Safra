"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import Icone from "@/app/Icone";
import { LIMITES } from "@/lib/sugestoes";
import { mascararWhatsapp } from "@/lib/whatsapp";
import { enviarSugestao, type Resultado } from "./acoes";

// text-base (16px) nos campos: abaixo disso o Safari do iPhone dá zoom ao focar.
const CAMPO = "campo text-base";
// Os botões do aviso têm texto longo: deixa quebrar linha e crescer em vez de vazar do botão.
const QUEBRA = "h-auto min-h-10 whitespace-normal py-2 text-center";

export default function FormSugestao() {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [topico, setTopico] = useState("");
  const [texto, setTexto] = useState("");
  const [site, setSite] = useState(""); // isca para robôs, ver acoes.ts
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, iniciar] = useTransition();
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  function enviar(confirmar: boolean) {
    iniciar(async () => {
      const r = await enviarSugestao({ nome, whatsapp, topico, texto, site, confirmar });
      setResultado(r);
      if (r.status === "salva") {
        // Mantém nome e WhatsApp: quem tem mais de uma ideia não precisa digitar tudo de novo
        setTopico("");
        setTexto("");
      }
    });
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    enviar(false);
  }

  function mudarTexto(valor: string) {
    setTexto(valor);
    // Depois de editar a ideia o aviso do FAQ deixa de valer
    if (resultado?.status === "faq") setResultado(null);
  }

  function mudarIdeia() {
    setResultado(null);
    campoTexto.current?.focus();
  }

  return (
    <form onSubmit={aoEnviar} className="card space-y-4 p-5">
      <label className="block">
        <span className="rotulo">Seu nome</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          minLength={LIMITES.nome.min}
          maxLength={LIMITES.nome.max}
          autoComplete="name"
          className={CAMPO}
        />
      </label>

      <label className="block">
        <span className="rotulo">WhatsApp</span>
        <input
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(mascararWhatsapp(e.target.value))}
          required
          maxLength={20}
          autoComplete="tel-national"
          placeholder="(66) 99999-8888"
          aria-describedby="ajuda-whatsapp"
          className={CAMPO}
        />
        <span id="ajuda-whatsapp" className="ajuda">
          Só usamos para falar com você sobre a sua sugestão.
        </span>
      </label>

      <label className="block">
        <span className="rotulo">Assunto</span>
        <input
          value={topico}
          onChange={(e) => setTopico(e.target.value)}
          required
          minLength={LIMITES.topico.min}
          maxLength={LIMITES.topico.max}
          placeholder="Ex.: Nota fiscal, Estoque, Financeiro"
          className={CAMPO}
        />
      </label>

      <label className="block">
        <span className="rotulo">Sua sugestão para o FAQ</span>
        <textarea
          ref={campoTexto}
          value={texto}
          onChange={(e) => mudarTexto(e.target.value)}
          required
          maxLength={LIMITES.texto.max}
          rows={4}
          placeholder="Que dúvida ou tema deveria ter no FAQ?"
          className={CAMPO}
        />
      </label>

      {/* Isca para robôs: pessoas não veem nem alcançam com o teclado */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input
            tabIndex={-1}
            autoComplete="off"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
        </label>
      </div>

      <div aria-live="polite">
        {resultado?.status === "salva" && (
          <div className="flex items-start gap-3 rounded-lg bg-finalizado-bg px-4 py-3 text-finalizado-fg">
            <Icone nome="check" className="mt-0.5 size-5" />
            <div>
              <p className="text-sm font-semibold">
                {resultado.revisar
                  ? "Sugestão salva! Vamos conferir o que ela tem de diferente do FAQ atual."
                  : "Ótimo, isso ainda não tem no FAQ! Sugestão salva."}
              </p>
              <p className="mt-0.5 text-sm">
                Nossa equipe pode chamar você no WhatsApp para entender melhor. Tem outra ideia?
                É só escrever acima.
              </p>
            </div>
          </div>
        )}

        {resultado?.status === "faq" && (
          <div className="rounded-lg bg-afazer-bg px-4 py-3 text-afazer-fg">
            <div className="flex items-start gap-3">
              <Icone nome="info" className="mt-0.5 size-5" />
              <div>
                <p className="text-sm font-semibold">
                  Isso já tem no FAQ. Que tal dar outra sugestão?
                </p>
                <p className="mt-1 text-sm">
                  Pergunta parecida que já existe: <strong>“{resultado.pergunta}”</strong>
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={mudarIdeia} className={`btn-primario ${QUEBRA}`}>
                Vou escrever outra sugestão
              </button>
              <button
                type="button"
                onClick={() => enviar(true)}
                disabled={enviando}
                className={`btn-contorno ${QUEBRA}`}
              >
                {enviando ? "Enviando…" : "Não é a mesma coisa, enviar assim mesmo"}
              </button>
            </div>
          </div>
        )}

        {resultado?.status === "erro" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-atrasado-bg px-3 py-2.5 text-sm font-medium text-atrasado-fg"
          >
            <Icone nome="alerta" className="mt-0.5" />
            {resultado.mensagem}
          </p>
        )}
      </div>

      {resultado?.status !== "faq" && (
        <button type="submit" disabled={enviando} aria-busy={enviando} className="btn-primario w-full">
          {enviando ? "Verificando…" : "Enviar sugestão"}
        </button>
      )}
    </form>
  );
}
