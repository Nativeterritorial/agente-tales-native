// Carrega base de conhecimento (norma INCRA + regras das aulas) do native-agente
import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_REGRAS = process.env.CONHECIMENTO_DIR || path.join(__dirname, "conhecimento", "regras");

let _cache = null;

export function carregarConhecimento() {
  if (_cache) return _cache;
  const partes = [];
  partes.push("# BASE DE CONHECIMENTO — Georreferenciamento de Imóveis Rurais (INCRA/SIGEF)\n");
  partes.push("Você é especialista em georreferenciamento, com domínio sobre Norma Técnica 3ª Edição do INCRA, Lei 6.015/73, Lei 10.267/01 e os erros mais comuns do SIGEF.\n");
  partes.push("Use as regras abaixo (extraídas de curso especializado) para fundamentar análises técnicas, identificar pendências e orientar leads.\n\n---\n\n");

  if (fs.existsSync(DIR_REGRAS)) {
    const arquivos = fs.readdirSync(DIR_REGRAS).filter(f => f.endsWith(".md")).sort();
    for (const arq of arquivos) {
      partes.push(fs.readFileSync(path.join(DIR_REGRAS, arq), "utf8"));
      partes.push("\n\n---\n\n");
    }
  } else {
    console.warn(`⚠️  Diretório de regras não encontrado: ${DIR_REGRAS}`);
  }

  _cache = partes.join("");
  return _cache;
}

export function tamanhoEstimado() {
  const c = carregarConhecimento();
  return { caracteres: c.length, tokensEstimados: Math.round(c.length / 3.5) };
}
