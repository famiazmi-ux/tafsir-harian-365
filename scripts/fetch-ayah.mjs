// Tarik satu ayat rawak (tanpa ulangan) + 3 tafsir, simpan sebagai JSON untuk PWA.
// Guna: node scripts/fetch-ayah.mjs [--slot pagi|petang] [--date YYYY-MM-DD]
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const MCP_URL = "https://mcp.tafsir.net/mcp";
const MALAY_TRANSLATION_ID = 39; // Abdullah Muhammad Basmeih (Quran.com)

// Al-Mukhtasar (EN) sentiasa ada; 2 lagi dipilih rawak daripada senarai Arab ini.
const ALWAYS = "mukhtasar_en";
const ARABIC_POOL = ["katheer", "tabary", "qurtubi", "saadi", "ibn_ashur"];
const MAX_PARTS = 40; // had keselamatan untuk tafsir yang sangat panjang

// Cuba semula sehingga ~30 minit jika server gagal (Q15).
const ATTEMPTS = Number(process.env.FETCH_ATTEMPTS ?? 6);
const RETRY_WAIT_MS = Number(process.env.FETCH_RETRY_WAIT_MS ?? 5 * 60 * 1000);

const readJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return fallback; }
};
const writeJson = (p, v) => writeFile(p, JSON.stringify(v, null, 1) + "\n");
const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  // Waktu Malaysia = UTC+8
  const myt = new Date(Date.now() + 8 * 3600 * 1000);
  const date = get("--date") ?? myt.toISOString().slice(0, 10);
  const slot = get("--slot") ?? (myt.getUTCHours() < 12 ? "pagi" : "petang");
  if (!["pagi", "petang"].includes(slot)) throw new Error(`slot tidak sah: ${slot}`);
  return { date, slot };
}

async function mcp(name, args) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  if (!res.ok) throw new Error(`MCP ${name} HTTP ${res.status}`);
  const body = await res.text();
  const line = body.split("\n").find((l) => l.startsWith("data: "));
  const msg = JSON.parse(line ? line.slice(6) : body);
  if (msg.error) throw new Error(`MCP ${name}: ${msg.error.message}`);
  if (msg.result?.isError) throw new Error(`MCP ${name}: ${msg.result.content?.[0]?.text}`);
  return JSON.parse(msg.result.content[0].text);
}

async function fetchTafsir(surah, ayah, source) {
  const parts = [];
  let attribution = "";
  for (let part = 1; part <= MAX_PARTS; part++) {
    const r = await mcp("fetch_tafsir", { surah, ayah, sources: [source], part });
    const t = r.tafsirs?.[0];
    if (!t || !t.text) break;
    attribution = t.attribution;
    parts.push({
      text: t.text.trim(),
      footnotes: (t.footnotes ?? []).filter((f) => f.text).map((f) => ({ marker: f.marker, text: f.text })),
    });
    if (!t.has_more) break;
  }
  if (!parts.length) throw new Error(`Tiada tafsir ${source} untuk ${surah}:${ayah}`);
  return { source, attribution, parts };
}

async function fetchQuranCom(key) {
  const url = `https://api.quran.com/api/v4/verses/by_key/${key}?fields=text_uthmani&translations=${MALAY_TRANSLATION_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Quran.com HTTP ${res.status}`);
  const v = (await res.json()).verse;
  const tr = v.translations?.[0]?.text ?? "";
  return {
    uthmani: v.text_uthmani,
    translation: tr.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim(),
    juz: v.juz_number,
    page: v.page_number,
  };
}

function pickTwo(pool) {
  const p = [...pool];
  const out = [];
  while (out.length < 2) out.push(p.splice(randomInt(p.length), 1)[0]);
  return out;
}

async function buildEntry(surah, ayah, surahs) {
  const key = `${surah}:${ayah}`;
  const sources = [ALWAYS, ...pickTwo(ARABIC_POOL)];
  const [mcpAyah, qc, ...tafsirs] = await Promise.all([
    mcp("fetch_ayah", { surah, ayah }),
    fetchQuranCom(key),
    ...sources.map((s) => fetchTafsir(surah, ayah, s)),
  ]);
  const s = surahs[surah - 1];
  return {
    key, surah, ayah,
    surahName: s.name, surahAr: s.ar, surahMs: s.ms,
    ayahText: qc.uthmani || mcpAyah.text_uthmani,
    translation: qc.translation,
    translationSource: "Terjemahan Abdullah Muhammad Basmeih (melalui Quran.com)",
    juz: qc.juz,
    tafsirs,
    tafsirSource: "Tafsir MCP — Markaz Tafsir li al-Dirasat al-Qur'aniyyah (mcp.tafsir.net)",
  };
}

async function main() {
  const { date, slot } = parseArgs();
  const id = `${date}-${slot}`;
  const entryPath = path.join(DATA, "entries", `${id}.json`);
  if (await exists(entryPath)) { console.log(`Sudah ada: ${id}, tiada apa dibuat.`); return; }

  const surahs = await readJson(path.join(DATA, "surahs.json"));
  const order = await readJson(path.join(DATA, "order.json"));
  const state = await readJson(path.join(DATA, "state.json"), { next: 0 });
  if (!order) throw new Error("data/order.json tiada — jalankan scripts/init-order.mjs dulu");
  if (state.next >= order.length) { console.log("Alhamdulillah, semua 6236 ayat sudah dibaca."); return; }

  const [surah, ayah] = order[state.next].split(":").map(Number);
  let entry, lastErr;
  for (let i = 1; i <= ATTEMPTS; i++) {
    try { entry = await buildEntry(surah, ayah, surahs); break; }
    catch (e) {
      lastErr = e;
      console.error(`Cubaan ${i}/${ATTEMPTS} gagal: ${e.message}`);
      if (i < ATTEMPTS) await sleep(RETRY_WAIT_MS);
    }
  }
  // Gagal: jangan majukan state, ayat ini akan dicuba pada slot seterusnya.
  if (!entry) throw lastErr;

  entry.id = id; entry.date = date; entry.slot = slot; entry.seq = state.next + 1;
  await mkdir(path.dirname(entryPath), { recursive: true });
  await writeJson(entryPath, entry);

  const index = await readJson(path.join(DATA, "index.json"), []);
  index.unshift({ id, date, slot, key: entry.key, surahName: entry.surahName, seq: entry.seq });
  await writeJson(path.join(DATA, "index.json"), index);
  await writeJson(path.join(DATA, "state.json"), { next: state.next + 1, updated: new Date().toISOString() });
  console.log(`OK ${id}: ${entry.surahName} ${entry.key} — ${entry.tafsirs.map((t) => `${t.source}(${t.parts.length})`).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
