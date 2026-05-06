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
import { extrairMidiaDoWebhook, processarMidia } from "./media.js";
import { ehParceiro, processarMensagemParceiro } from "./parceiros.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const app = express();
app.use(express.json({ limit: "10mb" }));

const HISTORICO_FILE = path.join(__dirname, "conversas.json");
const historico = fs.existsSync(HISTORICO_FILE)
  ? JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"))
  : {};

const ESTADO_FILE = path.join(__dirname, "estado.json");
const estado = fs.existsSync(ESTADO_FILE)
  ? JSON.parse(fs.readFileSync(ESTADO_FILE, "utf8"))
  : {};

const MIDIA_DIR = path.join(__dirname, "midia-pendente");
if (!fs.existsSync(MIDIA_DIR)) fs.mkdirSync(MIDIA_DIR, { recursive: true });

function salvarHistorico() {
  fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historico, null, 2));
}

function salvarEstado() {
  fs.writeFileSync(ESTADO_FILE, JSON.stringify(estado, null, 2));
}

function getEstado(telefone) {
  if (!estado[telefone]) estado[telefone] = {};
  return estado[telefone];
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

function inferirServicoDaConversa(telefone) {
  const conv = historico[telefone] || [];
  const txt = conv.map(m => typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map(c => c.text || c.input?.servico || "").join(" ") : "").join(" ").toLowerCase();
  if (/licenc|ambient|car|multa|veget|corte|transplante/.test(txt)) return "ambiental";
  if (/topograf|loteamento|geocidade|levantamento/.test(txt)) return "topografia";
  if (/geo|georref|incra|sigef|hectar/.test(txt)) return "georreferenciamento";
  return "georreferenciamento";
}

function inferirNomeDaConversa(telefone, fallback) {
  const conv = historico[telefone] || [];
  for (const m of conv) {
    if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === "tool_use" && c.input?.nome) return c.input.nome;
        if (c.type === "tool_use" && c.input?.nome_lead) return c.input.nome_lead;
      }
    }
  }
  return fallback || "";
}

import { baixarMidia } from "./media.js";

async function arquivarMidiaUnica(telefone, nomeLead, midia, proprietario, servico) {
  console.log(`[${telefone}] mídia ${midia.tipo} (${midia.fileName}) — analisando…`);
  try {
    const { analise, dropboxPath, pastaProcesso } = await processarMidia({
      midia,
      lead: { telefone, nome: proprietario },
      servico,
    });

    const respostaCliente = `Recebi seu ${analise.tipo} 📋 ${analise.resumo_curto || ""}`.trim();
    await zapiSendText(telefone, respostaCliente);

    const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
    const validacoesTxt = (analise.validacoes || []).map(v => `${v.ok ? "✅" : "⚠️"} ${v.regra}: ${v.detalhe}`).join("\n");
    const alertasTxt = (analise.alertas || []).join("\n");
    const aviso = `📎 *Documento recebido — Tales*\n\n*Proprietário:* ${proprietario}\n*Lead:* ${nomeLead || "—"} (${telefone})\n*Tipo:* ${analise.tipo}\n*Resumo:* ${analise.resumo_curto || "—"}\n\n*Pasta:* ${pastaProcesso}\n*Arquivo:* ${dropboxPath}${validacoesTxt ? `\n\n*Validações:*\n${validacoesTxt}` : ""}${alertasTxt ? `\n\n⚠️ *Alertas:*\n${alertasTxt}` : ""}`;
    await zapiSendText(telefoneFelipe, aviso);

    console.log(`[${telefone}] arquivado em ${dropboxPath}`);
  } catch (e) {
    console.error(`[${telefone}] erro processando mídia:`, e.message);
    await zapiSendText(telefone, "Recebi seu arquivo, vou repassar pra equipe analisar 👍");
    const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
    await zapiSendText(telefoneFelipe, `⚠️ Falha ao processar mídia de ${nomeLead || telefone}: ${e.message}`);
  }
}

