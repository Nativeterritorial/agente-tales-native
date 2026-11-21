// Áudio do WhatsApp em texto. Baixa o áudio pela Evolution (getBase64FromMediaMessage) e transcreve
// com Whisper. Serviço, pela variável que existir no ambiente:
//   GROQ_API_KEY   → Groq (padrão; modelo GROQ_MODELO_AUDIO, padrão whisper-large-v3-turbo)
//   OPENAI_API_KEY → OpenAI (modelo OPENAI_MODELO_AUDIO, padrão gpt-4o-mini-transcribe)
// Sem nenhuma das duas, o Tales pede para escrever.

function servico() {
  if (process.env.GROQ_API_KEY) {
    return { nome: "Groq", url: "https://api.groq.com/openai/v1/audio/transcriptions", chave: process.env.GROQ_API_KEY, modelo: process.env.GROQ_MODELO_AUDIO || "whisper-large-v3-turbo" };
  }
  if (process.env.OPENAI_API_KEY) {
    return { nome: "OpenAI", url: "https://api.openai.com/v1/audio/transcriptions", chave: process.env.OPENAI_API_KEY, modelo: process.env.OPENAI_MODELO_AUDIO || "gpt-4o-mini-transcribe" };
  }
  return null;
}

export const audioLigado = () => Boolean(servico());

async function baixarAudio(key) {
  const base = (process.env.EVOLUTION_BASE_URL || "").replace(/\/$/, "");
  const r = await fetch(`${base}/chat/getBase64FromMediaMessage/${process.env.EVOLUTION_INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY },
    body: JSON.stringify({ message: { key }, convertToMp4: false }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Evolution não entregou o áudio (${r.status})`);
  const j = await r.json();
  if (!j.base64) throw new Error("Evolution respondeu sem o áudio");
  return { dados: Buffer.from(j.base64, "base64"), mime: (j.mimetype || "audio/ogg").split(";")[0] };
}

/** Texto do áudio, ou null se não deu (o motivo vai para o log). */
export async function transcreverAudio(key, telefone) {
  const sv = servico();
  if (!sv || !key?.id) return null;
  try {
    const { dados, mime } = await baixarAudio(key);
    const form = new FormData();
    form.append("file", new Blob([dados], { type: mime }), mime.includes("mp4") ? "audio.m4a" : mime.includes("mpeg") ? "audio.mp3" : "audio.ogg");
    form.append("model", sv.modelo);
    form.append("language", "pt");
    const r = await fetch(sv.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${sv.chave}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`${sv.nome} respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const texto = String((await r.json()).text || "").trim();
    console.log(`[${telefone}] áudio transcrito: ${texto.slice(0, 120)}`);
    return texto || null;
  } catch (e) {
    console.warn(`[${telefone}] não consegui transcrever o áudio: ${e.message}`);
    return null;
  }
}
