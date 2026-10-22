"use client";
import { useRef, useState, useTransition, type FormEvent } from "react";
import Icone from "@/app/Icone";
import { LIMITES, TIPOS_SUGESTAO, type TipoSugestao } from "@/lib/sugestoes";
import { mascararWhatsapp } from "@/lib/whatsapp";
import { enviarSugestao, type Resultado } from "./acoes";
import CampoAnexos from "./CampoAnexos";
import Ditado from "./Ditado";

// text-base (16px) nos campos: abaixo disso o Safari do iPhone dá zoom ao focar.
const CAMPO = "campo text-base";
// Os botões do aviso têm texto longo: deixa quebrar linha e crescer em vez de vazar do botão.
const QUEBRA = "h-auto min-h-10 whitespace-normal py-2 text-center";

// O que muda no formulário conforme o tipo da sugestão
const TEXTOS: Record<
  TipoSugestao,
  { opcao: string; campo: string; placeholder: string; assunto: string; salva: string; contato: string }
> = {
  faq: {
    opcao: "Dúvida ou tema para o FAQ",
    campo: "Sua sugestão para o FAQ",
    placeholder: "Que dúvida ou tema deveria ter no FAQ?",
    assunto: "Ex.: Nota fiscal, Estoque, Financeiro",
    salva: "Ótimo, isso ainda não tem no FAQ! Sugestão salva.",
    contato: "Nossa equipe pode chamar você no WhatsApp para entender melhor.",
  },
  melhoria: {
    opcao: "Melhoria para o sistema (P&D)",
    campo: "Sua sugestão de melhoria",
    placeholder: "O que atrapalha hoje ou o que você gostaria que o sistema fizesse?",
    assunto: "Ex.: Relatórios, Cadastro de clientes, Agendamento",
    salva: "Sugestão de melhoria salva! Ela vai para o time de P&D.",
    contato: "Nosso time de produto pode chamar você no WhatsApp para entender melhor.",
  },
};

export default function FormSugestao() {
  const [tipo, setTipo] = useState<TipoSugestao>("faq");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [topico, setTopico] = useState("");
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [site, setSite] = useState(""); // isca para robôs, ver acoes.ts
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, iniciar] = useTransition();
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  function enviar(confirmar: boolean) {
    iniciar(async () => {
      const r = await enviarSugestao({ tipo, nome, whatsapp, topico, texto, anexos, site, confirmar });
      setResultado(r);
      if (r.status === "salva") {
        // Mantém nome e WhatsApp: quem tem mais de uma ideia não precisa digitar tudo de novo
        setTopico("");
        setTexto("");
        setAnexos([]);
      }
    });
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    enviar(false);
  }

  // Avisos de "já existe algo parecido" (no FAQ ou entre as sugestões): a pessoa decide o que fazer
  const comAviso = resultado?.status === "faq" || resultado?.status === "sugestao";

  function mudarTexto(valor: string) {
    setTexto(valor);
    // Depois de editar a ideia o aviso deixa de valer
    if (comAviso) setResultado(null);
  }

  function mudarTipo(valor: TipoSugestao) {
    setTipo(valor);
    // Os avisos ("já existe no FAQ", "salva") falam do tipo anterior
    if (comAviso || resultado?.status === "salva") setResultado(null);
  }

  function mudarIdeia() {
    setResultado(null);
    campoTexto.current?.focus();
  }

  return (
    <form onSubmit={aoEnviar} className="card space-y-4 p-5">
      <label className="block">
        <span className="rotulo">Tipo de sugestão</span>
        <select
          value={tipo}
          onChange={(e) => mudarTipo(e.target.value as TipoSugestao)}
          required
          className={CAMPO}
        >
          {TIPOS_SUGESTAO.map((t) => (
            <option key={t} value={t}>
              {TEXTOS[t].opcao}
            </option>
          ))}
        </select>
      </label>

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
          placeholder={TEXTOS[tipo].assunto}
          className={CAMPO}
        />
      </label>

      {/* O botão de anexo fica fora do <label>: dentro dele, tocar no rótulo abriria o seletor */}
      <div>
        <label className="block">
          <span className="rotulo">{TEXTOS[tipo].campo}</span>
          <textarea
            ref={campoTexto}
            value={texto}
            onChange={(e) => mudarTexto(e.target.value)}
            required
            maxLength={LIMITES.texto.max}
            rows={4}
            placeholder={TEXTOS[tipo].placeholder}
            className={CAMPO}
          />
        </label>
        <Ditado texto={texto} aoMudar={mudarTexto} max={LIMITES.texto.max} desabilitado={enviando} />
        <CampoAnexos arquivos={anexos} aoMudar={setAnexos} desabilitado={enviando} />
      </div>

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
                  : TEXTOS[tipo].salva}
              </p>
              <p className="mt-0.5 text-sm">
                {TEXTOS[tipo].contato} Tem outra ideia? É só escrever acima.
              </p>
            </div>
          </div>
        )}

        {(resultado?.status === "faq" || resultado?.status === "sugestao") && (
          <div className="rounded-lg bg-afazer-bg px-4 py-3 text-afazer-fg">
            <div className="flex items-start gap-3">
              <Icone nome="info" className="mt-0.5 size-5" />
              <div>
                {resultado.status === "faq" ? (
                  <>
                    <p className="text-sm font-semibold">
                      Isso já tem no FAQ. Que tal dar outra sugestão?
                    </p>
                    <p className="mt-1 text-sm">
                      Pergunta parecida que já existe: <strong>“{resultado.pergunta}”</strong>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">
                      Alguém já sugeriu algo parecido. Que tal dar outra sugestão?
                    </p>
                    <p className="mt-1 break-words text-sm">
                      Sugestão parecida: <strong>{resultado.assunto}</strong> — “{resultado.texto}”
                    </p>
                  </>
                )}
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

      {!comAviso && (
        <button type="submit" disabled={enviando} aria-busy={enviando} className="btn-primario w-full">
          {enviando ? "Verificando…" : "Enviar sugestão"}
        </button>
      )}
    </form>
  );
}
