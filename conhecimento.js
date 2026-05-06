// Carrega base de conhecimento (geo + ambiental) como system prompt cacheado
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_GEO = process.env.CONHECIMENTO_DIR || path.join(__dirname, "conhecimento", "regras");
const DIR_AMB = path.join(__dirname, "conhecimento", "regras-ambiental");

let _cache = null;

function carregarDiretorio(dir, titulo, intro) {
  const partes = [];
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Diretório não encontrado: ${dir}`);
    return "";
  }
  partes.push(`# ${titulo}\n`);
  partes.push(intro + "\n\n---\n\n");
  const arquivos = fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort();
  for (const arq of arquivos) {
    partes.push(fs.readFileSync(path.join(dir, arq), "utf8"));
    partes.push("\n\n---\n\n");
  }
  return partes.join("");
}

export function carregarConhecimento() {
  if (_cache) return _cache;
  const geo = carregarDiretorio(
    DIR_GEO,
    "BASE DE CONHECIMENTO — Georreferenciamento de Imóveis Rurais (INCRA/SIGEF)",
    "Você é especialista em georreferenciamento, com domínio sobre Norma Técnica 3ª Edição do INCRA, Lei 6.015/73, Lei 10.267/01 e os erros mais comuns do SIGEF. Use as regras abaixo (extraídas de curso especializado) para fundamentar análises técnicas, identificar pendências e orientar leads."
  );
  const amb = carregarDiretorio(
    DIR_AMB,
    "BASE DE CONHECIMENTO — Licenciamento Ambiental no RS (CONSEMA 372/2018 e atualizações)",
    "Você também conhece a regulamentação ambiental do Rio Grande do Sul, especialmente a Resolução CONSEMA 372/2018 (compilada) e suas alterações posteriores (511/2024, 516/2024, 518/2024, 520/2024, 524/2025, 527/2025, 534/2025, 543/2026, 544/2026, 549/2026). Use essas resoluções para identificar quando uma atividade precisa de licenciamento ambiental, qual tipo de licença (LP/LI/LO/LU/LAC), competência (estadual ou municipal), e CODRAM aplicável. Para corte/supressão de vegetação, transplante vegetal e defesa de multas, oriente o lead com base nas regras gerais e sempre indique transferência pra Precila quando o caso exigir análise específica."
  );
  _cache = geo + "\n\n" + amb;
  return _cache;
}

export function tamanhoEstimado() {
  const c = carregarConhecimento();
  return { caracteres: c.length, tokensEstimados: Math.round(c.length / 3.5) };
}
