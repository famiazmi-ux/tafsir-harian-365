# Tafsir Harian 365

Satu ayat Al-Quran setiap **6:00 pagi** dan **6:00 petang** (waktu Malaysia), dipilih rawak tanpa ulangan daripada 6,236 ayat, bersama tiga tafsir:

- **Al-Mukhtasar (English)** — sentiasa ada
- **2 rawak** daripada Ibn Kathir, Al-Tabari, Al-Qurtubi, Al-Sa'di, Ibn 'Ashur

Teks tafsir dipaparkan verbatim daripada [Tafsir MCP](https://mcp.tafsir.net/mcp) (Markaz Tafsir). Teks ayat dan terjemahan Melayu (Abdullah Muhammad Basmeih) daripada Quran.com.

## Cara ia berjalan

- `.github/workflows/tafsir.yml` — GitHub Actions berjalan 06:00 & 18:00 MYT, menjalankan `scripts/fetch-ayah.mjs`, dan commit hasil ke `data/`.
- `data/order.json` — susunan rawak 6,236 ayat (dijana sekali). `data/state.json` — ayat seterusnya.
- `data/entries/*.json` — satu fail setiap sesi. `data/index.json` — senarai arkib.
- PWA (`index.html`, `app.js`, `style.css`, `sw.js`) dihoskan di GitHub Pages.

## Arahan

```bash
node scripts/serve.mjs                         # uji tempatan di http://localhost:4365
node scripts/fetch-ayah.mjs --slot petang      # tarik satu ayat secara manual
```

Jangan jalankan `scripts/init-order.mjs` semula — ia akan menukar susunan ayat.
