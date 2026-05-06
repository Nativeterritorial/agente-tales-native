# Agente Tales — NATIVE WhatsApp

Atendente virtual da NATIVE Topografia & Meio Ambiente. Recebe mensagens via webhook Z-API, processa com Claude Haiku 4.5 + base de conhecimento INCRA/SIGEF cacheada, responde no WhatsApp e transfere leads quentes pro Felipe.

## Arquitetura

```
WhatsApp (lead)
   ↓
Z-API (instância 3F2B...) → webhook POST
   ↓
server.js (Express, porta 3000)
   ↓
Claude Haiku 4.5
  ├─ system: base INCRA cacheada + prompt do Tales
  └─ tools: consultar_preco_geo / transferir_humano / salvar_lead
   ↓
Z-API send-text → WhatsApp (lead) e Felipe (5554992215356)
```

## Setup rápido (Windows)

1. **Instalar Node** (se ainda não tiver): nodejs.org LTS
2. **Configurar .env**:
   ```
   copy .env.example .env
   ```
   Edite e cole sua `ANTHROPIC_API_KEY`. As credenciais Z-API já vêm preenchidas.
3. **Rodar**: clique duas vezes em `Iniciar Tales.bat` (instala deps na primeira vez e sobe o servidor).
4. **Expor pra internet** (necessário pro Z-API alcançar): use `ngrok http 3000` ou Cloudflare Tunnel. Pegue a URL pública.
5. **Configurar webhook no painel Z-API** (https://app.z-api.io):
   - Vá em Webhooks → "Ao receber" → cole `https://SUA_URL_PUBLICA/webhook`
   - Marque "Notificar mensagens enviadas pelo próprio número" = NÃO
6. **Mandar uma mensagem de teste** pro número que está no Z-API. O Tales responde.

## Arquivos

| Arquivo | O quê |
|---|---|
| `server.js` | Express + loop de tool_use (executa as 3 tools, devolve tool_result, cicla até resposta final) |
| `system-prompt.js` | Prompt do Tales (edite aqui pra ajustar tom/regras) |
| `conhecimento.js` | Carrega `.md` de `native-agente/conhecimento/regras/` como system cacheado |
| `tools.js` | Implementações: tabela de preços, transferência via Z-API, persistência |
| `precos-georreferenciamento.csv` | Tabela de preços (referência humana — lógica está em `tools.js`) |
| `prompt-agente.md` | Documentação do prompt em formato leitura |
| `workflow-agente-native.json` | Alternativa em n8n (incompleta — só base) |
| `.env.example` | Variáveis de configuração |
| `Iniciar Tales.bat` | Atalho Windows |

## Persistência (arquivos gerados em runtime)

- `conversas.json` — histórico por telefone (passado ao Claude a cada turno)
- `leads.jsonl` — todos os leads salvos/transferidos
- `pausas.json` — telefones pausados (após transferência o agente fica 6h em silêncio pra não atropelar o humano)

Ficam fora do git (`.gitignore`).

## Tools disponíveis

1. **`consultar_preco_georreferenciamento(area_hectares)`** — retorna faixa de preço conforme tabela.
2. **`transferir_humano({nome, telefone, servico, resumo})`** — manda WhatsApp pro Felipe (`5554992215356`) com o resumo, registra em `leads.jsonl`, pausa o agente nessa conversa por 6h.
3. **`salvar_lead({...})`** — append em `leads.jsonl` com dados qualificados.

Pra trocar persistência por Google Sheets: substitua `fs.appendFileSync` em `tools.js` por chamada à API do Sheets.

## Deploy / produção

- **Local + ngrok**: ok pra teste e baixo volume.
- **VPS** (DigitalOcean, Hetzner, etc): roda `pm2 start server.js --name tales` e usa Nginx pra TLS.
- **Cloudflare Tunnel**: alternativa ao ngrok, gratuito e estável.

## Eliminar Typebot

Os links do site já apontam pra `wa.me/5554997104400` (commit anterior). Quando o Tales estiver no ar, pode desligar o Typebot.

## Custo aproximado

- Claude Haiku 4.5 com base cacheada: ~R$ 0,01 a R$ 0,05 por conversa típica (10 turnos).
- Cache hit derruba custo quando o lead manda várias mensagens em sequência (TTL 5min).

## Pra editar o comportamento

- Tom/regras → `system-prompt.js`
- Preços → `tools.js` (constante `FAIXAS_GEO`) e `precos-georreferenciamento.csv`
- Telefone do humano → `.env` (`TELEFONE_HUMANO`)
- Tempo de pausa após transferência → `tools.js` (procurar `6 * 60 * 60 * 1000`)
