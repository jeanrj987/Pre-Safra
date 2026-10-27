# Pré-Safra Tracker

App web interno da ControlSoft que acompanha, por safra, a revisão e a configuração do sistema de cada cliente (substitui a planilha "Pré-Safra 2026"). Next.js 16 (App Router) + Prisma 7 + PostgreSQL (Neon).

## O que tem

- **Clientes** (`/`): lista com filtros (incluindo motivo de pendência), agendamento por cliente (responsável, data, horário, Online/Presencial), finalizar e reabrir em lote. Cliente A Fazer ou Atrasado recebe um **motivo de pendência**.
- **Registro do cliente** (`/registro/[id]`): observações, histórico de finalizações, data de finalização editável e **avisos ao cliente** por WhatsApp (link `wa.me` ou API) e e-mail.
- **Painel** (`/painel`): metas, ritmo e gargalos da safra (somente leitura).
- **Calendário** (`/calendario`): atividades da equipe e agendamentos dos clientes.
- **Novo cliente** (`/novo`): cadastro avulso e importação de planilha (admin).
- **Admin** (`/admin`): clientes, safras, usuários e sugestões, com **Backup em Excel** de todas as tabelas e exportação dos clientes.
- **Telão de ideias** (`/telao`, `/sugestao`): QR code para o público sugerir temas de FAQ ou melhorias para o sistema (com anexos e ditado por voz), com meta de FAQ, ranking e comemoração; fica desligado até o admin ativar.

Cada usuário tem um papel (comum, **personalizado**, admin ou somente Painel). No papel Personalizado o admin libera permissões uma a uma (clientes, safras, sugestões, backup, telão, alterar clientes de qualquer responsável, trocar responsável, cadastrar, editar atividades de outros). Quem não é admin tem uma ligação com um responsável e só altera os clientes dele.

## Rodando localmente

```bash
npm install                  # também gera o client do Prisma
cp .env.example .env         # preencha DATABASE_URL e AUTH_SECRET
npm run db:push              # cria/atualiza as tabelas (não há migrations)
npm run criar-usuario -- "Seu Nome" voce@dominio.com SENHA_COM_10_OU_MAIS --admin
npm run dev                  # http://localhost:3000
```

Depois, em **Admin → Safras**, crie a safra e importe os clientes em `/novo`.

Os avisos ao cliente são opcionais: sem configuração, só o link `wa.me` do registro funciona. Para enviar pela API, preencha no `.env` as variáveis de `NOTIFICACAO_*` (webhook de WhatsApp), `RESEND_API_KEY` e `EMAIL_REMETENTE` (e-mail); veja `.env.example`.

## Comandos

| Comando | Faz |
|---|---|
| `npm run dev` / `build` / `start` | servidor Next |
| `npm test` | Vitest (o teste de `acoesPreSafra` usa o banco real de `DATABASE_URL`) |
| `npm run lint` | ESLint |
| `npm run db:push` | aplica o `schema.prisma` no banco |
| `npm run importar`, `importar:gifnoc`, `importar:cidades` | importação de clientes (use `--simular` antes) |
| `npm run padronizar:nomes` | coloca o nome dos clientes em maiúsculas (`--simular` antes) |
| `npm run criar-usuario` | cria ou redefine um usuário |
| `npm run gerar-faq` | gera `src/data/faq.json` a partir do backup da Base de Conhecimento |
| `npx tsx scripts/restaurar-backup.ts <backup.xlsx> [--limpar]` | restaura num banco **local** o backup em Excel (recusa qualquer banco fora de `localhost`) |

Os scripts rodam contra o banco de `DATABASE_URL`: confira o alvo antes. Depois de atualizar o código, rode `npm run db:push` em cada banco (dev e produção) para criar as colunas e tabelas novas.

## Documentação

Fica fora do git (pastas locais): `Vault/` (notas técnicas em Obsidian; comece por `Vault/000_Index.md`) e `docs/` (manuais em PDF, capturas de tela e o script que os gera).

- `pre-safra-app-spec.md` — especificação original (parte já obsoleta).
- `AGENTS.md` — aviso para agentes: esta versão do Next.js tem mudanças; leia `node_modules/next/dist/docs/` antes de codar.
