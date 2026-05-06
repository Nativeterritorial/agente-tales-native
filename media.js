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
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: [
        sourceBlock,
        {
          type: "text",
          text: `Você é um analista da NATIVE Topografia. Identifique o tipo deste documento/imagem e extraia os dados-chave.

Contexto da conversa: ${contextoConversa || "(nenhum)"}

Tipos esperados:
- CCIR (Certificado de Cadastro de Imóvel Rural) → extrair: código do imóvel, NIRF, área total, proprietário(s), validade
- ITR → extrair: NIRF, ano-base, valor, área
- Matrícula → extrair: número, cartório, proprietário, área registrada, confrontantes, ônus, data da última atualização
- CAR → extrair: número CAR, status, área CAR, área de reserva, APP
- Documento de identidade/CPF → extrair: nome, CPF, RG
- Foto de vértice GNSS / marco de georreferenciamento
- Foto de levantamento / planta / croqui
- Outro

Retorne ESTRITAMENTE em JSON válido (sem markdown, sem texto extra):
{
  "tipo": "CCIR|ITR|matricula|CAR|identidade|foto-vertice|foto-levantamento|planta|outro",
  "campos": { ... campos extraídos ... },
  "validacoes": [ { "ok": true/false, "regra": "...", "detalhe": "..." } ],
  "resumo_curto": "1-2 linhas resumindo o que é e se está OK",
  "alertas": [ "lista de alertas, se houver" ]
}`,
        },
      ],
    }],
  });

  const txt = r.content.filter(b => b.type === "text").map(b => b.text).join("");
  try {
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { tipo: "outro", resumo_curto: txt.slice(0, 200) };
  } catch {
    return { tipo: "outro", resumo_curto: txt.slice(0, 200), erro_parse: true };
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
