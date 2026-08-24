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
  if (st.origem?.fonte === "meta_ads") {
    const titulo = st.origem.titulo || "(sem título)";
    partes.push(`- 🎯 LEAD VEIO DO META ADS: clicou no anúncio "${titulo}"${st.origem.descricao ? ` — "${st.origem.descricao}"` : ""}. Acolhe referenciando o anúncio ("vi que você veio do nosso anúncio sobre X"), seja DIRETO indo pro serviço relacionado, e qualifica rápido (cidade + necessidade) sem rodeio. Lead de tráfego pago é caro e tem pressa.`);
  }
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
          const stTool = estado[telefone] || {};
          const result = await executarTool(block.name, {
            ...block.input,
            telefone_lead: block.input.telefone_lead || telefone,
            nome_lead: block.input.nome_lead || nomeLead,
            origem: block.input.origem || stTool.origem || null,
          });
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
  // Tales NÃO arquiva mais automaticamente. Apenas:
  // 1. Acolhe o lead ("recebi seu documento")
  // 2. Notifica Felipe pra arquivar manualmente
  // 3. Pausa Tales nessa conversa (humano vai cuidar)
  try {
    await zapiSendText(telefone, "Recebi seu documento 📋 já estou repassando pra equipe analisar e arquivar. Em breve te retornamos 👍");
  } catch (e) {
    console.error(`[${telefone}] erro respondendo recebimento de mídia:`, e.message);
  }

  const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
  const aviso = `📎 *Documento recebido — Tales*\n\n*Lead:* ${nomeLead || "—"} (${telefone})\n*Arquivo:* ${midia.fileName}\n*Tipo:* ${midia.tipo}\n\n_Tales NÃO arquivou automaticamente — baixa pelo WhatsApp e arquiva manualmente na pasta correta._\n\nTales foi pausado nessa conversa. Pra reativar, mande "/tales on" pro lead.`;
  try {
    await zapiSendText(telefoneFelipe, aviso);
  } catch (e) {
    console.error(`[${telefone}] erro avisando Felipe sobre mídia:`, e.message);
  }

  // Pausa Tales indefinidamente nessa conversa (humano assumiu)
  pausarLead(telefone, 24 * 365);
  console.log(`[${telefone}] mídia recebida (${midia.fileName}) — Felipe avisado, Tales pausado nessa conversa`);
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
  if (!t || t.length < 5 || t.length > 80) return false;
  if (/[?!]/.test(t)) return false;
  // Sem pontuação no final (frase) — nomes não terminam em ponto
  if (/[.,;:]$/.test(t)) return false;
  // Pelo menos 2 palavras (nome + sobrenome)
  const palavras = t.split(/\s+/).filter(p => p.length > 0);
  if (palavras.length < 2) return false;
  // Cada palavra começa com letra (não dígito)
  if (!palavras.every(p => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'-]*$/.test(p))) return false;
  // Rejeita saudações, respostas curtas, frases comuns
  const tLower = t.toLowerCase();
  const naoNome = [
    "bom dia", "boa tarde", "boa noite", "tudo bem", "tudo certo",
    "obrigado", "obrigada", "valeu", "beleza", "perfeito", "blz",
    "pode ser", "claro que", "sem problema", "muito obrigado",
    "sim senhor", "sim senhora", "ok entendi", "tá bom", "ta bom",
  ];
  if (naoNome.some(n => tLower === n || tLower.startsWith(n + " "))) return false;
  // Rejeita frases com verbos comuns (heurística: contém " é ", " tá ", " está ", " sou ", " mora ", " tem ", " precisa ")
  if (/\b(é|sou|tá|esta|está|tem|mora|preciso|precisa|quero|posso|vou|vai|seria)\b/i.test(t)) return false;
  return true;
}

// Normaliza payload da Evolution API pro formato que o resto do código espera (estilo Z-API)
function normalizarEvolution(raw) {
  if (!raw || typeof raw !== "object") return raw;
  // Se já parece Z-API (tem campo phone direto), retorna como está
  if (raw.phone || raw.fromMe !== undefined) return raw;
  // Evolution: { event, instance, data: { key, message, messageType, pushName, ... } }
  const d = raw.data || raw;
  const key = d.key || {};
  const msg = d.message || {};
  const remoteJid = key.remoteJid || d.remoteJid || "";
  // Ignora grupos e broadcasts
  const isGroup = remoteJid.endsWith("@g.us") || remoteJid.includes("-");
  const phone = remoteJid.split("@")[0].replace(/\D/g, "");
  const fromMe = !!key.fromMe;
  const senderName = d.pushName || "";
  const messageId = key.id || d.id;

  // Texto: conversation | extendedTextMessage.text | imageMessage.caption | documentMessage.caption
  const textoConteudo =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.videoMessage?.caption ||
    "";

  const out = {
    phone,
    fromMe,
    isGroup,
    senderName,
    chatName: senderName,
    messageId,
    text: textoConteudo ? { message: textoConteudo } : undefined,
    message: textoConteudo,
  };

  // Mídia
  if (msg.imageMessage) {
    out.image = {
      url: msg.imageMessage.url || null,
      imageUrl: msg.imageMessage.url || null,
      fileName: msg.imageMessage.fileName || `imagem-${Date.now()}.jpg`,
      mimeType: msg.imageMessage.mimetype || "image/jpeg",
      caption: msg.imageMessage.caption,
    };
  }
  if (msg.documentMessage) {
    out.document = {
      url: msg.documentMessage.url || null,
      documentUrl: msg.documentMessage.url || null,
      fileName: msg.documentMessage.fileName || `documento-${Date.now()}`,
      mimeType: msg.documentMessage.mimetype || "application/octet-stream",
      caption: msg.documentMessage.caption,
    };
  }
  if (msg.audioMessage) {
    out.audio = {
      url: msg.audioMessage.url || null,
      audioUrl: msg.audioMessage.url || null,
    };
  }

  // Click-to-WhatsApp Ads (Meta) — extrai info do anúncio que originou o lead.
  // Evolution/Baileys traz em contextInfo.externalAdReply
  const ctx =
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.conversation?.contextInfo ||
    d.contextInfo ||
    null;
  const ad = ctx?.externalAdReply;
  if (ad) {
    out.referral = {
      titulo: ad.title || null,
      descricao: ad.body || null,
      sourceUrl: ad.sourceUrl || null,
      sourceId: ad.sourceId || null,
      sourceType: ad.sourceType || null,   // ad, post, etc.
      mediaType: ad.mediaType || null,     // image, video
      ctwaClid: ad.ctwaClid || ctx?.ctwaClid || null,
      thumbnailUrl: ad.thumbnailUrl || null,
    };
  }
  return out;
}

app.post("/webhook", async (req, res) => {
  res.status(200).send("ok");
  try {
    const body = normalizarEvolution(req.body || {});
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
      // Senão, pausa Tales INDEFINIDAMENTE (humano assumiu — só reativa com /tales on)
      pausarLead(phone, 24 * 365); // 1 ano = na prática indeterminado
      console.log(`[${phone}] mensagem manual da Native — Tales pausado indefinidamente (use "/tales on" pra reativar)`);
      return;
    }

    const telefone = body.phone;
    const nomeLead = body.senderName || body.chatName || "";
    if (!telefone) return;

    // Bloqueio: números da equipe + lista extra em TELEFONES_IGNORAR (separados por vírgula)
    const ignorarExtras = (process.env.TELEFONES_IGNORAR || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    const equipe = [
      process.env.TELEFONE_FELIPE,
      process.env.TELEFONE_PRECILA,
      process.env.TELEFONE_GUSTAVO,
      ...ignorarExtras,
    ].filter(Boolean).map(t => String(t).replace(/\D/g, ""));
    const telNorm = String(telefone).replace(/\D/g, "");
    // Canonicaliza padrão BR: remove DDI 55 e o "9" extra do celular → DDD+8 dígitos
    const canonBr = (d) => {
      d = String(d || "").replace(/\D/g, "");
      if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
      if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
      return d;
    };
    const telCanon = canonBr(telNorm);
    const ehDaEquipe = equipe.some(e => {
      const a = canonBr(e);
      return a && a === telCanon;
    });
    console.log(`[${telefone}] check equipe — telNorm=${telNorm} equipe=[${equipe.join(",")}] match=${ehDaEquipe}`);
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

    // Captura origem (Click-to-WhatsApp do Meta) — grava no estado se ainda não tem
    if (body.referral) {
      const st = getEstado(telefone);
      if (!st.origem) {
        st.origem = {
          fonte: "meta_ads",
          ...body.referral,
          capturadoEm: new Date().toISOString(),
        };
        salvarEstado();
        console.log(`[${telefone}] 🎯 lead veio de anúncio Meta: "${body.referral.titulo || "(sem título)"}"`);
        const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
        try {
          await zapiSendText(telefoneFelipe, `🎯 *Novo lead do anúncio*\n\n*Telefone:* ${telefone}\n*Nome:* ${nomeLead || "—"}\n*Anúncio:* ${body.referral.titulo || "—"}\n${body.referral.descricao ? `*Descrição:* ${body.referral.descricao}\n` : ""}${body.referral.sourceUrl ? `*Link:* ${body.referral.sourceUrl}` : ""}`);
        } catch (e) {
          console.warn(`[${telefone}] falha avisando Felipe sobre lead Meta: ${e.message}`);
        }
      }
    }

    const midia = extrairMidiaDoWebhook(body);
    if (midia) {
      await processarMidiaRecebida(telefone, nomeLead, midia);
      return;
    }

    let mensagem = body.text?.message || body.message || body.body || "";
    // Áudio sem transcrição (Evolution não tem nativo) — pede pra digitar
    if (!mensagem && body.audio) {
      console.warn(`[${telefone}] áudio recebido — sem transcrição (Evolution)`);
      await zapiSendText(telefone, "Recebi seu áudio 🎙️ mas não consigo escutar agora. Pode digitar pra mim?");
      return;
    }
    if (!mensagem) return;

    console.log(`[${telefone}] ${nomeLead}: ${mensagem}`);

    const resposta = await rodarAgente(telefone, nomeLead, mensagem);
    if (resposta) {
      // Sentinela: Tales decidiu não responder (mensagem ambígua / conversa humana)
      if (/\[SILENCIO\]/i.test(resposta.trim())) {
        console.log(`[${telefone}] Tales: [SILENCIO] — não respondeu`);
      } else {
        await zapiSendText(telefone, resposta);
        console.log(`[${telefone}] Tales: ${resposta}`);
      }
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