async function processarMidiaRecebida(telefone, nomeLead, midia) {
  const st = getEstado(telefone);
  const servico = inferirServicoDaConversa(telefone);

  if (st.proprietario) {
    await arquivarMidiaUnica(telefone, nomeLead, midia, st.proprietario, servico);
    return;
  }

  // Sem proprietário ainda — baixa, salva em disco e pergunta
  const buffer = await baixarMidia(midia.url);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const arquivoLocal = path.join(MIDIA_DIR, `${telefone}_${id}_${midia.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
  fs.writeFileSync(arquivoLocal, buffer);

  if (!st.midiasPendentes) st.midiasPendentes = [];
  st.midiasPendentes.push({ arquivoLocal, fileName: midia.fileName, mimeType: midia.mimeType, tipo: midia.tipo });
  st.aguardandoProprietario = true;
  salvarEstado();

  if (st.midiasPendentes.length === 1) {
    await zapiSendText(telefone, "Recebi! 📋 Antes de arquivar, qual o *nome do proprietário* do imóvel?");
  }
  console.log(`[${telefone}] mídia em espera (proprietário ainda não definido). Pendentes: ${st.midiasPendentes.length}`);
}

async function processarMidiasPendentes(telefone, nomeLead, proprietario) {
  const st = getEstado(telefone);
  const servico = inferirServicoDaConversa(telefone);
  const pendentes = st.midiasPendentes || [];
  st.midiasPendentes = [];
  st.aguardandoProprietario = false;
  salvarEstado();

  for (const m of pendentes) {
    try {
      const buffer = fs.readFileSync(m.arquivoLocal);
      const midiaSimulada = {
        tipo: m.tipo,
        fileName: m.fileName,
        mimeType: m.mimeType,
        url: null,
        bufferLocal: buffer,
      };
      // arquivarMidiaUnica chama processarMidia que baixa via URL — vamos contornar
      await arquivarComBufferLocal(telefone, nomeLead, midiaSimulada, proprietario, servico);
      try { fs.unlinkSync(m.arquivoLocal); } catch {}
    } catch (e) {
      console.error(`[${telefone}] erro reprocessando ${m.fileName}: ${e.message}`);
    }
  }
}

async function arquivarComBufferLocal(telefone, nomeLead, midia, proprietario, servico) {
  const { analisarComVision } = await import("./media.js");
  const { uploadArquivo, garantirPastasProcesso, rootPorServico, slugCliente } = await import("./dropbox.js");
  console.log(`[${telefone}] processando ${midia.fileName} pra proprietário "${proprietario}"`);
  try {
    const contexto = `Lead: ${nomeLead || ""}, telefone ${telefone}. Proprietário: ${proprietario}. Serviço: ${servico}.`;
    const analise = await analisarComVision(midia.bufferLocal, midia.mimeType, contexto);

    const slug = slugCliente(proprietario);
    const root = rootPorServico(servico);
    const pastas = await garantirPastasProcesso(root, slug);
    const subFolderMap = { "foto-vertice": pastas.levantamento, "foto-levantamento": pastas.levantamento, "planta": pastas.escritorio, "memorial": pastas.escritorio, "dxf": pastas.escritorio };
    const pastaDestino = subFolderMap[(analise.tipo || "").toLowerCase()] || pastas.docsCliente;

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const nomeFinal = `${ts}_${analise.tipo}_${midia.fileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dropboxPath = `${pastaDestino}/${nomeFinal}`;
    const upload = await uploadArquivo(dropboxPath, midia.bufferLocal);

    const respostaCliente = `Recebi seu ${analise.tipo} 📋 ${analise.resumo_curto || ""}`.trim();
    await zapiSendText(telefone, respostaCliente);

    const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
    const validacoesTxt = (analise.validacoes || []).map(v => `${v.ok ? "✅" : "⚠️"} ${v.regra}: ${v.detalhe}`).join("\n");
    const alertasTxt = (analise.alertas || []).join("\n");
    const aviso = `📎 *Documento recebido — Tales*\n\n*Proprietário:* ${proprietario}\n*Lead:* ${nomeLead || "—"} (${telefone})\n*Tipo:* ${analise.tipo}\n*Resumo:* ${analise.resumo_curto || "—"}\n\n*Pasta:* ${pastas.base}\n*Arquivo:* ${upload.path_display || dropboxPath}${validacoesTxt ? `\n\n*Validações:*\n${validacoesTxt}` : ""}${alertasTxt ? `\n\n⚠️ *Alertas:*\n${alertasTxt}` : ""}`;
    await zapiSendText(telefoneFelipe, aviso);
  } catch (e) {
    console.error(`[${telefone}] erro arquivando: ${e.message}`);
    const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
    await zapiSendText(telefoneFelipe, `⚠️ Falha ao arquivar mídia de ${nomeLead || telefone}: ${e.message}`);
  }
}

function pareceNomeProprio(texto) {
  const t = (texto || "").trim();
  if (!t || t.length < 3 || t.length > 80) return false;
  if (/[?!]/.test(t)) return false;
  // Aceita "João Silva", "Tiago Zago", "Maria da Silva"
  return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{2,}$/.test(t);
}

app.post("/webhook", async (req, res) => {
  res.status(200).send("ok");
  try {
    const body = req.body || {};
    if (body.fromMe) return;
    if (body.isGroup) return;

    const telefone = body.phone;
    const nomeLead = body.senderName || body.chatName || "";
    if (!telefone) return;

    const parceiro = ehParceiro(telefone);
    if (parceiro) {
      console.log(`[${telefone}] parceiro: ${parceiro.nome}`);
      await processarMensagemParceiro({ telefone, parceiro, body, zapiSendText });
      return;
    }

    if (leadEstaPausado(telefone)) {
      console.log(`[${telefone}] pausado (transferido) — ignorando`);
      return;
    }

    const midia = extrairMidiaDoWebhook(body);
    if (midia) {
      await processarMidiaRecebida(telefone, nomeLead, midia);
      return;
    }

    const mensagem = body.text?.message || body.message || body.body || "";
    if (!mensagem) return;

    console.log(`[${telefone}] ${nomeLead}: ${mensagem}`);

    const st = getEstado(telefone);
    if (st.aguardandoProprietario && pareceNomeProprio(mensagem)) {
      st.proprietario = mensagem.trim();
      salvarEstado();
      console.log(`[${telefone}] proprietário definido: ${st.proprietario}`);
      await zapiSendText(telefone, `Beleza, ${st.proprietario.split(" ")[0]}! Vou processar e arquivar agora 👍`);
      await processarMidiasPendentes(telefone, nomeLead, st.proprietario);
      return;
    }

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
