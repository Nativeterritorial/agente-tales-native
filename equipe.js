// Modo equipe: quando o Felipe ou a Pila escrevem para o WhatsApp da NATIVE, o Tales sabe quem é e
// vira assistente interno, consultando o Sistema NATIVE (resumo do dia, clientes, processos) e
// anotando na linha do tempo dos processos. Não fala com clientes por conta própria.
import Anthropic from "@anthropic-ai/sdk";

const SISTEMA_URL = (process.env.SISTEMA_URL || "https://sistema-native-production.up.railway.app").replace(/\/$/, "");
// Criado na primeira mensagem: as variáveis do .env só existem depois que o server.js as carrega.
let client = null;
const ia = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const MAX_MENSAGENS = 30;
// A equipe pede coisas com mais passos (achar arquivo, cliente, telefone): modelo mais capaz que o do atendimento.
const MODELO = () => process.env.TALES_MODELO_EQUIPE || "claude-sonnet-5-5";

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
    name: "listar_arquivos",
    description: "Lista os arquivos de um processo (guardados no Sistema e na pasta do Dropbox): matrícula, pranchas, memoriais, DWG, KML, documentos. Procure pelo número do processo, pelo nome do cliente ou pelo número da matrícula. Cada arquivo vem com uma referência (ref) para enviar.",
    input_schema: { type: "object", properties: { numero_processo: { type: "integer" }, busca: { type: "string", description: "Nome do cliente ou número da matrícula" } } },
  },
  {
    name: "enviar_arquivo",
    description: "Manda um arquivo pelo WhatsApp da NATIVE. para='mim' manda para quem está pedindo. Para outra pessoa, informe o telefone com DDD (pegue do cadastro com buscar_cliente ou do que a pessoa disse) e o nome; o envio para outra pessoa só sai depois que quem pediu confirmar com 'sim'.",
    input_schema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Referência que veio de listar_arquivos" },
        nome_arquivo: { type: "string" },
        para: { type: "string", description: "'mim' ou o telefone com DDD" },
        nome_destinatario: { type: "string" },
        legenda: { type: "string", description: "Texto curto que vai junto (opcional)" },
      },
      required: ["ref", "nome_arquivo", "para"],
    },
  },
  {
    name: "anotar_no_processo",
    description: "Registra uma anotação na linha do tempo do processo (ex.: 'liguei pro cartório, nota sai sexta'). Só use quando a pessoa pedir para anotar/registrar.",
    input_schema: { type: "object", properties: { numero: { type: "integer" }, texto: { type: "string" } }, required: ["numero", "texto"] },
  },
];

const soDigitos = (t) => String(t || "").replace(/\D/g, "");
const comDdi = (t) => { const d = soDigitos(t); return d.length === 10 || d.length === 11 ? `55${d}` : d; };
const canon = (t) => { let d = soDigitos(t); if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2); if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3); return d; };

