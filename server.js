// Servidor webhook que recebe mensagens do Z-API e responde via Claude (Tales)
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

import { carregarConhecimento, tamanhoEstimado } from "./conhecimento.js";
import { TOOL_DEFS, executarTool, leadEstaPausado, pausarLead, despausarLead, zapiSendText, zapiTranscreverAudio } from "./tools.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { extrairMidiaDoWebhook, processarMidia } from "./media.js";
import { ehParceiro, processarMensagemParceiro } from "./parceiros.js";
import { agendarLembretes, rodarLembretes } from "./lembretes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const app = express();
app.use(express.json({ limit: "10mb" }));

const HISTORICO_FILE = path.join(DATA_DIR, "conversas.json");
const historico = fs.existsSync(HISTORICO_FILE)
  ? JSON.parse(fs.readFileSync(HISTORICO_FILE, "utf8"))
  : {};

const ESTADO_FILE = path.join(DATA_DIR, "estado.json");
const estado = fs.existsSync(ESTADO_FILE)
  ? JSON.parse(fs.readFileSync(ESTADO_FILE, "utf8"))
  : {};

const MIDIA_DIR = path.join(DATA_DIR, "midia-pendente");
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

function systemBlocks(contextoCliente = "") {
  const blocks = [
    { type: "text", text: carregarConhecimento(), cache_control: { type: "ephemeral" } },
    { type: "text", text: SYSTEM_PROMPT },
  ];
  if (contextoCliente) {
    blocks.push({ type: "text", text: `# CONTEXTO DESTE LEAD (memória de conversas anteriores)\n${contextoCliente}` });
  }
  return blocks;
}

function montarContextoCliente(telefone) {
  const st = estado[telefone] || {};
  const conv = historico[telefone] || [];
  if (!st.proprietario && conv.length === 0) return "";

  const partes = [];
  if (st.proprietario) partes.push(`- Proprietário/cliente já identificado: ${st.proprietario}`);
  if (st.servico) partes.push(`- Serviço em discussão: ${st.servico}`);
  if (st.ultimaInteracao) {
    const dias = Math.floor((Date.now() - new Date(st.ultimaInteracao).getTime()) / 86400000);
    if (dias > 0) partes.push(`- Última interação: ${dias} dia(s) atrás`);
  }
  if (st.docsRecebidos && st.docsRecebidos.length) {
    partes.push(`- Documentos já recebidos: ${st.docsRecebidos.map(d => d.tipo).join(", ")}`);
  }
  if (st.pastaProcesso) partes.push(`- Pasta no Dropbox: ${st.pastaProcesso}`);

  if (partes.length === 0) return "";
  return partes.join("\n") + "\n\nUse essa memória pra retomar a conversa naturalmente. Se faz mais de 7 dias que falaram, dê uma boas-vindas calorosa (\"Oi de novo, " + (st.proprietario?.split(" ")[0] || "tudo bem") + "!\"). Não pergunte coisas que já sabe.";
}

