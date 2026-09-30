# Pré-Safra Tracker — Especificação do Projeto

> Documento de referência para desenvolvimento com Claude (Claude Code / IDE).
> Objetivo: substituir a planilha atual de controle de "Pré-Safra 2026" por uma aplicação web, mantendo a mesma lógica de negócio, mas resolvendo as fragilidades da planilha (fórmulas quebradiças, falta de recálculo automático, dificuldade de colaboração).

---

## 1. Contexto

A ControlSoft (empresa de ERP para o setor agrícola — armazéns gerais, produtores rurais, cerealistas, revendas) realiza todo ano um processo chamado **"Pré-Safra"**: antes do início da safra, cada cliente ativo passa por uma revisão/configuração do sistema, feita por um responsável do time de atendimento/consultoria.

Hoje esse processo é controlado em uma planilha Excel (`Pré-Safra 2026.xlsx`) com 3 abas:

1. **Clientes** — base mestra de clientes (vinda do CRM/atendimento).
2. **Pré-Safra 2026** — checklist de acompanhamento, uma linha por cliente ativo.
3. **Status Pré Safra** — painel-resumo com contagem de status.

### 1.1 Problemas da solução atual

- Fórmulas `XLOOKUP`/`IFERROR` dependem de nomes de cliente baterem **exatamente** entre abas — qualquer diferença de digitação quebra o vínculo silenciosamente (retorna vazio).
- Colunas calculadas (Status, Dias em Atraso, Mês Previsto) só mostram valores corretos se a planilha for aberta e recalculada no Excel/Sheets — ferramentas que leem o arquivo "a frio" (scripts, exportações) veem essas colunas vazias.
- Uma referência (`Analista atendimento`) usa **célula fixa** (`Clientes!H4`) em vez de busca por chave — quebra se a base de Clientes for reordenada.
- Múltiplas pessoas editando a mesma planilha ao mesmo tempo gera risco de conflito/sobrescrita.
- Não há histórico de mudanças, nem notificação automática de atraso.

---

## 2. Objetivo do novo sistema

Criar uma aplicação web simples que:

1. Centralize o acompanhamento do Pré-Safra por cliente, com status sempre correto e recalculado automaticamente (sem depender de "abrir a planilha").
2. Permita que uma equipe pequena (poucos colegas) edite os registros com segurança, sem sobrescrever o trabalho um do outro.
3. Ofereça um painel/dashboard visual (equivalente à aba "Status Pré Safra", mas melhor).
4. Sirva de base para, no futuro, disparar notificações automáticas (e-mail/WhatsApp) de atrasos — **não obrigatório na v1**, mas a arquitetura deve permitir adicionar isso depois sem retrabalho.

### 2.1 Fora de escopo (por ora)

- Substituir o CRM/sistema de atendimento (a base de Clientes pode continuar vindo de lá, via importação).
- Notificações automáticas (fica para uma fase 2).
- Múltiplas safras/anos ao mesmo tempo na interface (v1 foca em "Pré-Safra 2026", mas o modelo de dados já deve prever anos futuros).

---

## 3. Usuários

- **Equipe pequena** (poucos colegas do time de atendimento/consultoria da ControlSoft).
- Todos com o mesmo nível de acesso na v1 (não há necessidade de perfis/permissões complexas agora — pode ser adicionado depois se necessário).

---

## 4. Modelo de dados

### 4.1 Entidade `Cliente`

Baseada na aba "Clientes" da planilha atual.

| Campo | Tipo | Observação |
|---|---|---|
| id | string/número | Identificador único (na planilha é numérico) |
| nome | string | Nome completo do cliente (ex: "Agrícola Grão de Ouro - SELF: Grão de Ouro - Status: Ativo - ControlSoft") |
| caracterizacao | string | Segmento(s) de atuação (ex: "5 - Produtor Rural") |
| uf | string | Estado(s) |
| softwarehouse | string | Ex: "ControlSoft" |
| consultor | string | |
| atendente | string | |
| responsavel | string | |
| status | string | Ativo / Inativo - Sem Acesso / etc. |
| gerente | string | |
| versao_sistema | string | Versão do ERP instalada |
| segmentos | booleanos | Seg_ArmazemGeral, Seg_ProdutorRural, Seg_Cerealista, Seg_Revenda, Seg_Financeiro |

