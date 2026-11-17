const app = document.getElementById("app");

const TAFSIR_NAMES = {
  mukhtasar_en: "Al-Mukhtasar (English)",
  katheer: "Tafsir Ibn Kathir",
  tabary: "Tafsir Al-Tabari",
  qurtubi: "Tafsir Al-Qurtubi",
  saadi: "Tafsir Al-Sa'di",
  ibn_ashur: "Tafsir Ibn 'Ashur",
};
const RTL = (s) => s !== "mukhtasar_en";
const SLOT = { pagi: "Pagi", petang: "Petang" };
const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) =>
  new Date(d + "T00:00:00+08:00").toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

async function getJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

const gtUrl = (text, rtl) =>
  `https://translate.google.com/?sl=${rtl ? "ar" : "en"}&tl=ms&op=translate&text=${encodeURIComponent(text)}`;

function partHtml(p, rtl) {
  const dir = rtl ? ' dir="rtl" lang="ar"' : ' dir="ltr" lang="en"';
  const notes = p.footnotes?.length
    ? `<details class="notes"${dir}><summary>Nota kaki (${p.footnotes.length})</summary><ol>${p.footnotes
        .map((f) => `<li>${esc(f.text)}</li>`).join("")}</ol></details>`
    : "";
  const original = `<p class="part"${dir}>${esc(p.text)}</p>${notes}`;
  if (p.ms) {
    // BM (terjemahan AI) dulu; teks asal boleh dibuka.
    return `<div class="seg"><p class="part ms" lang="ms">${esc(p.ms)}</p>
      <details class="orig"><summary>Lihat teks asal</summary>${original}</details></div>`;
  }
  return `<div class="seg">${original}
    <a class="gt" href="${gtUrl(p.text, rtl)}" target="_blank" rel="noopener">Terjemah ke BM (Google Translate) ↗</a></div>`;
}

function tafsirCard(t, i) {
  const rtl = RTL(t.source);
  const total = t.parts.length;
  return `<section class="tafsir" data-i="${i}" data-shown="1">
    <header><h2>${esc(TAFSIR_NAMES[t.source] ?? t.source)}</h2>
      <div class="attr" dir="${rtl ? "rtl" : "ltr"}">${esc(t.attribution)}</div></header>
    <div class="body">${partHtml(t.parts[0], rtl)}</div>
    ${t.parts.some((p) => p.ms) ? `<div class="ai-note">Terjemahan AI (Claude) — mungkin ada kesilapan; rujuk teks asal.</div>` : ""}
    ${total > 1 ? `<button class="more" type="button">Baca seterusnya (1/${total})</button>` : ""}
  </section>`;
}

function renderEntry(e) {
  app.innerHTML = `
    <div class="meta"><span class="pill">${SLOT[e.slot]}</span><span>${esc(fmtDate(e.date))}</span><span>Ayat ke-${e.seq} daripada 6236</span></div>
    <article class="ayah-card">
      <div class="surah">
        <h1>${esc(e.surahName)} ${e.surah}:${e.ayah}<small>${esc(e.surahMs)} · Juzuk ${e.juz ?? "-"}</small></h1>
        <span class="ar-name" lang="ar">${esc(e.surahAr)}</span>
      </div>
      <p class="ayah-ar" lang="ar">${esc(e.ayahText)} <span class="ayah-no">﴿${toArabicDigits(e.ayah)}﴾</span></p>
      <p class="ayah-ms">${esc(e.translation)}</p>
      <div class="src">${esc(e.translationSource)}</div>
      <button class="share" type="button">Kongsi ke Status WhatsApp</button>
    </article>
    ${e.tafsirs.map(tafsirCard).join("")}
    <p class="footer-src">${esc(e.tafsirSource)}</p>`;

  app.querySelector(".share").addEventListener("click", (ev) => shareStatus(e, ev.currentTarget));

  app.querySelectorAll(".tafsir .more").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".tafsir");
      const t = e.tafsirs[Number(card.dataset.i)];
      const shown = Number(card.dataset.shown);
      card.querySelector(".body").insertAdjacentHTML("beforeend", partHtml(t.parts[shown], RTL(t.source)));
      card.dataset.shown = shown + 1;
      if (shown + 1 >= t.parts.length) btn.remove();
      else btn.textContent = `Baca seterusnya (${shown + 1}/${t.parts.length})`;
    });
  });
  window.scrollTo(0, 0);
}

