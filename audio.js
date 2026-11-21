// Áudio do WhatsApp em texto. Baixa o áudio pela Evolution (getBase64FromMediaMessage) e transcreve
// na OpenAI. Só funciona com OPENAI_API_KEY no ambiente; sem ela, o Tales pede para escrever.
// Modelo: OPENAI_MODELO_AUDIO (padrão gpt-4o-mini-transcribe; "whisper-1" também serve).

export const audioLigado = () => Boolean(process.env.OPENAI_API_KEY);

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
  if (!audioLigado() || !key?.id) return null;
  try {
    const { dados, mime } = await baixarAudio(key);
    const form = new FormData();
    form.append("file", new Blob([dados], { type: mime }), mime.includes("mp4") ? "audio.m4a" : mime.includes("mpeg") ? "audio.mp3" : "audio.ogg");
    form.append("model", process.env.OPENAI_MODELO_AUDIO || "gpt-4o-mini-transcribe");
    form.append("language", "pt");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`OpenAI respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const texto = String((await r.json()).text || "").trim();
    console.log(`[${telefone}] áudio transcrito: ${texto.slice(0, 120)}`);
    return texto || null;
  } catch (e) {
    console.warn(`[${telefone}] não consegui transcrever o áudio: ${e.message}`);
    return null;
  }
}