async function executar(nome, input, quem, ctx) {
  switch (nome) {
    case "listar_arquivos": return sistema({ acao: "arquivos", numero: input.numero_processo, busca: input.busca || "" });
    case "enviar_arquivo": {
      const pediuParaOutro = input.para && !/^(mim|eu|me)$/i.test(String(input.para).trim()) && canon(input.para) !== canon(ctx.telefoneEnvio);
      if (pediuParaOutro && !ctx.telefonesPermitidos().has(canon(input.para))) {
        return { erro: "Esse telefone não veio do cadastro nem da mensagem de quem pediu. Use buscar_cliente para pegar o WhatsApp do cadastro, ou peça o número. Nunca invente número." };
      }
      const paraMim = !input.para || /^(mim|eu|me)$/i.test(String(input.para).trim()) || canon(input.para) === canon(ctx.telefoneEnvio);
      if (paraMim) return sistema({ acao: "enviar_arquivo", ref: input.ref, para: ctx.telefoneEnvio, legenda: input.legenda || "", autor: quem });
      const destino = comDdi(input.para);
      if (destino.length < 12) return { erro: "Telefone de destino inválido: peça o número com DDD." };
      const st = ctx.getEstado();
      st.envioPendente = { ref: input.ref, nome: input.nome_arquivo, para: destino, nomeDestinatario: input.nome_destinatario || null, legenda: input.legenda || "", quando: Date.now() };
      ctx.salvarEstado();
      return { aguardandoConfirmacao: true, instrucao: `Pergunte exatamente: "Confirma mandar ${input.nome_arquivo} para ${input.nome_destinatario || "o número"} (${destino})? Responda sim ou não." O envio só sai com o sim.` };
    }
    case "resumo_do_dia": return sistema({ acao: "resumo" });
    case "buscar_cliente": {
      const r = await sistema({ acao: "cliente", busca: input.nome });
      for (const p of r.encontrados || []) if (p.whatsapp) ctx.lembrarTelefone(p.whatsapp);
      return r;
    }
    case "ver_processo": return sistema({ acao: "processo", numero: input.numero });
    case "anotar_no_processo": return sistema({ acao: "anotar", numero: input.numero, texto: input.texto, autor: quem });
    default: return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

function promptEquipe(quem) {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  return `Você é o Tales, assistente interno da NATIVE Topografia & Meio Ambiente. Quem está falando com você agora é ${quem}, da equipe (sócios: Felipe Nadal, responsável técnico de georreferenciamento e topografia, e Precila Nadal, a Pila, bióloga responsável pelo ambiental). Hoje é ${hoje}.

Você ajuda a equipe pelo WhatsApp consultando o Sistema NATIVE com as ferramentas: resumo do dia, buscar cliente, ver processo, listar e enviar arquivos (matrícula, prancha, memorial, DWG, KML…) e anotar no processo. A pessoa muitas vezes está na rua ou na estrada: seja rápido e prático.

Regras:
- Responda direto, curto, em português claro, como um colega organizado. Pode usar o primeiro nome da pessoa.
- Use as ferramentas sempre que a pergunta for sobre clientes, processos, recebimentos, atrasos, prazos ou documentos. Não responda de memória: os dados mudam.
- Valores sempre em reais como vieram. Não invente número, data, nome nem situação. Se a ferramenta não trouxe, diga que não está no sistema.
- Se a busca de cliente trouxer mais de um nome parecido, liste e pergunte qual é.
- Arquivos: quando pedirem "me manda a matrícula/prancha de tal", use listar_arquivos e escolha o arquivo que melhor corresponde (a prancha mais recente, a matrícula do imóvel). Se houver mais de um candidato plausível, liste os nomes e pergunte qual. Para a própria pessoa, mande direto (para='mim') e diga o que mandou.
- Mandar para outra pessoa ("manda para o fulano", "manda pro cartório"): primeiro chame buscar_cliente para pegar o WhatsApp do cadastro, ou use o número que a pessoa escreveu. Se não houver telefone, pergunte o número. Nunca invente telefone e nunca mande para quem pediu quando o pedido era para outra pessoa. O envio para terceiros SEMPRE espera a confirmação: depois de chamar enviar_arquivo, faça a pergunta de confirmação e pare. Nunca diga que mandou antes do sim.
- Anotar no processo: só quando pedirem. Confirme o que foi anotado e em qual processo.
- Fora mandar arquivo quando pedirem, você não manda mensagem para cliente, não muda etapa, não cria proposta nem cobrança, não mexe no Dropbox e não vê o financeiro pessoal (Casa). Se pedirem isso, diga que ainda não consegue fazer pelo WhatsApp e que dá para fazer no Sistema.
- Formatação de WhatsApp: nada de markdown (** # -). Para listas, uma linha por item, sem marcador ou com "•". Negrito com um asterisco de cada lado, raramente. Sem emoji.
- Seja breve: resumo do dia em poucas linhas, destacando o que pede ação (atrasados, documentos para conferir, prazos).`;
}

/** Garante que o histórico começa numa mensagem de texto do usuário (sem tool_result solto). */
function aparar(conv) {
  while (conv.length > MAX_MENSAGENS) conv.shift();
  while (conv.length && !(conv[0].role === "user" && typeof conv[0].content === "string")) conv.shift();
}

const SIM = /^\s*(sim|s|pode|pode mandar|manda|confirmo|confirma|ok|isso|positivo)\b/i;
const NAO = /^\s*(n[aã]o|n|cancela|cancelar|para|negativo)\b/i;

/** Envio para terceiro aguardando o "sim" de quem pediu. Devolve a resposta pronta, ou null para seguir com o modelo. */
async function confirmarEnvioPendente(mensagem, quem, ctx) {
  const st = ctx.getEstado();
  const p = st.envioPendente;
  if (!p) return null;
  delete st.envioPendente;
  ctx.salvarEstado();
  if (Date.now() - p.quando > 30 * 60 * 1000) return null;
  if (NAO.test(mensagem)) return "Certo, não mandei.";
  if (!SIM.test(mensagem)) return null;
  const r = await sistema({ acao: "enviar_arquivo", ref: p.ref, para: p.para, legenda: p.legenda, autor: quem });
  return r.ok ? `Mandei ${r.enviado} para ${p.nomeDestinatario || p.para}.` : `Não consegui mandar: ${r.erro}`;
}

export async function responderEquipe({ telefone, telefoneEnvio, quem, mensagem, historico, salvarHistorico, getEstado, salvarEstado }) {
  const st0 = getEstado();
  const ctx = {
    telefoneEnvio, getEstado, salvarEstado,
    lembrarTelefone: (t) => { st0.telefonesDoCadastro = [...new Set([...(st0.telefonesDoCadastro || []), canon(t)])].slice(-30); salvarEstado(); },
    // Do cadastro (buscar_cliente) ou escritos por quem pede nesta conversa.
    telefonesPermitidos: () => {
      const conv = historico[`equipe:${telefone}`] || [];
      const escritos = conv.filter((m) => m.role === "user" && typeof m.content === "string").flatMap((m) => m.content.match(/\d[\d ().-]{8,}\d/g) || []).map(canon);
      return new Set([...(st0.telefonesDoCadastro || []), ...escritos]);
    },
  };
  const confirmado = await confirmarEnvioPendente(mensagem, quem, ctx);
  if (confirmado) {
    const conv0 = (historico[`equipe:${telefone}`] ||= []);
    // Fica no histórico que o envio foi feito pelo próprio sistema depois do sim (o modelo não viu essa etapa).
    conv0.push({ role: "user", content: mensagem }, { role: "assistant", content: `[Resposta automática do sistema à confirmação, já entregue ao usuário] ${confirmado}` });
    salvarHistorico();
    return confirmado;
  }
  const chave = `equipe:${telefone}`;
  if (!historico[chave]) historico[chave] = [];
  const conv = historico[chave];
  conv.push({ role: "user", content: mensagem });
  aparar(conv);
  let resposta = "";
  for (let iter = 0; iter < 6; iter++) {
    const r = await ia().messages.create({ model: MODELO(), max_tokens: 1500, system: promptEquipe(quem), tools: TOOLS_EQUIPE, messages: conv });
    console.log(`[equipe ${quem}] iter=${iter + 1} stop=${r.stop_reason} in=${r.usage.input_tokens} out=${r.usage.output_tokens}`);
    conv.push({ role: "assistant", content: r.content });
    if (r.stop_reason === "tool_use") {
      const resultados = [];
      for (const b of r.content) {
        if (b.type !== "tool_use") continue;
        console.log(`  → ${b.name}(${JSON.stringify(b.input)})`);
        resultados.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(await executar(b.name, b.input, quem, ctx)) });
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
