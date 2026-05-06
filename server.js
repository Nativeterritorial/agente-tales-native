// Servidor webhook que recebe mensagens do Z-API e responde via Claude (Tales)
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

import { carregarConhecimento, tamanhoEstimado } from "./conhecimento.js";
import { TOOL_DEFS, executarTool, leadEstaPausado, zapiSendText } from "./tools.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const app = express();
app.use(express.json({ limit: "10mb" }));

const HISTORICO_FILE = path.join(__dirname, "conversas.json");
const historico = fs.existsSync(HISTORICO_FILE)
  ? JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"))
  : {};

function salvarHistorico() {
  fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));
}

const t = tamanhoEstimado();
console.log(`📚 Base INCRA carregada: ~${t.tokensEstimados} tokens`);

function systemBlocks() {
  return [
    { type: "text", text: carregarConhecimento(), cache_control: { type: "ephemeral" } },
    { type: "text", text: SYSTEM_PROMPT },
  ];
}

async function rodarAgente(telefone, nomeLead, mensagemUsuario) {
  if (!historico[telefone]) historico[telefone] = [];
  const conv = historico[telefone];
  conv.push({ role: "user", content: mensagemUsuario });

  let respostaFinal = "";
  let iter = 0;

  while (iter++ < 6) {
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemBlocks(),
      tools: TOOL_DEFS,
      messages: conv,
    });

    const cacheHit = r.usage.cache_read_input_tokens > 0;
    console.log(`[${telefone}] iter=${iter} stop=${r.stop_reason} ${cacheHit ? "cache✓" : "cache✗"} in=${r.usage.input_tokens} out=${r.usage.output_tokens}`);

    conv.push({ role: "assistant", content: r.content });

    if (r.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of r.content) {
        if (block.type === "tool_use") {
          console.log(`  → tool: ${block.name}(${JSON.stringify(block.input)})`);
          const result = await executarTool(block.name, { ...block.input, telefone_lead: block.input.telefone_lead || telefone, nome_lead: block.input.nome_lead || nomeLead });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
      }
      conv.push({ role: "user", content: toolResults });
      continue;
    }

    respostaFinal = r.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    break;
  }

  salvarHistorico();
  return respostaFinal;
}

app.post("/webhook", async (req, res) => {
  res.status(200).send("ok");
  try {
    const body = req.body || {};
    if (body.fromMe) return;
    if (body.isGroup) return;

    const telefone = body.phone;
    const nomeLead = body.senderName || body.chatName || "";
    const mensagem = body.text?.message || body.message || body.body || "";
    if (!telefone || !mensagem) return;

    if (leadEstaPausado(telefone)) {
      console.log(`[${telefone}] pausado (transferido) — ignorando`);
      return;
    }

    console.log(`[${telefone}] ${nomeLead}: ${mensagem}`);
    const resposta = await rodarAgente(telefone, nomeLead, mensagem);
    if (resposta) {
      await zapiSendText(telefone, resposta);
      console.log(`[${telefone}] Tales: ${resposta}`);
    }
  } catch (e) {
    console.error("Erro no webhook:", e);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, conversas: Object.keys(historico).length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Tales rodando em http://localhost:${PORT}`);
  console.log(`   Webhook Z-API → POST http://SEU_HOST:${PORT}/webhook`);
});
