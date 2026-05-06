// Implementação das 3 tools que o Tales chama
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FAIXAS_GEO = [
  { min: 0,  max: 5,   precoMin: 3500, precoMax: 4000 },
  { min: 5,  max: 10,  precoMin: 4000, precoMax: 5000 },
  { min: 10, max: 20,  precoMin: 5000, precoMax: 7500 },
  { min: 20, max: 30,  precoMin: 7500, precoMax: 10000 },
  { min: 30, max: 40,  precoMin: 7500, precoMax: 12000 },
];

export function consultar_preco_georreferenciamento({ area_hectares }) {
  const a = Number(area_hectares);
  if (!Number.isFinite(a) || a <= 0) {
    return { erro: "Área inválida. Pergunte a área em hectares ao lead." };
  }
  if (a > 40) {
    return { area_hectares: a, faixa: "acima de 40 ha", preco: "a consultar com o Felipe", mensagem_sugerida: "Pra essa área (acima de 40ha) o orçamento é caso a caso. Vou te passar pro Felipe que fecha o valor com você." };
  }
  const faixa = FAIXAS_GEO.find(f => a > f.min && a <= f.max) || FAIXAS_GEO[0];
  return {
    area_hectares: a,
    faixa: `${faixa.min}–${faixa.max} ha`,
    preco_min: faixa.precoMin,
    preco_max: faixa.precoMax,
    mensagem_sugerida: `Pra ${a} hectares o investimento fica entre R$ ${faixa.precoMin.toLocaleString('pt-BR')} e R$ ${faixa.precoMax.toLocaleString('pt-BR')}. Valor exato depende de acesso, relevo, número de vértices e documentação — o Felipe fecha isso com você.`,
  };
}

const LEADS_FILE = path.join(__dirname, "leads.jsonl");
const PAUSA_FILE = path.join(__dirname, "pausas.json");

const TELEFONE_FELIPE = process.env.TELEFONE_FELIPE || "5554992215356";
const TELEFONE_PRECILA = process.env.TELEFONE_PRECILA || "5554991495120";

export async function transferir_humano({ nome_lead, telefone_lead, servico, resumo, responsavel }) {
  const r = (responsavel || "").toLowerCase();
  const destino = r === "precila" ? TELEFONE_PRECILA : TELEFONE_FELIPE;
  const nomeResp = r === "precila" ? "Precila" : "Felipe";
  const texto = `🔔 *Lead transferido — Tales*\n\n*Nome:* ${nome_lead || "—"}\n*Telefone:* ${telefone_lead || "—"}\n*Serviço:* ${servico || "—"}\n\n*Resumo:* ${resumo}`;

  await zapiSendText(destino, texto);

  fs.appendFileSync(LEADS_FILE, JSON.stringify({
    ts: new Date().toISOString(),
    status: "TRANSFERIDO",
    responsavel: nomeResp,
    nome_lead, telefone_lead, servico, resumo,
  }) + "\n");

  if (telefone_lead) {
    const pausas = fs.existsSync(PAUSA_FILE) ? JSON.parse(fs.readFileSync(PAUSA_FILE, "utf8")) : {};
    pausas[telefone_lead] = Date.now() + 6 * 60 * 60 * 1000;
    fs.writeFileSync(PAUSA_FILE, JSON.stringify(pausas, null, 2));
  }

  const artigo = r === "precila" ? "pra Precila (nossa bióloga)" : "pro Felipe (responsável técnico)";
  return { ok: true, mensagem_sugerida: `Beleza! Já passei ${artigo} com o resumo. Em pouco tempo ${r === "precila" ? "ela" : "ele"} te chama por aqui mesmo 👍` };
}

export function salvar_lead(dados) {
  fs.appendFileSync(LEADS_FILE, JSON.stringify({
    ts: new Date().toISOString(),
    status: "QUALIFICADO",
    ...dados,
  }) + "\n");
  return { ok: true };
}

export function pausarLead(telefone, horas = 24 * 7) {
  if (!telefone) return;
  const pausas = fs.existsSync(PAUSA_FILE) ? JSON.parse(fs.readFileSync(PAUSA_FILE, "utf8")) : {};
  pausas[telefone] = Date.now() + horas * 60 * 60 * 1000;
  fs.writeFileSync(PAUSA_FILE, JSON.stringify(pausas, null, 2));
}

export function despausarLead(telefone) {
  if (!fs.existsSync(PAUSA_FILE)) return;
  const pausas = JSON.parse(fs.readFileSync(PAUSA_FILE, "utf8"));
  if (pausas[telefone]) {
    delete pausas[telefone];
    fs.writeFileSync(PAUSA_FILE, JSON.stringify(pausas, null, 2));
  }
}

export function leadEstaPausado(telefone) {
  if (!fs.existsSync(PAUSA_FILE)) return false;
  const pausas = JSON.parse(fs.readFileSync(PAUSA_FILE, "utf8"));
  const ate = pausas[telefone];
  if (!ate) return false;
  if (Date.now() > ate) {
    delete pausas[telefone];
    fs.writeFileSync(PAUSA_FILE, JSON.stringify(pausas, null, 2));
    return false;
  }
  return true;
}

export async function zapiSendText(phone, message) {
  const base = process.env.ZAPI_BASE || `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const headers = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const r = await fetch(`${base}/send-text`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, message }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error(`Z-API erro ${r.status}: ${txt}`);
  }
  return r.ok;
}

export const TOOL_DEFS = [
  {
    name: "consultar_preco_georreferenciamento",
    description: "Consulta a faixa de preço de georreferenciamento de imóvel rural conforme a área em hectares. Use quando o lead pedir orçamento de georreferenciamento e disser a área.",
    input_schema: {
      type: "object",
      properties: { area_hectares: { type: "number", description: "Área do imóvel em hectares" } },
      required: ["area_hectares"],
    },
  },
  {
    name: "transferir_humano",
    description: "Transfere o lead pro responsável correto. Use 'felipe' pra georreferenciamento/topografia/loteamento/GeoCidade. Use 'precila' pra licenciamento ambiental, corte/supressão de vegetação, transplante vegetal, CAR, defesa de multa ambiental ou qualquer assunto ambiental que exija análise específica.",
    input_schema: {
      type: "object",
      properties: {
        nome_lead: { type: "string" },
        telefone_lead: { type: "string" },
        servico: { type: "string", enum: ["georreferenciamento", "topografia", "licenciamento", "corte_vegetacao", "transplante_vegetal", "CAR", "defesa_multa", "outro"] },
        responsavel: { type: "string", enum: ["felipe", "precila"], description: "Felipe pra geo/topo. Precila pra qualquer assunto ambiental." },
        resumo: { type: "string", description: "Resumo curto: cidade, área, serviço, finalidade, urgência" },
      },
      required: ["resumo", "responsavel"],
    },
  },
  {
    name: "salvar_lead",
    description: "Salva ou atualiza dados qualificados do lead. Chame ao longo da conversa conforme coleta dados.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        servico: { type: "string" },
        area_ha: { type: "number" },
        cidade: { type: "string" },
        finalidade: { type: "string" },
        urgencia: { type: "string" },
      },
    },
  },
];

export async function executarTool(name, input) {
  switch (name) {
    case "consultar_preco_georreferenciamento": return consultar_preco_georreferenciamento(input);
    case "transferir_humano": return await transferir_humano(input);
    case "salvar_lead": return salvar_lead(input);
    default: return { erro: `Tool desconhecida: ${name}` };
  }
}
