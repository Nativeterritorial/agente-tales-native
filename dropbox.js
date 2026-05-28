// Wrapper simples da API Dropbox v2
const TOKEN = process.env.DROPBOX_TOKEN;
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const APP_KEY = process.env.DROPBOX_APP_KEY;
const APP_SECRET = process.env.DROPBOX_APP_SECRET;

let _accessToken = TOKEN;
let _expiresAt = 0;

async function getAccessToken() {
  if (REFRESH_TOKEN && APP_KEY && APP_SECRET) {
    if (Date.now() < _expiresAt - 60_000) return _accessToken;
    const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: REFRESH_TOKEN,
        client_id: APP_KEY,
        client_secret: APP_SECRET,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Dropbox refresh falhou: ${JSON.stringify(j)}`);
    _accessToken = j.access_token;
    _expiresAt = Date.now() + (j.expires_in || 14400) * 1000;
    return _accessToken;
  }
  if (!TOKEN) throw new Error("DROPBOX_TOKEN não configurado");
  return TOKEN;
}

async function dbxRpc(endpoint, body) {
  const token = await getAccessToken();
  const r = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Dropbox ${endpoint} ${r.status}: ${txt}`);
  return txt ? JSON.parse(txt) : {};
}

export async function criarPastaSeNaoExiste(path) {
  try {
    await dbxRpc("files/create_folder_v2", { path, autorename: false });
    console.log(`[dropbox] criou pasta: ${path}`);
  } catch (e) {
    const msg = String(e.message);
    if (msg.includes("path/conflict") || msg.includes("conflict/folder") || msg.includes('"folder"')) {
      // já existe — ok
      return;
    }
    console.error(`[dropbox] erro criando ${path}: ${msg}`);
    throw e;
  }
}

export async function uploadArquivo(path, buffer) {
  // Tenta upload; em caso de 401 (token expirado), invalida cache e tenta de novo
  const attempt = async () => {
    const token = await getAccessToken();
    const r = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ path, mode: "add", autorename: true, mute: false }),
      },
      body: buffer,
    });
    return { r, txt: await r.text() };
  };
  let { r, txt } = await attempt();
  if (r.status === 401) {
    console.warn(`[dropbox] 401 — invalidando token e tentando de novo`);
    _expiresAt = 0; // força refresh no próximo getAccessToken
    ({ r, txt } = await attempt());
  }
  if (!r.ok) throw new Error(`Dropbox upload ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

export async function listarPasta(path) {
  return dbxRpc("files/list_folder", { path, recursive: false });
}

export function slugCliente(nome) {
  return (nome || "sem-nome")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
}

export function rootPorServico(servico) {
  const s = (servico || "").toLowerCase();
  if (s.includes("geo")) return "/NATIVE TOPOGRAFIA/GEORREFERENCIAMENTO";
  if (s.includes("topo") || s.includes("levantamento") || s.includes("loteamento")) return "/NATIVE TOPOGRAFIA/LEVANTAMENTOS";
  if (s.includes("amb") || s.includes("licenc") || s.includes("car") || s.includes("multa") || s.includes("vege")) return "/NATIVE MEIO AMBIENTE";
  return "/NATIVE TOPOGRAFIA/Tales-Inbox";
}

export function pastasProcesso(rootServico, slug, ano = new Date().getFullYear()) {
  const base = `${rootServico}/${ano}-${slug}`;
  return {
    base,
    docsCliente: `${base}/docs-cliente`,
    levantamento: `${base}/levantamento`,
    escritorio: `${base}/escritorio`,
    entregas: `${base}/entregas`,
  };
}

export async function garantirPastasProcesso(rootServico, slug) {
  const p = pastasProcesso(rootServico, slug);
  await criarPastaSeNaoExiste(p.base);
  await criarPastaSeNaoExiste(p.docsCliente);
  await criarPastaSeNaoExiste(p.levantamento);
  await criarPastaSeNaoExiste(p.escritorio);
  await criarPastaSeNaoExiste(p.entregas);
  return p;
}