> **Importante:** ao migrar os dados, considerar `nome` como chave de vínculo com os registros de Pré-Safra (é o que a planilha atual usa via XLOOKUP). Se possível, usar `id` como chave real no novo sistema para evitar os problemas de "nome não bate exatamente".

### 4.2 Entidade `PreSafra` (um registro por cliente por ano/safra)

Baseada na aba "Pré-Safra 2026".

| Campo | Tipo | Origem/Regra |
|---|---|---|
| id | string/número | Gerado pelo sistema |
| cliente_id | referência a Cliente | Opcional: vazio quando o cliente não existe na base |
| cliente_nome_manual | string | Preenchido só quando `cliente_id` é vazio (cliente ainda não cadastrado) |
| ano_safra | número | Ex: 2026 (permite reaproveitar o modelo em anos futuros) |
| estado | string | Puxado do Cliente (ou copiado no momento da criação) |
| gerente | string | Puxado do Cliente (via `cliente_id`, **não** por nome fixo) |
| consultor | string | Puxado do Cliente |
| analista_atendimento | string | Puxado do Cliente (campo "Atendente") — **corrigir o bug da planilha**: buscar por `cliente_id`, não por célula fixa |
| responsavel | string | Preenchido manualmente — pessoa responsável por executar o pré-safra deste cliente |
| data_prevista | data | Preenchido manualmente |
| formato | enum | "Online" / "Presencial" / outros — preenchido manualmente |
| configurado_sistema | booleano | Preenchido manualmente (sim/não) |
| melhorias_apresentadas | booleano | Preenchido manualmente (sim/não) |
| observacoes | texto livre | Preenchido manualmente |
| criado_em / atualizado_em | timestamp | Para histórico/auditoria |

### 4.3 Campos calculados (não armazenar como valor fixo — calcular sempre na leitura)

Replicando a lógica da planilha atual (com a correção de qual campo define "Finalizado" — ver nota abaixo):

```
status_calculado =
  SE formato_preenchido (ou configurado_sistema, ver nota) → "Finalizado"
  SENÃO SE data_prevista existe E data_prevista < hoje → "Atrasado"
  SENÃO → "A Fazer"

dias_em_atraso =
  SE status_calculado == "Atrasado" → hoje - data_prevista
  SENÃO → null

mes_previsto =
  SE data_prevista existe → formatar como "mmm/aaaa"
  SENÃO → null
```

> ⚠️ **Nota de revisão:** na planilha original, a fórmula de `Status Calculado` considera "Finalizado" quando a coluna **"Formato do Pré-Safra"** está preenchida — não quando "Configurado Sistema" está preenchida, o que parece um possível erro de construção da planilha (faria mais sentido "Finalizado" depender de `configurado_sistema`, já que é isso que de fato indica que o trabalho foi concluído). **Confirmar com o time qual é a regra correta antes de implementar**, e considerar exigir múltiplos campos preenchidos para marcar como "Finalizado" (ex: `configurado_sistema = true` E `melhorias_apresentadas` respondido).

---

## 5. Regras de negócio

1. Um cliente só entra na lista de Pré-Safra se estiver com status **"Ativo"** na base de Clientes.
2. O vínculo entre `PreSafra` e `Cliente` deve ser por **ID**, nunca por nome de texto (elimina o problema de "nome não bate exatamente" da planilha atual).
3. Campos puxados do Cliente (Gerente, Consultor, Analista atendimento) são **somente leitura** na tela de Pré-Safra — se precisar mudar, muda-se no cadastro do Cliente.
4. Status, Dias em Atraso e Mês Previsto são sempre **calculados no momento da exibição/consulta**, nunca gravados como valor fixo no banco (evita o problema de "valor desatualizado" da planilha).

---

## 6. Telas / Fluxos (v1)

