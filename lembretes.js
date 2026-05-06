// Roda periodicamente e dispara lembretes operacionais pra equipe
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { zapiSendText } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || __dirname;

const ESTADO_FILE = path.join(DATA_DIR, "estado.json");
const LEMBRETES_FILE = path.join(DATA_DIR, "lembretes-enviados.json");

function carregarEstado() {
  if (!fs.existsSync(ESTADO_FILE)) return {};
  return JSON.parse(fs.readFileSync(ESTADO_FILE, "utf8"));
}

function carregarLembretesEnviados() {
  if (!fs.existsSync(LEMBRETES_FILE)) return {};
  return JSON.parse(fs.readFileSync(LEMBRETES_FILE, "utf8"));
}

function salvarLembretesEnviados(d) {
  fs.writeFileSync(LEMBRETES_FILE, JSON.stringify(d, null, 2));
}

const DIA_MS = 86400000;

export async function rodarLembretes() {
  const estado = carregarEstado();
  const enviados = carregarLembretesEnviados();
  const agora = Date.now();
  const telefoneFelipe = process.env.TELEFONE_FELIPE || "5554992215356";
  const telefoneGustavo = process.env.TELEFONE_GUSTAVO;
  const destinos = [telefoneGustavo, telefoneFelipe].filter(Boolean);

  const pendentes = [];

  for (const [telefone, st] of Object.entries(estado)) {
    if (!st.docsRecebidos || st.docsRecebidos.length === 0) continue;
    const ultimoDoc = st.docsRecebidos[st.docsRecebidos.length - 1];
    const tsDoc = new Date(ultimoDoc.ts).getTime();
    const diasDoc = Math.floor((agora - tsDoc) / DIA_MS);

    // Lembrete: doc recebido faz 3+ dias e ainda não houve interação manual
    if (diasDoc >= 3) {
      const chaveLembrete = `${telefone}_${ultimoDoc.ts}_3d`;
      if (!enviados[chaveLembrete]) {
        pendentes.push(`📋 *${st.proprietario || telefone}* — ${ultimoDoc.tipo} recebido há ${diasDoc} dia(s). Pasta: ${st.pastaProcesso || "—"}`);
        enviados[chaveLembrete] = agora;
      }
    }
  }

  if (pendentes.length > 0) {
    const msg = `⏰ *Lembretes de processos — Tales*\n\n${pendentes.join("\n\n")}\n\n_Verifique se há ação pendente._`;
    for (const d of destinos) await zapiSendText(d, msg);
    console.log(`[lembretes] ${pendentes.length} pendência(s) enviadas`);
  } else {
    console.log(`[lembretes] sem pendências`);
  }

  salvarLembretesEnviados(enviados);
}

export function agendarLembretes() {
  // Roda 1x por dia (23h59 UTC ≈ 20h59 BRT)
  const HORA_BRT = 9; // 9h da manhã BRT
  const proxima = () => {
    const agora = new Date();
    const proximo = new Date(agora);
    proximo.setUTCHours(HORA_BRT + 3, 0, 0, 0); // 9h BRT = 12h UTC
    if (proximo <= agora) proximo.setDate(proximo.getDate() + 1);
    return proximo.getTime() - agora.getTime();
  };

  const tick = () => {
    rodarLembretes().catch(e => console.error("[lembretes] erro:", e.message));
    setTimeout(tick, DIA_MS);
  };

  setTimeout(tick, proxima());
  console.log(`[lembretes] agendado pra rodar diariamente às 9h BRT`);
}
