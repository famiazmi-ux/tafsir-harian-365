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

function partHtml(p, rtl) {
  const dir = rtl ? ' dir="rtl" lang="ar"' : ' dir="ltr" lang="en"';
  const notes = p.footnotes?.length
    ? `<details class="notes"${dir}><summary>Nota kaki (${p.footnotes.length})</summary><ol>${p.footnotes
        .map((f) => `<li>${esc(f.text)}</li>`).join("")}</ol></details>`
    : "";
  return `<p class="part"${dir}>${esc(p.text)}</p>${notes}`;
}

function tafsirCard(t, i) {
  const rtl = RTL(t.source);
  const total = t.parts.length;
  return `<section class="tafsir" data-i="${i}" data-shown="1">
    <header><h2>${esc(TAFSIR_NAMES[t.source] ?? t.source)}</h2>
      <div class="attr" dir="${rtl ? "rtl" : "ltr"}">${esc(t.attribution)}</div></header>
    <div class="body">${partHtml(t.parts[0], rtl)}</div>
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

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#123f31"); g.addColorStop(1, "#0b241c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(214,170,92,.45)"; ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.textAlign = "center";

  ctx.fillStyle = "#d6aa5c";
  ctx.font = "600 34px Inter";
  ctx.fillText("TAFSIR HARIAN 365", W / 2, 190);
  ctx.font = "64px Amiri";
  ctx.fillText(e.surahAr, W / 2, 290);

  // Ayat (Arab, RTL)
  ctx.direction = "rtl";
  ctx.fillStyle = "#f6efe0";
  const ar = fitText(ctx, `${e.ayahText} ﴿${toArabicDigits(e.ayah)}﴾`, (s) => `${s}px "Amiri Quran"`, 72, 36, 1.9, maxW, 760);
  const arLH = ar.size * 1.9;
  let y = 400 + arLH * 0.7;
  ctx.font = `${ar.size}px "Amiri Quran"`;
  for (const l of ar.lines) { ctx.fillText(l, W / 2, y); y += arLH; }
  ctx.direction = "ltr";

  // Pemisah
  y += 20;
  ctx.fillStyle = "#d6aa5c";
  ctx.fillRect(W / 2 - 60, y, 120, 3);
  y += 70;

  // Terjemahan BM
  ctx.fillStyle = "#e4dccb";
  const msMaxH = H - y - 300;
  const ms = fitText(ctx, e.translation, (s) => `${s}px Inter`, 42, 24, 1.5, maxW, msMaxH);
  const msLH = ms.size * 1.5;
  const maxLines = Math.floor(msMaxH / msLH);
  if (ms.lines.length > maxLines) {
    ms.lines = ms.lines.slice(0, maxLines);
    ms.lines[maxLines - 1] = ms.lines[maxLines - 1].replace(/\s+\S*$/, "") + " …";
  }
  ctx.font = `${ms.size}px Inter`;
  y += ms.size;
  for (const l of ms.lines) { ctx.fillText(l, W / 2, y); y += msLH; }

  ctx.fillStyle = "#d6aa5c";
  ctx.font = "600 40px Inter";
  ctx.fillText(`${e.surahName} ${e.surah}:${e.ayah}`, W / 2, H - 190);
  ctx.fillStyle = "rgba(228,220,203,.6)";
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