// ---- Kongsi ke Status WhatsApp: jana gambar 1080x1920 dan buka menu kongsi telefon ----
const PASTEL_THEMES = [
  { name: "pic", bg: ["#fde2e4", "#e2d4f0"], ink: "#4a3550", soft: "#6b5470", accent: "#b5658a" },   // merah jambu → lavender
  { name: "mint", bg: ["#d8f3e8", "#cfe8f6"], ink: "#24493f", soft: "#3f6459", accent: "#3f8f78" },  // pudina → biru langit
  { name: "peach", bg: ["#ffe5d0", "#fff3c4"], ink: "#5a3b26", soft: "#7a5a43", accent: "#c27a4a" }, // pic → kuning lembut
  { name: "lilac", bg: ["#e6e0f8", "#d6eaf8"], ink: "#352f57", soft: "#544d78", accent: "#7a6cc0" }, // lilac → biru
  { name: "sage", bg: ["#e8efd9", "#f6e7d8"], ink: "#3d4630", soft: "#5c654c", accent: "#7f8f52" },  // sage → krim
];
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Cari saiz fon terbesar (dalam had) yang muat dalam ketinggian yang diberi.
function fitText(ctx, text, font, maxSize, minSize, lineHeight, maxWidth, maxHeight) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = font(size);
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length * size * lineHeight <= maxHeight) return { size, lines };
  }
  ctx.font = font(minSize);
  return { size: minSize, lines: wrapLines(ctx, text, maxWidth) };
}

