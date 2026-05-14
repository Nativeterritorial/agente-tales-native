// Roteamento de contatos institucionais (cartórios, tabelionatos, órgãos públicos)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadArquivo, criarPastaSeNaoExiste } from "./dropbox.js";
import { baixarMidia, extrairMidiaDoWebhook } from "./media.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARCEIROS_FILE = path.join(__dirname, "parceiros.json");

let _parceiros = null;
function carregarParceiros() {
  if (_parceiros) return _parceiros;
  if (!fs.existsSync(PARCEIROS_FILE)) {
    _parceiros = {};
    return _parceiros;
  }
  _parceiros = JSON.parse(fs.readFileSync(PARCEIROS_FILE, "utf8"));
  return _parceiros;
}

// Normaliza telefone — remove tudo que não é dígito e tenta casar com chaves do JSON
function normalizar(tel) {
  return String(tel || "").replace(/\D/g, "");
}

export function ehParceiro(telefone) {
  const parceiros = carregarParceiros();
  const norm = normalizar(telefone);
  if (parceiros[norm]) return parceiros[norm];
  const sem55 = norm.startsWith("55") ? norm.slice(2) : norm;
  const com55 = norm.startsWith("55") ? norm : "55" + norm;
  if (parceiros[com55]) return parceiros[com55];
  if (parceiros[sem55]) return parceiros[sem55];
  // Match canônico BR: remove DDI 55 e "9" extra do celular → DDD+8 dígitos
  const canonBr = (d) => {
    d = String(d || "").replace(/\D/g, "");
    if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
    if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
    return d;
  };
  const alvo = canonBr(norm);
  if (alvo && alvo.length === 10) {
    for (const chave of Object.keys(parceiros)) {
      if (canonBr(chave) === alvo) return parceiros[chave];
    }
  }
  return null;
}

function pastaComunicacao(tipo, pastaParceiro) {
  const ano = new Date().getFullYear();
  const mes = String(new Date().getMonth() + 1).padStart(2, "0");
  return `/NATIVE TOPOGRAFIA/_Comunicações/${pastaParceiro || tipo}/${ano}-${mes}`;
}

export async function processarMensagemParceiro({ telefone, parceiro, body, zapiSendText }) {
  const telefoneGustavo = process.env.TELEFONE_GUSTAVO;
  const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
  const destinos = [telefoneGustavo, telefoneFelipe].filter(Boolean);

  const midia = extrairMidiaDoWebhook(body);
  const texto = body.text?.message || body.message || body.body || "";

  if (midia) {
    const buffer = await baixarMidia(midia.url);
    const pasta = pastaComunicacao(parceiro.tipo, parceiro.pasta);
    await criarPastaSeNaoExiste("/NATIVE TOPOGRAFIA/_Comunicações");
    await criarPastaSeNaoExiste(`/NATIVE TOPOGRAFIA/_Comunicações/${parceiro.pasta || parceiro.tipo}`);
    await criarPastaSeNaoExiste(pasta);

    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const nomeFinal = `${ts}_${midia.fileName}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dropboxPath = `${pasta}/${nomeFinal}`;
    const upload = await uploadArquivo(dropboxPath, buffer);

    const aviso = `📨 *Mensagem de parceiro — Tales*\n\n*De:* ${parceiro.nome}\n*Telefone:* ${telefone}\n*Tipo:* documento (${midia.tipo})\n*Arquivo:* ${midia.fileName}${texto ? `\n*Legenda:* ${texto}` : ""}\n\n*Salvo em:* ${upload.path_display || dropboxPath}\n\n_Tales não responde automaticamente — responder pelo WhatsApp da Native._`;
    for (const d of destinos) await zapiSendText(d, aviso);
    console.log(`[parceiro] ${parceiro.nome}: doc arquivado em ${dropboxPath} (sem auto-resposta)`);
    return;
  }

  if (texto) {
    const aviso = `📨 *Mensagem de parceiro — Tales*\n\n*De:* ${parceiro.nome}\n*Telefone:* ${telefone}\n\n*Mensagem:*\n${texto}\n\n_Tales não responde automaticamente — responder pelo WhatsApp da Native._`;
    for (const d of destinos) await zapiSendText(d, aviso);
    console.log(`[parceiro] ${parceiro.nome}: mensagem encaminhada (sem auto-resposta)`);
    return;
  }
}
