// Jana susunan rawak sekali sahaja untuk semua 6236 ayat (rawak tanpa ulangan).
// Jangan jalankan semula selepas apps bermula — ia akan menukar susunan.
import { readFile, writeFile, access } from "node:fs/promises";
import { randomInt } from "node:crypto";

const out = new URL("../data/order.json", import.meta.url);
if (await access(out).then(() => true, () => false) && !process.argv.includes("--force")) {
  console.error("data/order.json sudah wujud. Guna --force jika benar-benar mahu jana semula.");
  process.exit(1);
}
const surahs = JSON.parse(await readFile(new URL("../data/surahs.json", import.meta.url), "utf8"));
const keys = surahs.flatMap((s) => Array.from({ length: s.ayat }, (_, i) => `${s.n}:${i + 1}`));
for (let i = keys.length - 1; i > 0; i--) { const j = randomInt(i + 1); [keys[i], keys[j]] = [keys[j], keys[i]]; }
await writeFile(out, JSON.stringify(keys) + "\n");
await writeFile(new URL("../data/state.json", import.meta.url), JSON.stringify({ next: 0 }) + "\n");
console.log(`order.json: ${keys.length} ayat, unik: ${new Set(keys).size}`);