### 6.1 Dashboard / Lista principal
- Tabela com todos os clientes em Pré-Safra do ano corrente.
- Colunas: Cliente, Estado, Responsável, Data Prevista, Status (com cor: verde=Finalizado, amarelo=A Fazer, vermelho=Atrasado), Dias em Atraso.
- Filtros: por Responsável, por Status, por Estado.
- Busca por nome de cliente.
- Contador resumido no topo (equivalente à aba "Status Pré Safra"): total por status, e opcionalmente por responsável.

### 6.2 Detalhe / Edição de um registro
- Ao clicar em um cliente, abre formulário com os campos editáveis: Responsável, Data Prevista, Formato, Configurado Sistema, Melhorias Apresentadas, Observações.
- Campos somente-leitura visíveis: Gerente, Consultor, Analista Atendimento (puxados do cadastro do cliente).
- Botão salvar com feedback visual.

### 6.3 Importação inicial de dados
- Tela ou script para importar os dados atuais da planilha (.xlsx) para o novo sistema — usado uma vez na migração, mas bom manter reutilizável caso a base de Clientes precise ser resincronizada depois.

### 6.4 (Fase 2 — não obrigatório na v1)
- Configuração de notificação automática por e-mail/WhatsApp quando um registro entra em "Atrasado".
- Histórico de alterações por registro.
- Múltiplos anos de safra na mesma interface (seletor de ano).

---

## 7. Requisitos não funcionais

- **Simplicidade de manutenção**: equipe pequena, sem time de infraestrutura dedicado — preferir stack simples de rodar e hospedar.
- **Baixo custo operacional**: evitar dependências caras; hospedagem simples (ex: um único servidor/serviço gerenciado).
- **Multiusuário simples**: sem necessidade de perfis de permissão complexos na v1, mas o banco de dados deve suportar múltiplos usuários editando concorrentemente sem conflito (diferente da planilha).

---

## 8. Stack sugerida (ponto de partida — ajustar conforme preferência)

- **Frontend + Backend**: aplicação web full-stack simples (ex: Next.js, ou um backend leve tipo FastAPI/Node + frontend React) — a decisão exata pode ser feita durante o desenvolvimento com o Claude Code.
- **Banco de dados**: um banco relacional simples (ex: SQLite para começar, ou Postgres se for crescer) — evitar over-engineering para uma equipe pequena.
- **Autenticação**: simples (login básico da equipe), sem necessidade de SSO corporativo na v1.
- **Importação de dados**: script que lê o `.xlsx` atual (abas Clientes e Pré-Safra 2026) e popula o banco novo.

---

## 9. Plano de implementação sugerido (fases)

1. **Fase 0 — Fundação**: modelar banco de dados (`Cliente`, `PreSafra`), escrever script de importação da planilha atual.
2. **Fase 1 — MVP**: tela de dashboard/lista + tela de edição de registro, com status calculado corretamente.
3. **Fase 2 — Refino**: filtros, busca, contador resumido, melhorias visuais.
4. **Fase 3 — Extras**: notificações automáticas de atraso, histórico de alterações, suporte a múltiplos anos de safra.

---

## 10. Perguntas em aberto (confirmar antes ou durante o desenvolvimento)

- [x] **Regra de "Finalizado":** a regra da planilha (Formato preenchido) **não será usada**. Decisão adotada: `Finalizado` = `configurado_sistema = true`. (Ajustável depois em um único ponto do código.)
- [x] **Base de Clientes:** atualiza raramente → importação manual/reutilizável, sem sincronização automática. Além disso, o registro de Pré-Safra terá um campo `cliente_nome_manual` para digitar o nome de um cliente que ainda não existe na base (nesse caso `cliente_id` fica vazio, e Gerente/Consultor/Analista podem ser preenchidos manualmente).
- [x] **Acesso de edição:** apenas o autor na v1; a gestora receberá acesso depois (login simples, sem perfis).
- [x] **Stack:** a critério do Claude Code → Next.js (TypeScript) + SQLite (via Prisma ou Drizzle), login básico, importação de `.xlsx` com a biblioteca `xlsx`.
