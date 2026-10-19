"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Icone from "@/app/Icone";
import { juntarDitado } from "@/lib/ditado";

// O ditado usa o reconhecimento de voz do próprio navegador (Web Speech API): o servidor do
// PreSafra não recebe áudio nenhum, só o texto final, como se a pessoa tivesse digitado.
// O TypeScript ainda não traz esses tipos, então declaramos só o que usamos.
type ResultadoVoz = { isFinal: boolean; 0: { transcript: string } };
type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ResultadoVoz> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type ConstrutorReconhecimento = new () => Reconhecimento;

function construtor(): ConstrutorReconhecimento | undefined {
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const semAssinatura = () => () => {};

// "carregando" no servidor e na hidratação: evita piscar o aviso de "sem suporte" antes da hora.
function useSuporte(): "carregando" | "sim" | "nao" {
  return useSyncExternalStore(
    semAssinatura,
    () => (construtor() ? "sim" : "nao"),
    () => "carregando",
  );
}

const MENSAGENS_ERRO: Record<string, string> = {
  "not-allowed": "O microfone está bloqueado. Libere o microfone nas permissões do navegador e tente de novo.",
  "service-not-allowed": "O microfone está bloqueado. Libere o microfone nas permissões do navegador e tente de novo.",
  "audio-capture": "Não encontramos um microfone neste aparelho.",
  network: "O ditado precisa de internet. Confira a conexão e tente de novo.",
};
const MENSAGEM_PADRAO = "O ditado parou. Tente de novo ou use o microfone do teclado.";
const MENSAGEM_SILENCIO = "Não ouvimos nada, então o ditado parou. Toque em Falar para tentar de novo.";

// Depois de tantas sessões seguidas sem ouvir nada o ditado para sozinho, em vez de ficar com o microfone aberto.
const SESSOES_MUDAS_MAX = 2;

export default function Ditado({
  texto,
  aoMudar,
  max,
  desabilitado,
}: {
  texto: string;
  aoMudar: (texto: string) => void;
  max: number;
  desabilitado?: boolean;
}) {
  const suporte = useSuporte();
  const [ouvindo, setOuvindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const reconhecimento = useRef<Reconhecimento | null>(null);
  const querOuvir = useRef(false);
  const sessoesMudas = useRef(0);
  // Textos que o próprio ditado colocou no campo; qualquer outro valor é a pessoa digitando.
  const escritos = useRef(new Set<string>());
  const ultimoEscrito = useRef("");
  const aoMudarRef = useRef(aoMudar);

  useEffect(() => {
    aoMudarRef.current = aoMudar;
  });

  function parar() {
    querOuvir.current = false;
    reconhecimento.current?.stop();
  }

  // O navegador encerra cada sessão sozinho depois de uma pausa na fala. Em vez do modo contínuo
  // (que no Android repete frases), cada sessão cuida de uma frase e a próxima começa quando ela termina.
  function iniciarSessao(base: string) {
    const Construtor = construtor();
    if (!Construtor) return;
    const r = new Construtor();
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = true;
    let ouviuAlgo = false;

    r.onresult = (e) => {
      let falado = "";
      for (let i = 0; i < e.results.length; i++) falado += e.results[i][0].transcript;
      if (!falado.trim()) return;
      ouviuAlgo = true;
      const novo = juntarDitado(base, falado).slice(0, max);
      escritos.current.add(novo);
      ultimoEscrito.current = novo;
      aoMudarRef.current(novo);
    };

    r.onerror = (e) => {
      // "no-speech" é só silêncio e "aborted" é a nossa própria parada: o onend decide o que fazer
      if (e.error === "no-speech" || e.error === "aborted") return;
      querOuvir.current = false;
      setAviso(MENSAGENS_ERRO[e.error] ?? MENSAGEM_PADRAO);
    };

    r.onend = () => {
      sessoesMudas.current = ouviuAlgo ? 0 : sessoesMudas.current + 1;
      if (querOuvir.current && sessoesMudas.current < SESSOES_MUDAS_MAX) {
        try {
          iniciarSessao(ultimoEscrito.current);
          return;
        } catch {
          setAviso(MENSAGEM_PADRAO);
        }
      } else if (querOuvir.current) {
        setAviso(MENSAGEM_SILENCIO);
      }
      querOuvir.current = false;
      setOuvindo(false);
    };

    reconhecimento.current = r;
    r.start();
  }

  function iniciar() {
    setAviso(null);
    querOuvir.current = true;
    sessoesMudas.current = 0;
    ultimoEscrito.current = texto;
    escritos.current = new Set([texto]);
    setOuvindo(true);
    try {
      iniciarSessao(texto);
    } catch {
      querOuvir.current = false;
      setOuvindo(false);
      setAviso(MENSAGEM_PADRAO);
    }
  }

  // Se a pessoa mexer no texto à mão (ou o formulário limpar o campo depois de enviar), o ditado
  // para: continuar escrevendo por cima apagaria a edição dela.
  useEffect(() => {
    if (querOuvir.current && !escritos.current.has(texto)) parar();
  }, [texto]);

  useEffect(() => {
    if (desabilitado) parar();
  }, [desabilitado]);

  useEffect(
    () => () => {
      querOuvir.current = false;
      reconhecimento.current?.abort();
    },
    [],
  );

  if (suporte === "carregando") return null;

  if (suporte === "nao") {
    return (
      <p className="ajuda mt-2.5">
        Seu navegador não tem ditado por voz. No celular, toque no microfone do teclado para falar.
      </p>
    );
  }

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={ouvindo ? parar : iniciar}
          disabled={desabilitado}
          aria-pressed={ouvindo}
          className={ouvindo ? "btn-contorno !border-atrasado-fg !text-atrasado-fg" : "btn-contorno"}
        >
          {ouvindo ? (
            <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-atrasado-dot motion-reduce:animate-none" />
          ) : (
            <Icone nome="microfone" className="size-[18px]" />
          )}
          {ouvindo ? "Parar" : "Falar em vez de digitar"}
        </button>
        <span role="status" className="text-xs text-muted">
          {ouvindo
            ? "Ouvindo… pode falar. Toque em Parar quando terminar."
            : "O áudio é transcrito pelo navegador e não fica guardado por nós."}
        </span>
      </div>
      <p role="alert" className="mt-2 text-sm font-medium text-atrasado-fg empty:hidden">
        {aviso}
      </p>
    </div>
  );
}
