// Terjemah tafsir ke Bahasa Melayu guna Claude Code CLI (langganan Pro, CLAUDE_CODE_OAUTH_TOKEN).
// Hanya 3 bahagian pertama bagi setiap tafsir. Entri yang tertinggal diterjemah pada larian seterusnya.
// Guna: node scripts/translate.mjs [--max-entries 3]
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const MAX_PARTS = 3;
const SEP = "<<<BAHAGIAN>>>";
const MODEL = process.env.TRANSLATE_MODEL ?? "sonnet";
const CLAUDE = process.env.CLAUDE_BIN ?? "claude";
const args = process.argv.slice(2);
const MAX_ENTRIES = Number(args[args.indexOf("--max-entries") + 1] || 3);

const SYSTEM = `Anda penterjemah teks tafsir Al-Quran ke Bahasa Melayu (Malaysia), tulisan rumi.
Peraturan:
- Terjemahan PENUH dan setia. Jangan ringkaskan, jangan tambah ulasan, nota atau pendapat sendiri.
- Petikan ayat Al-Quran dalam teks: kekalkan teks Arabnya seperti asal, kemudian beri maksudnya dalam kurungan.
- Nama dan istilah: guna ejaan lazim Malaysia (Allah SWT, Nabi Muhammad SAW, sahabat RA, Ibn Abbas, hadis, sanad).
- Kekalkan penanda nota kaki seperti [1], [2] di tempatnya. Jangan terjemah atau tambah nota kaki.
- Input mungkin mengandungi beberapa bahagian yang dipisahkan oleh baris "${SEP}". Keluarkan bilangan bahagian yang SAMA, dipisahkan oleh baris "${SEP}" yang sama, mengikut susunan.
- Keluarkan terjemahan sahaja, tanpa pendahuluan atau penutup.`;

function runClaude(input) {
  return new Promise((resolve, reject) => {
    const p = spawn(CLAUDE, [
      "-p", "Terjemahkan teks tafsir di bawah mengikut peraturan.",
      "--model", MODEL,
      "--system-prompt", SYSTEM,
      "--tools", "",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--setting-sources", "",
    ], { stdio: ["pipe", "pipe", "pipe"], shell: process.platform === "win32" });
    let out = "", err = "";
    const timer = setTimeout(() => { p.kill(); reject(new Error("claude: tamat masa")); }, 10 * 60 * 1000);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => { clearTimeout(timer); reject(e); });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`claude keluar ${code}: ${(err || out).slice(0, 500)}`));
      else resolve(out.trim());
    });
    p.stdin.end(input);
  });
}

async function translateTafsir(t) {
  const todo = t.parts.slice(0, MAX_PARTS).map((p, i) => ({ p, i })).filter(({ p }) => !p.ms);
  if (!todo.length) return false;
  const out = await runClaude(todo.map(({ p }) => p.text).join(`\n${SEP}\n`));
  const pieces = out.split(SEP).map((s) => s.trim()).filter(Boolean);
  if (pieces.length !== todo.length) throw new Error(`${t.source}: jangka ${todo.length} bahagian, dapat ${pieces.length}`);
  todo.forEach(({ p }, k) => { p.ms = pieces[k]; });
  return true;
}

const needsWork = (e) => e.tafsirs.some((t) => t.parts.slice(0, MAX_PARTS).some((p) => !p.ms));

async function main() {
  const index = JSON.parse(await readFile(path.join(DATA, "index.json"), "utf8"));
  let done = 0, failed = 0;
  for (const item of index) {
    if (done >= MAX_ENTRIES) break;
    const file = path.join(DATA, "entries", `${item.id}.json`);
    const e = JSON.parse(await readFile(file, "utf8"));
    if (!needsWork(e)) continue;
    done++;
    for (const t of e.tafsirs) {
      try {
        if (await translateTafsir(t)) {
          e.msSource = "Terjemahan AI (Claude) — mungkin ada kesilapan; rujuk teks asal.";
          await writeFile(file, JSON.stringify(e, null, 1) + "\n"); // simpan selepas setiap tafsir
          console.log(`OK ${item.id} ${t.source}`);
        }
      } catch (err) {
        failed++;
        console.error(`GAGAL ${item.id} ${t.source}: ${err.message}`);
        // Kuota habis atau token tidak sah: berhenti, cuba lagi larian seterusnya.
        if (/limit|quota|auth|401|403|token/i.test(err.message)) { process.exitCode = 1; return; }
      }
    }
  }
  console.log(`Selesai: ${done} entri diproses, ${failed} kegagalan.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
