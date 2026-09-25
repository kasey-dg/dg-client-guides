// Inlines the shared area explorer (scripts/area-explorer) into each destination guide.
// Guides stay single self-contained HTML files. Re-run after editing area.js, area.css or places/*.json:
//   node scripts/add-area-explorer.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "scripts", "area-explorer");

const GUIDES = {
  "guides/London City Guide/London_City_Guide_DG.html": "london",
  "guides/Paris City Guide/Paris_City_Guide_DG.html": "paris",
  "guides/Sorrento Dining Guide/Sorrento_Dining_Guide_DG.html": "sorrento",
  "guides/Maui Dining Guide/Maui_Dining_Guide_DG.html": "maui",
  "guides/Kauai Dining Guide/Kauai_Dining_Guide_DG.html": "kauai",
  "guides/Oahu Dining Guide/Oahu_Dining_Guide_DG.html": "oahu",
  "guides/Big Island Dining Guide/Big_Island_Dining_Guide_DG.html": "big-island",
  "guides/Greek Islands Dining Picks/Greek_Islands_Dining_Picks_DG.html": "greek-islands",
};

const css = readFileSync(join(src, "area.css"), "utf8") + readFileSync(join(src, "reviews.css"), "utf8");
const js = readFileSync(join(src, "area.js"), "utf8") + "\n" + readFileSync(join(src, "reviews.js"), "utf8");

for (const [file, key] of Object.entries(GUIDES)) {
  const path = join(root, file);
  let html = readFileSync(path, "utf8");
  const cfg = JSON.parse(readFileSync(join(src, "places", key + ".json"), "utf8"));

  // remove any previous injection (and the original London-only version)
  html = html.replace(/\n?<style id="area-explorer-css">[\s\S]*?<\/style>/, "");
  html = html.replace(/\n?<!-- area-explorer:start -->[\s\S]*?<!-- area-explorer:end -->/, "");
  html = html.replace(/\/\* ── Explore-this-area feature[\s\S]*?(?=<\/style>)/, "");
  html = html.replace(/<script>\s*\(function \(\) \{\s*"use strict";\s*\/\/ Where each place in the guide is[\s\S]*?<\/script>\n?/, "");

  const head = `<style id="area-explorer-css">\n${css}</style>\n`;
  const body =
    `<!-- area-explorer:start -->\n<script>window.DG_AREA = ${JSON.stringify(cfg)};</script>\n` +
    `<script>\n${js}</script>\n<!-- area-explorer:end -->\n`;
  html = html.replace(/<\/head>/i, head + "</head>");
  const i = html.lastIndexOf("</body>");
  html = html.slice(0, i) + body + html.slice(i);
  writeFileSync(path, html);
  console.log(`${key}: ${Object.keys(cfg.places).length} places`);
}
