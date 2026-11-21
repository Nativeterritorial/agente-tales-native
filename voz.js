// Resposta em áudio (mensagem de voz) para a equipe. Texto → voz no ElevenLabs → WhatsApp pela Evolution
// (sendWhatsAppAudio, que entrega como áudio gravado). Só funciona com ELEVENLABS_API_KEY no ambiente.
// Voz: ELEVENLABS_VOZ (padrão: a voz "Tales" criada na conta da NATIVE — Porto Alegre, arrastada).
// Modelo: ELEVENLABS_MODELO (padrão eleven_v4, o mesmo usado no teste da voz; eleven_flash_v2_5 é mais barato).

export const vozLigada = () => Boolean(process.env.ELEVENLABS_API_KEY);

/** Pedido de resposta em áudio na mensagem ("me responde por áudio", "manda em áudio", "fala comigo"). */
export function pediuAudio(texto) {
  const t = String(texto || "").toLowerCase();
  return /(por|em|num|no|de)\s+[aá]udio|manda\s+(um\s+)?[aá]udio|responde\s.*[aá]udio|me\s+fala\s+em\s+voz|em\s+voz\s+alta/.test(t);
}

/** Tira o que não se lê em voz alta: negrito, marcadores, links. */
function paraFala(texto) {
  return String(texto)
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_~`]/g, "")
    .replace(/^\s*[•-]\s*/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 2500);
}

/** Gera a voz e manda como áudio. Devolve true se foi; false (com motivo no log) para cair no texto. */
export async function responderEmAudio(telefone, texto) {
  if (!vozLigada()) return false;
  const fala = paraFala(texto);
  if (!fala) return false;
  try {
    const voz = process.env.ELEVENLABS_VOZ || "gKvws1YX3m9Z1RSlS1SS";
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: fala, model_id: process.env.ELEVENLABS_MODELO || "eleven_v4" }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`ElevenLabs respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const audio = Buffer.from(await r.arrayBuffer()).toString("base64");
    const base = (process.env.EVOLUTION_BASE_URL || "").replace(/\/$/, "");
    const e = await fetch(`${base}/message/sendWhatsAppAudio/${process.env.EVOLUTION_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY },
      body: JSON.stringify({ number: String(telefone).replace(/\D/g, ""), audio }),
      signal: AbortSignal.timeout(60000),
    });
    if (!e.ok) throw new Error(`Evolution recusou o áudio (${e.status}): ${(await e.text()).slice(0, 200)}`);
    console.log(`[${telefone}] resposta mandada em áudio (${fala.length} caracteres)`);
    return true;
  } catch (err) {
    console.warn(`[${telefone}] não deu para responder em áudio: ${err.message}`);
    return false;
  }
}
