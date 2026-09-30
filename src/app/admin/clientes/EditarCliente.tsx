"use client";
import { useState } from "react";
import BotaoEnviar from "@/app/BotaoEnviar";
import { Janela, RodapeJanela } from "@/app/Finalizar";

interface Cliente {
  id: number;
  nome: string;
  cidade: string | null;
  uf: string | null;
  regiao: string | null;
  atendente: string | null;
  consultor: string | null;
}

interface Listas {
  cidades: string[];
  ufs: string[];
  regioes: string[];
  atendimentos: string[];
  consultores: string[];
}

// Lista conhecida + o valor atual, caso ele seja um dado avulso que não está nela (senão a
// seleção "sumiria" ao abrir o formulário).
const opcoesCom = (valor: string | null, lista: string[]) =>
  valor && !lista.includes(valor) ? [valor, ...lista] : lista;

// Popup para editar o cadastro do cliente (cidade, UF, região, atendimento, consultor) de
// uma vez, em vez de um campo por vez direto na linha da tabela.
export default function EditarCliente({
  cliente,
  listas,
  salvar,
}: {
  cliente: Cliente;
  listas: Listas;
  salvar: (formData: FormData) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="btn-discreto btn-sm">
        Editar
      </button>
      {aberto && (
        <Janela
          icone="usuario"
          titulo="Editar cadastro"
          subtitulo={cliente.nome}
          onFechar={() => setAberto(false)}
        >
          <form
            action={async (formData) => {
              await salvar(formData);
              setAberto(false);
            }}
          >
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <label className="block">
                <span className="rotulo">Cidade</span>
                <select name="cidade" defaultValue={cliente.cidade ?? ""} autoFocus className="campo">
                  <option value="">Sem cidade</option>
                  {opcoesCom(cliente.cidade, listas.cidades).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">UF</span>
                <select name="uf" defaultValue={cliente.uf ?? ""} className="campo">
                  <option value="">Sem UF</option>
                  {opcoesCom(cliente.uf, listas.ufs).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Região</span>
                <select name="regiao" defaultValue={cliente.regiao ?? ""} className="campo">
                  <option value="">Sem região</option>
                  {opcoesCom(cliente.regiao, listas.regioes).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Atendimento</span>
                <select name="atendente" defaultValue={cliente.atendente ?? ""} className="campo">
                  <option value="">Sem atendimento</option>
                  {opcoesCom(cliente.atendente, listas.atendimentos).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="rotulo">Consultor</span>
                <select name="consultor" defaultValue={cliente.consultor ?? ""} className="campo">
                  <option value="">Sem consultor</option>
                  {opcoesCom(cliente.consultor, listas.consultores).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            <RodapeJanela onCancelar={() => setAberto(false)}>
              <BotaoEnviar pendente="Salvando…" className="btn-primario">
                Salvar
              </BotaoEnviar>
            </RodapeJanela>
          </form>
        </Janela>
      )}
    </>
  );
}