async function rodarAgente(telefone, nomeLead, mensagemUsuario) {
  if (!historico[telefone]) historico[telefone] = [];
  const conv = historico[telefone];
  conv.push({ role: "user", content: mensagemUsuario });

  let respostaFinal = "";
  let iter = 0;

  const contexto = montarContextoCliente(telefone);
  // marca interação atual
  const st = getEstado(telefone);
  st.ultimaInteracao = new Date().toISOString();
  salvarEstado();

  while (iter++ < 6) {
    const r = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: systemBlocks(contexto),
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

    const resumoLimpo = (analise.resumo_curto || "").replace(/[`{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 250);
    const tipoLimpo = (analise.tipo || "documento").replace(/[`{}]/g, "");
    const respostaCliente = `Recebi seu ${tipoLimpo} 📋 ${resumoLimpo}`.trim();
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
    const st = getEstado(telefone);
    const docsAnteriores = st.docsRecebidos || [];
    const ctxDocs = docsAnteriores.length ? `Documentos já recebidos deste cliente: ${JSON.stringify(docsAnteriores.map(d => ({ tipo: d.tipo, campos: d.campos })))}.` : "";
    const contexto = `Lead: ${nomeLead || ""}, telefone ${telefone}. Proprietário: ${proprietario}. Serviço: ${servico}. ${ctxDocs}`;
    const analise = await analisarComVision(midia.bufferLocal, midia.mimeType, contexto);

    // Validação cruzada
    const cruzamentos = cruzarDocs(analise, docsAnteriores);
    if (cruzamentos.length) {
      analise.alertas = [...(analise.alertas || []), ...cruzamentos];
    }

    const slug = slugCliente(proprietario);
    const root = rootPorServico(servico);
    const pastas = await garantirPastasProcesso(root, slug);
    const subFolderMap = { "foto-vertice": pastas.levantamento, "foto-levantamento": pastas.levantamento, "planta": pastas.escritorio, "memorial": pastas.escritorio, "dxf": pastas.escritorio };
    const pastaDestino = subFolderMap[(analise.tipo || "").toLowerCase()] || pastas.docsCliente;

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const nomeFinal = `${ts}_${analise.tipo}_${midia.fileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dropboxPath = `${pastaDestino}/${nomeFinal}`;
    const upload = await uploadArquivo(dropboxPath, midia.bufferLocal);

    const resumoLimpo = (analise.resumo_curto || "").replace(/[`{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 250);
    const tipoLimpo = (analise.tipo || "documento").replace(/[`{}]/g, "");
    const respostaCliente = `Recebi seu ${tipoLimpo} 📋 ${resumoLimpo}`.trim();
    await zapiSendText(telefone, respostaCliente);

    const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
    const validacoesTxt = (analise.validacoes || []).map(v => `${v.ok ? "✅" : "⚠️"} ${v.regra}: ${v.detalhe}`).join("\n");
    const alertasTxt = (analise.alertas || []).join("\n");
    const aviso = `📎 *Documento recebido — Tales*\n\n*Proprietário:* ${proprietario}\n*Lead:* ${nomeLead || "—"} (${telefone})\n*Tipo:* ${analise.tipo}\n*Resumo:* ${analise.resumo_curto || "—"}\n\n*Pasta:* ${pastas.base}\n*Arquivo:* ${upload.path_display || dropboxPath}${validacoesTxt ? `\n\n*Validações:*\n${validacoesTxt}` : ""}${alertasTxt ? `\n\n⚠️ *Alertas:*\n${alertasTxt}` : ""}`;
    await zapiSendText(telefoneFelipe, aviso);

    // Salva o doc no estado pra cruzamento futuro
    if (!st.docsRecebidos) st.docsRecebidos = [];
    st.docsRecebidos.push({ tipo: analise.tipo, campos: analise.campos || {}, ts: new Date().toISOString(), arquivo: midia.fileName });
    st.proprietario = proprietario;
    st.servico = servico;
    st.pastaProcesso = pastas.base;
    salvarEstado();
  } catch (e) {
    console.error(`[${telefone}] erro arquivando: ${e.message}`);
    const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
    await zapiSendText(telefoneFelipe, `⚠️ Falha ao arquivar mídia de ${nomeLead || telefone}: ${e.message}`);
  }
}

function cruzarDocs(novo, anteriores) {
  const alertas = [];
  if (!novo.campos) return alertas;
  const novoNirf = novo.campos.NIRF || novo.campos.nirf || novo.campos.codigo_imovel || novo.campos.codigo;
  const novoArea = parseFloat(String(novo.campos.area || novo.campos.area_total || novo.campos.area_registrada || "").replace(",", ".")) || null;
  const novoProp = (novo.campos.proprietario || novo.campos.proprietarios || "").toString().toLowerCase();

  for (const a of anteriores) {
    const c = a.campos || {};
    const aNirf = c.NIRF || c.nirf || c.codigo_imovel || c.codigo;
    const aArea = parseFloat(String(c.area || c.area_total || c.area_registrada || "").replace(",", ".")) || null;
    const aProp = (c.proprietario || c.proprietarios || "").toString().toLowerCase();

    if (novoNirf && aNirf && novoNirf !== aNirf) {
      alertas.push(`⚠️ NIRF diferente: ${novo.tipo}=${novoNirf} vs ${a.tipo}=${aNirf}`);
    }
    if (novoArea && aArea && Math.abs(novoArea - aArea) / Math.max(novoArea, aArea) > 0.05) {
      alertas.push(`⚠️ Área diverge >5%: ${novo.tipo}=${novoArea}ha vs ${a.tipo}=${aArea}ha`);
    }
    if (novoProp && aProp && !novoProp.includes(aProp.slice(0, 8)) && !aProp.includes(novoProp.slice(0, 8))) {
      alertas.push(`⚠️ Proprietário diverge: ${novo.tipo}="${novo.campos.proprietario}" vs ${a.tipo}="${c.proprietario}"`);
    }
  }
  return alertas;
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
    if (body.isGroup) return;

    // Mensagem ENVIADA pelo WhatsApp da Native (Felipe/Gustavo manual) → silencia Tales naquela conversa
    if (body.fromMe) {
      const phone = body.phone;
      if (!phone) return;
      const texto = body.text?.message || body.message || body.body || "";
      // Comando especial pra reativar Tales
      if (/\b(\/tales\s+on|reativar tales|tales volta)\b/i.test(texto)) {
        despausarLead(phone);
        console.log(`[${phone}] Tales reativado manualmente`);
        return;
      }
      // Senão, pausa Tales 7 dias (renova a cada mensagem manual)
      pausarLead(phone, 24);
      console.log(`[${phone}] mensagem manual da Native — Tales pausado 24h`);
      return;
    }

    const telefone = body.phone;
    const nomeLead = body.senderName || body.chatName || "";
    if (!telefone) return;

    // Bloqueio: se a mensagem vier dos próprios números da equipe, Tales ignora (match flexível por sufixo)
    const equipe = [
      process.env.TELEFONE_FELIPE,
      process.env.TELEFONE_PRECILA,
      process.env.TELEFONE_GUSTAVO,
    ].filter(Boolean).map(t => String(t).replace(/\D/g, ""));
    const telNorm = String(telefone).replace(/\D/g, "");
    const ehDaEquipe = equipe.some(e => {
      const a = e.slice(-10), b = telNorm.slice(-10);
      return a === b && a.length === 10;
    });
    if (ehDaEquipe) {
      console.log(`[${telefone}] mensagem da equipe — Tales ignora (qualquer tipo de mídia/texto)`);
      return;
    }

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

    // Áudio: transcreve e trata como mensagem de texto
    let mensagem = body.text?.message || body.message || body.body || "";
    if (!mensagem && body.audio) {
      const audioUrl = body.audio.audioUrl || body.audio.url;
      const transcription = body.audio.transcription
        || await zapiTranscreverAudio({ messageId: body.messageId, audioUrl });
      if (transcription) {
        mensagem = transcription;
        console.log(`[${telefone}] 🎙️  áudio transcrito: ${mensagem}`);
      } else {
        console.warn(`[${telefone}] áudio recebido mas sem transcrição`);
        await zapiSendText(telefone, "Recebi seu áudio 🎙️ mas tive dificuldade de entender. Pode digitar pra mim?");
        return;
      }
    }
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

app.get("/health", (_req, res) => res.json({ ok: true, conversas: Object.keys(historico).length, dataDir: DATA_DIR }));

// Trigger manual dos lembretes (útil pra testar)
app.post("/lembretes/run", async (_req, res) => {
  try {
    await rodarLembretes();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Tales rodando em http://localhost:${PORT}`);
  console.log(`   Webhook Z-API → POST http://SEU_HOST:${PORT}/webhook`);
  console.log(`   DATA_DIR: ${DATA_DIR}`);
  agendarLembretes();
});
