// Consulta ao Sistema NATIVE: se quem escreveu é cliente, traz a etapa dos processos, o recado da
// equipe, os documentos pendentes e os boletos em aberto (com o link). Só os dados DESTE número:
// o telefone vem do webhook, nunca do que o modelo escreve.
//
// Variáveis: SISTEMA_URL (padrão: o endereço de produção) e AGENTE_TOKEN (sem ela, usa a
// EVOLUTION_API_KEY, que o Sistema também aceita por ser o mesmo WhatsApp).

const SISTEMA_URL = (process.env.SISTEMA_URL || "https://sistema-native-production.up.railway.app").replace(/\/$/, "");
const CACHE_MS = 60 * 1000;
const cache = new Map(); // telefone → { quando, dados }

export async function consultarClienteNoSistema(telefone) {
  const chave = process.env.AGENTE_TOKEN || process.env.EVOLUTION_API_KEY;
  if (!chave || !telefone) return null;
  const guardado = cache.get(telefone);
  if (guardado && Date.now() - guardado.quando < CACHE_MS) return guardado.dados;
  try {
    const r = await fetch(`${SISTEMA_URL}/api/agente/cliente?telefone=${encodeURIComponent(telefone)}`, {
      headers: { Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      console.warn(`[${telefone}] Sistema respondeu ${r.status} na consulta do cliente`);
      return null;
    }
    const j = await r.json();
    const dados = j?.cliente ? j : null;
    cache.set(telefone, { quando: Date.now(), dados });
    return dados;
  } catch (e) {
    console.warn(`[${telefone}] Sistema fora do ar na consulta do cliente: ${e.message}`);
    return null;
  }
}

/** Texto para o contexto do Tales. Vazio se não é cliente. */
export function contextoDoSistema(d) {
  if (!d?.cliente) return "";
  const linhas = [`Este número é de cliente da NATIVE cadastrado no Sistema: ${d.cliente.nome}.`];
  for (const p of d.processos || []) {
    linhas.push(
      `Processo nº ${p.numero} (${p.titulo}): etapa atual "${p.etapa}"${p.etapaNumero ? ` (${p.etapaNumero})` : ""}${p.etapaExplica ? ` — ${p.etapaExplica.replace(/\.$/, "")}` : ""}. Última mudança de etapa: ${p.ultimaMudanca}.` +
        (p.recado ? ` Recado da equipe para o cliente: "${p.recado}".` : "") +
        (p.documentosPendentes?.length ? ` Documentos que a equipe pediu e ainda faltam: ${p.documentosPendentes.join("; ")}.` : ""),
    );
  }
  const abertas = d.cobrancasEmAberto || [];
  if (abertas.length) {
    linhas.push("Pagamentos em aberto:");
    for (const c of abertas) {
      linhas.push(`${c.referente}: ${c.valor}, ${c.atrasada ? "venceu" : "vence"} em ${c.vencimento}. ${c.link ? `Link para pagar (boleto ou Pix, serve de 2ª via): ${c.link}` : "Sem link no sistema: encaminhar ao Felipe."}`);
    }
  } else {
    linhas.push("Nenhum pagamento em aberto.");
  }
  linhas.push(`Área do cliente (acompanhar o processo, mandar documentos, baixar recibos e notas): ${d.areaDoCliente}. Entra com o CPF/CNPJ e um código que chega no WhatsApp.`);
  return linhas.join("\n");
}
