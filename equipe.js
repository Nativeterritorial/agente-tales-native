// Modo equipe: quando o Felipe ou a Pila escrevem para o WhatsApp da NATIVE, o Tales sabe quem é e
// vira assistente interno, consultando o Sistema NATIVE (resumo do dia, clientes, processos) e
// anotando na linha do tempo dos processos. Não fala com clientes por conta própria.
import Anthropic from "@anthropic-ai/sdk";

const SISTEMA_URL = (process.env.SISTEMA_URL || "https://sistema-native-production.up.railway.app").replace(/\/$/, "");
// Criado na primeira mensagem: as variáveis do .env só existem depois que o server.js as carrega.
let client = null;
const ia = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const MAX_MENSAGENS = 30;

async function sistema(corpo) {
  const chave = process.env.AGENTE_TOKEN || process.env.EVOLUTION_API_KEY;
  try {
    const r = await fetch(`${SISTEMA_URL}/api/agente/equipe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { erro: `O Sistema respondeu ${r.status}.` };
    return await r.json();
  } catch (e) {
    return { erro: `Sistema fora do ar (${e.message}).` };
  }
}

export const TOOLS_EQUIPE = [
  {
    name: "resumo_do_dia",
    description: "Resumo da NATIVE agora: recebido e despesas no mês, total a receber, parcelas atrasadas, o que vence nos próximos 7 dias, documentos de clientes para conferir, prazos e processos que precisam de atenção, propostas aguardando resposta.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "buscar_cliente",
    description: "Procura cliente ou pessoa pelo nome (ou parte do nome) e traz contato, cidade, processos com a etapa, propostas e parcelas (pagas, em aberto, atrasadas).",
    input_schema: { type: "object", properties: { nome: { type: "string", description: "Nome ou parte do nome, ao menos 3 letras" } }, required: ["nome"] },
  },
  {
    name: "ver_processo",
    description: "Detalhe de um processo pelo número: cliente, situação, recado ao cliente, protocolo, pasta no Dropbox, documentos pedidos ao cliente e últimos eventos da linha do tempo.",
    input_schema: { type: "object", properties: { numero: { type: "integer" } }, required: ["numero"] },
  },
  {
    name: "anotar_no_processo",
    description: "Registra uma anotação na linha do tempo do processo (ex.: 'liguei pro cartório, nota sai sexta'). Só use quando a pessoa pedir para anotar/registrar.",
    input_schema: { type: "object", properties: { numero: { type: "integer" }, texto: { type: "string" } }, required: ["numero", "texto"] },
  },
];

async function executar(nome, input, quem) {
  switch (nome) {
    case "resumo_do_dia": return sistema({ acao: "resumo" });
    case "buscar_cliente": return sistema({ acao: "cliente", busca: input.nome });
    case "ver_processo": return sistema({ acao: "processo", numero: input.numero });
    case "anotar_no_processo": return sistema({ acao: "anotar", numero: input.numero, texto: input.texto, autor: quem });
    default: return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

function promptEquipe(quem) {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  return `Você é o Tales, assistente interno da NATIVE Topografia & Meio Ambiente. Quem está falando com você agora é ${quem}, da equipe (sócios: Felipe Nadal, responsável técnico de georreferenciamento e topografia, e Precila Nadal, a Pila, bióloga responsável pelo ambiental). Hoje é ${hoje}.

Você ajuda a equipe pelo WhatsApp consultando o Sistema NATIVE com as ferramentas: resumo do dia, buscar cliente, ver processo e anotar no processo.

Regras:
- Responda direto, curto, em português claro, como um colega organizado. Pode usar o primeiro nome da pessoa.
- Use as ferramentas sempre que a pergunta for sobre clientes, processos, recebimentos, atrasos, prazos ou documentos. Não responda de memória: os dados mudam.
- Valores sempre em reais como vieram. Não invente número, data, nome nem situação. Se a ferramenta não trouxe, diga que não está no sistema.
- Se a busca de cliente trouxer mais de um nome parecido, liste e pergunte qual é.
- Anotar no processo: só quando pedirem. Confirme o que foi anotado e em qual processo.
- Você não manda mensagem para cliente, não muda etapa, não cria proposta nem cobrança, não mexe no Dropbox e não vê o financeiro pessoal (Casa). Se pedirem isso, diga que ainda não consegue fazer pelo WhatsApp e que dá para fazer no Sistema.
- Formatação de WhatsApp: nada de markdown (** # -). Para listas, uma linha por item, sem marcador ou com "•". Negrito com um asterisco de cada lado, raramente. Sem emoji.
- Seja breve: resumo do dia em poucas linhas, destacando o que pede ação (atrasados, documentos para conferir, prazos).`;
}

/** Garante que o histórico começa numa mensagem de texto do usuário (sem tool_result solto). */
function aparar(conv) {
  while (conv.length > MAX_MENSAGENS) conv.shift();
  while (conv.length && !(conv[0].role === "user" && typeof conv[0].content === "string")) conv.shift();
}

export async function responderEquipe({ telefone, quem, mensagem, historico, salvarHistorico }) {
  const chave = `equipe:${telefone}`;
  if (!historico[chave]) historico[chave] = [];
  const conv = historico[chave];
  conv.push({ role: "user", content: mensagem });
  aparar(conv);
  let resposta = "";
  for (let iter = 0; iter < 6; iter++) {
    const r = await ia().messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 1500, system: promptEquipe(quem), tools: TOOLS_EQUIPE, messages: conv });
    console.log(`[equipe ${quem}] iter=${iter + 1} stop=${r.stop_reason} in=${r.usage.input_tokens} out=${r.usage.output_tokens}`);
    conv.push({ role: "assistant", content: r.content });
    if (r.stop_reason === "tool_use") {
      const resultados = [];
      for (const b of r.content) {
        if (b.type !== "tool_use") continue;
        console.log(`  → ${b.name}(${JSON.stringify(b.input)})`);
        resultados.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(await executar(b.name, b.input, quem)) });
      }
      conv.push({ role: "user", content: resultados });
      continue;
    }
    resposta = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    break;
  }
  salvarHistorico();
  return resposta;
}
