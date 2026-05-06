// Recebe mídia do Z-API, baixa, analisa com Claude Vision e arquiva no Dropbox
import Anthropic from "@anthropic-ai/sdk";
import { uploadArquivo, garantirPastasProcesso, rootPorServico, slugCliente } from "./dropbox.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function extrairMidiaDoWebhook(body) {
  // Z-API envia mídia em campos como image, document, audio, video
  if (body.image && (body.image.imageUrl || body.image.url)) {
    return { tipo: "image", url: body.image.imageUrl || body.image.url, fileName: body.image.fileName || `imagem-${Date.now()}.jpg`, mimeType: body.image.mimeType || "image/jpeg", caption: body.image.caption };
  }
  if (body.document && (body.document.documentUrl || body.document.url)) {
    return { tipo: "document", url: body.document.documentUrl || body.document.url, fileName: body.document.fileName || `documento-${Date.now()}.pdf`, mimeType: body.document.mimeType || "application/pdf", caption: body.document.caption };
  }
  return null;
}

export async function baixarMidia(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar mídia ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

export async function analisarComVision(buffer, mimeType, contextoConversa = "") {
  const isPdf = mimeType === "application/pdf";
  const sourceBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } }
    : { type: "image", source: { type: "base64", media_type: mimeType.startsWith("image/") ? mimeType : "image/jpeg", data: buffer.toString("base64") } };

  const r = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: [
        sourceBlock,
        {
          type: "text",
          text: `Você é um analista da NATIVE Topografia. Identifique o tipo deste documento/imagem e extraia os dados-chave.

Contexto da conversa: ${contextoConversa || "(nenhum)"}

Tipos esperados (use exatamente um destes valores no campo "tipo"):
- CCIR — Certificado de Cadastro de Imóvel Rural → extrair: código do imóvel, NIRF, área total, proprietário(s), validade
- ITR → extrair: NIRF, ano-base, valor, área
- matricula → extrair: número, cartório, proprietário, área registrada, confrontantes, ônus, data da última atualização
- CAR → extrair: número CAR, status, área CAR, área de reserva, APP
- identidade → extrair: nome, CPF, RG
- foto-vertice — vértice GNSS / marco de georreferenciamento
- foto-levantamento — foto de levantamento / planta / croqui
- planta — planta técnica / DXF / mapa
- outro

REGRAS DE SAÍDA (CRÍTICO):
- Responda APENAS o objeto JSON puro.
- NÃO use markdown (sem \`\`\`json, sem \`\`\`).
- NÃO escreva nada antes ou depois do JSON.
- "resumo_curto" deve ter no MÁXIMO 200 caracteres, em português, linguagem natural pra mandar pro cliente no WhatsApp (ex: "Matrícula 17.036 do Registro de Veranópolis, área 12,5ha, em nome de João Silva. Vigente.").

Schema:
{
  "tipo": "CCIR|ITR|matricula|CAR|identidade|foto-vertice|foto-levantamento|planta|outro",
  "campos": { },
  "validacoes": [ { "ok": true, "regra": "string", "detalhe": "string" } ],
  "resumo_curto": "string (max 200 chars)",
  "alertas": [ "string" ]
}`,
        },
      ],
    }],
  });

  const txt = r.content.filter(b => b.type === "text").map(b => b.text).join("");
  return parseAnaliseJson(txt);
}

function parseAnaliseJson(txt) {
  let limpo = txt.trim();
  // Remove fences markdown (```json ... ``` ou ``` ... ```)
  limpo = limpo.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Pega do primeiro { ao último }
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  const candidato = ini >= 0 && fim > ini ? limpo.slice(ini, fim + 1) : limpo;
  try {
    return JSON.parse(candidato);
  } catch (e) {
    console.warn(`[vision] JSON parse falhou: ${e.message}. Texto: ${txt.slice(0, 300)}`);
    return {
      tipo: "outro",
      campos: {},
      validacoes: [],
      resumo_curto: "documento recebido (análise indisponível)",
      alertas: ["Falha ao interpretar análise automática — verificar manualmente."],
      erro_parse: true,
    };
  }
}

function subpastaPorTipo(tipo) {
  const t = (tipo || "").toLowerCase();
  if (["foto-vertice", "foto-levantamento"].includes(t)) return "levantamento";
  if (["planta", "memorial", "dxf"].includes(t)) return "escritorio";
  return "docs-cliente";
}

export async function processarMidia({ midia, lead, servico }) {
  const buffer = await baixarMidia(midia.url);
  const contexto = `Lead: ${lead.nome || "(sem nome)"}, telefone ${lead.telefone}. Serviço em discussão: ${servico || "indefinido"}.`;
  const analise = await analisarComVision(buffer, midia.mimeType, contexto);

  const slug = slugCliente(lead.nome);
  const root = rootPorServico(servico);
  const pastas = await garantirPastasProcesso(root, slug);
  const sub = subpastaPorTipo(analise.tipo);
  const pastaDestino = sub === "levantamento" ? pastas.levantamento : sub === "escritorio" ? pastas.escritorio : pastas.docsCliente;

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const nomeFinal = `${ts}_${analise.tipo}_${midia.fileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dropboxPath = `${pastaDestino}/${nomeFinal}`;
  const upload = await uploadArquivo(dropboxPath, buffer);

  return { analise, dropboxPath: upload.path_display || dropboxPath, pastaProcesso: pastas.base };
}
