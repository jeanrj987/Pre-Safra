"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import Icone from "@/app/Icone";
import { Janela, RodapeJanela } from "@/app/Finalizar";

export default function NovaSafra({ acao }: { acao: (formData: FormData) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-primario">
        <Icone nome="mais" />
        Nova safra
      </button>
      {aberto && (
        <Janela icone="calendario" titulo="Nova safra" onFechar={() => setAberto(false)}>
          <form action={acao}>
            <div className="space-y-4 px-6 py-5">
              <p className="rounded-lg bg-subtle/60 px-3 py-2 text-xs text-muted">
                Todos os clientes cadastrados que não estiverem inativos são copiados
                automaticamente para a safra nova.
              </p>
              <label className="block">
                <span className="rotulo">Nome</span>
                <input name="nome" required autoFocus placeholder="Ex.: Soja 2026" className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">
                  Cultura <span className="font-normal text-muted">(opcional)</span>
                </span>
                <select name="cultura" defaultValue="" className="campo">
                  <option value="">Sem cultura</option>
                  <option value="Soja">Soja</option>
                  <option value="Milho">Milho</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="rotulo">Início</span>
                  <input type="date" name="inicio" required className="campo" />
                </label>
                <label className="block">
                  <span className="rotulo">Prazo</span>
                  <input type="date" name="prazo" required className="campo" />
                </label>
              </div>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Criando…" className="btn-primario">
                Criar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