async function makeStatusImage(e) {
  await Promise.all([
    document.fonts.load('60px "Amiri Quran"'),
    document.fonts.load('40px Amiri'),
    document.fonts.load('600 40px Inter'),
    document.fonts.load('40px Inter'),
  ]);
  const W = 1080, H = 1920, PAD = 96, maxW = W - PAD * 2;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // Tema pastel bergilir ikut nombor ayat, supaya setiap status nampak berbeza.
  const T = PASTEL_THEMES[(e.seq ?? e.ayah) % PASTEL_THEMES.length];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Bulatan lembut sebagai hiasan
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath(); ctx.arc(W - 120, 160, 220, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(110, H - 170, 180, 0, Math.PI * 2); ctx.fill();
  // Kad putih lut sinar
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath(); ctx.roundRect(56, 110, W - 112, H - 220, 48); ctx.fill();
  ctx.strokeStyle = T.accent + "66"; ctx.lineWidth = 3; ctx.stroke();
  ctx.textAlign = "center";

  ctx.fillStyle = T.accent;
  ctx.font = "600 34px Inter";
  ctx.fillText("TAFSIR HARIAN 365", W / 2, 190);
  ctx.font = "64px Amiri";
  ctx.fillText(e.surahAr, W / 2, 290);

  // Ukur dulu ayat (Arab) dan terjemahan, kemudian letak di tengah ruang antara tajuk dan kaki.
  const TOP = 350, BOTTOM = H - 270, GAP = 110; // GAP = ruang pemisah antara ayat & terjemahan
  ctx.direction = "rtl";
  const ar = fitText(ctx, `${e.ayahText} ﴿${toArabicDigits(e.ayah)}﴾`, (s) => `${s}px "Amiri Quran"`, 72, 36, 1.9, maxW, 760);
  ctx.direction = "ltr";
  const arLH = ar.size * 1.9;
  const arH = ar.lines.length * arLH;

  const msMaxH = BOTTOM - TOP - arH - GAP;
  const ms = fitText(ctx, e.translation, (s) => `${s}px Inter`, 42, 24, 1.5, maxW, msMaxH);
  const msLH = ms.size * 1.5;
  const maxLines = Math.max(1, Math.floor(msMaxH / msLH));
  if (ms.lines.length > maxLines) {
    ms.lines = ms.lines.slice(0, maxLines);
    ms.lines[maxLines - 1] = ms.lines[maxLines - 1].replace(/\s+\S*$/, "") + " …";
  }
  const msH = ms.lines.length * msLH;

  let y = TOP + Math.max(0, (BOTTOM - TOP - (arH + GAP + msH)) / 2);

  // Ayat (Arab, RTL)
  ctx.direction = "rtl";
  ctx.fillStyle = T.ink;
  ctx.font = `${ar.size}px "Amiri Quran"`;
  for (const l of ar.lines) { ctx.fillText(l, W / 2, y + arLH * 0.7); y += arLH; }
  ctx.direction = "ltr";

  // Pemisah
  ctx.fillStyle = T.accent;
  ctx.fillRect(W / 2 - 60, y + GAP / 2 - 2, 120, 3);
  y += GAP;

  // Terjemahan BM
  ctx.fillStyle = T.soft;
  ctx.font = `${ms.size}px Inter`;
  for (const l of ms.lines) { ctx.fillText(l, W / 2, y + ms.size); y += msLH; }

  ctx.fillStyle = T.accent;
  ctx.font = "600 40px Inter";
  ctx.fillText(`${e.surahName} ${e.surah}:${e.ayah}`, W / 2, H - 190);
  ctx.fillStyle = T.soft + "aa";
  ctx.font = "26px Inter";
  ctx.fillText("Terjemahan: Abdullah Muhammad Basmeih", W / 2, H - 135);

  return new Promise((r) => c.toBlob(r, "image/png"));
}

async function shareStatus(e, btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Menyediakan gambar…";
  try {
    const blob = await makeStatusImage(e);
    const file = new File([blob], `tafsir-${e.surah}-${e.ayah}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      // Pelayar tanpa Web Share (cth. komputer): muat turun gambar sahaja.
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  } catch (err) {
    if (err.name !== "AbortError") { console.error(err); alert("Tak dapat berkongsi gambar."); }
  } finally {
    btn.disabled = false; btn.textContent = label;
  }
}

function renderArchive(index) {
  if (!index.length) { app.innerHTML = `<p class="muted center empty">Belum ada bacaan.</p>`; return; }
  const byDate = {};
  for (const x of index) (byDate[x.date] ??= []).push(x);
  app.innerHTML = `<div class="archive">${Object.entries(byDate).map(([d, xs]) => `
    <h3>${esc(fmtDate(d))}</h3>
    ${xs.map((x) => `<a href="#/e/${esc(x.id)}"><span><span class="slot-badge">${SLOT[x.slot]}</span>${esc(x.surahName)}</span><span>${esc(x.key)}</span></a>`).join("")}
  `).join("")}</div>
  <p class="footer-src">${index.length} daripada 6236 ayat telah dibaca</p>`;
}

async function route() {
  const h = location.hash || "#/";
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.classList.toggle("active", (a.dataset.nav === "arkib") === h.startsWith("#/arkib")));
  try {
    if (h.startsWith("#/arkib")) return renderArchive(await getJson("data/index.json"));
    const m = h.match(/^#\/e\/([\w-]+)$/);
    if (m) return renderEntry(await getJson(`data/entries/${m[1]}.json`));
    const index = await getJson("data/index.json");
    if (!index.length) { app.innerHTML = `<p class="muted center empty">Ayat pertama akan muncul pada 6:00 pagi.</p>`; return; }
    renderEntry(await getJson(`data/entries/${index[0].id}.json`));
  } catch (err) {
    app.innerHTML = `<p class="muted center empty">Tak dapat memuatkan bacaan. Semak sambungan internet dan cuba lagi.</p>`;
    console.error(err);
  }
}

window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (!document.hidden && (location.hash || "#/") === "#/") route(); });
route();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
