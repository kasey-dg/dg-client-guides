import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repoRoot, "dist");

/** @type {{ source: string, path: string, pages: { file: string, slug?: string, title: string }[] }[]} */
const guides = [
  {
    source: "guides/Royal Caribbean Generic Guide",
    path: "royal-caribbean-generic",
    group: "Cruise Guides",
    pages: [
      {
        file: "RC_Know_Before_You_Go_DG.html",
        title: "Royal Caribbean — Know Before You Go",
      },
    ],
  },
  {
    source: "guides/Royal Caribbean Icon Of The Seas Guide",
    path: "royal-caribbean-icon-of-the-seas",
    group: "Cruise Guides",
    pages: [
      {
        file: "Icon_of_the_Seas_Know_Before_You_Go_DG.html",
        title: "Icon of the Seas — Know Before You Go",
      },
    ],
  },
  {
    source: "guides/Caribbean Cruise Packing List",
    path: "caribbean-cruise-packing-list",
    group: "Packing Lists",
    pages: [
      {
        file: "DG_Caribbean_Cruise_Packing_List.html",
        title: "Caribbean Cruise Packing List",
      },
    ],
  },
  {
    source: "guides/European Trip Packing List",
    path: "european-trip-packing-list",
    group: "Packing Lists",
    pages: [
      {
        file: "DG_European_Trip_Packing_List.html",
        title: "European Trip Packing List",
      },
    ],
  },
  {
    source: "guides/Croatia Packing List",
    path: "croatia-packing-list",
    group: "Packing Lists",
    pages: [
      {
        file: "DG_Croatia_Packing_List.html",
        title: "Croatia Packing List",
      },
    ],
  },
  {
    source: "guides/Greece Packing List",
    path: "greece-packing-list",
    group: "Packing Lists",
    pages: [
      {
        file: "DG_Greece_Packing_List.html",
        title: "Greece Packing List",
      },
    ],
  },
  {
    source: "guides/London City Guide",
    path: "london-city-guide",
    group: "City Guides",
    pages: [
      {
        file: "London_City_Guide_DG.html",
        title: "London City Guide",
      },
    ],
  },
  {
    source: "guides/Sorrento Dining Guide",
    path: "sorrento-dining-guide",
    group: "Dining Guides",
    pages: [
      {
        file: "Sorrento_Dining_Guide_DG.html",
        title: "Sorrento Dining Guide",
      },
    ],
  },
  {
    source: "guides/Maui Dining Guide",
    path: "maui-dining-guide",
    group: "Dining Guides",
    pages: [
      {
        file: "Maui_Dining_Guide_DG.html",
        title: "Maui Dining Guide",
      },
    ],
  },
  {
    source: "guides/Kauai Dining Guide",
    path: "kauai-dining-guide",
    group: "Dining Guides",
    pages: [
      {
        file: "Kauai_Dining_Guide_DG.html",
        title: "Kauai Dining Guide",
      },
    ],
  },
  {
    source: "guides/Oahu Dining Guide",
    path: "oahu-dining-guide",
    group: "Dining Guides",
    pages: [
      {
        file: "Oahu_Dining_Guide_DG.html",
        title: "Oahu Dining Guide",
      },
    ],
  },
  {
    source: "guides/Big Island Dining Guide",
    path: "big-island-dining-guide",
    group: "Dining Guides",
    pages: [
      {
        file: "Big_Island_Dining_Guide_DG.html",
        title: "Big Island Dining Guide",
      },
    ],
  },
  {
    source: "guides/Paris City Guide",
    path: "paris-city-guide",
    group: "City Guides",
    pages: [
      {
        file: "Paris_City_Guide_DG.html",
        title: "Paris City Guide",
      },
    ],
  },
  {
    source: "guides/Greek Islands Dining Picks",
    path: "greek-islands-dining-picks",
    group: "Dining Guides",
    pages: [
      {
        file: "Greek_Islands_Dining_Picks_DG.html",
        title: "Greek Islands Dining Picks",
      },
    ],
  },
  {
    source: "dowdy-travel",
    path: "dowdy-travel",
    group: "Partner Guides",
    pages: [
      {
        file: "RC_Know_Before_You_Go_DT.html",
        slug: "royal-caribbean",
        title: "Royal Caribbean — Know Before You Go (Dowdy Travel)",
      },
      {
        file: "Icon_of_the_Seas_Know_Before_You_Go_DT.html",
        slug: "icon-of-the-seas",
        title: "Icon of the Seas — Know Before You Go (Dowdy Travel)",
      },
    ],
  },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderIndexPage(title, links, { showUrls = false } = {}) {
  const items = links
    .map(({ href, label }) => {
      const urlLine = showUrls
        ? `\n      <small style="color:#555">${escapeHtml(href)}</small>`
        : "";
      return `    <li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a>${urlLine}</li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 40rem;
      margin: 3rem auto;
      padding: 0 1.5rem;
      line-height: 1.5;
      color: #1a1a1a;
    }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    ul { padding-left: 1.25rem; }
    li + li { margin-top: 0.5rem; }
    a { color: #0e7883; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <ul>
${items}
  </ul>
</body>
</html>
`;
}

function renderHomePage(groups) {
  const order = ["Cruise Guides", "City Guides", "Dining Guides", "Packing Lists"];
  const sections = order
    .filter((g) => groups[g] && groups[g].length)
    .map((g) => {
      const cards = groups[g]
        .map(({ href, label }) => `      <a class="gcard" href="${escapeHtml(href)}">${escapeHtml(label.replace(/ \\(Dazzling Getaways\\)$/, ""))}</a>`)
        .join("\n");
      return `  <section>\n    <h2>${escapeHtml(g)}</h2>\n    <div class="grid">\n${cards}\n    </div>\n  </section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dazzling Getaways — Client Travel Guides</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Montserrat:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root { --teal:#0e7883; --turquoise:#9ae8dd; --coral:#ff6e67; --yellow:#ffed71; --eggshell:#f7fbea; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Montserrat', sans-serif; background: var(--eggshell); color: #1a1a1a; }
    header { background: var(--teal); text-align: center; padding: 52px 24px 60px; }
    header h1 { font-family: 'Playfair Display', serif; color: var(--yellow); font-size: 2.4rem; }
    header p { color: rgba(255,255,255,.88); font-style: italic; margin-top: 10px; }
    main { max-width: 960px; margin: 0 auto; padding: 36px 20px 80px; }
    section { margin-top: 36px; }
    h2 { font-family: 'Playfair Display', serif; color: var(--teal); font-size: 1.6rem; border-bottom: 3px solid var(--coral); padding-bottom: 6px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .gcard { display: block; background: #fff; border-top: 4px solid var(--turquoise); border-radius: 10px; padding: 16px 18px; color: #1a1a1a; text-decoration: none; font-weight: 600; box-shadow: 0 2px 16px rgba(14,120,131,.10); }
    .gcard:hover, .gcard:focus-visible { border-top-color: var(--coral); outline: none; }
    footer { text-align: center; color: #777; font-size: .85rem; padding: 0 20px 40px; }
  </style>
</head>
<body>
  <header><h1>Client Travel Guides</h1><p>Find Your Happy Place.</p></header>
  <main>
${sections}
  </main>
  <footer>Questions? Reach out to Kasey at kasey@dazzlinggetaways.com</footer>
</body>
</html>
`;
}

function pageHref(guidePath, slug) {
  return `/${guidePath}/${slug ? `${slug}/` : ""}`;
}

function publishPage(sourceFile, targetDir, pageFile) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceFile, join(targetDir, "index.html"));
  cpSync(sourceFile, join(targetDir, pageFile));
}

function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  /** @type {string[]} */
  const redirects = [];
  /** @type {{ href: string, label: string }[]} */
  const siteLinks = [];
  const groups = {};

  function addTrailingSlashRedirect(path) {
    if (!path.endsWith("/")) return;
    redirects.push(`${path.slice(0, -1)}  ${path}  301`);
  }

  for (const guide of guides) {
    const guideLinks = [];

    for (const page of guide.pages) {
      const slug = page.slug ?? "";
      const sourceFile = join(repoRoot, guide.source, page.file);
      const href = pageHref(guide.path, slug);

      if (!existsSync(sourceFile)) {
        throw new Error(`Missing source file: ${sourceFile}`);
      }

      publishPage(sourceFile, join(dist, guide.path, slug), page.file);
      addTrailingSlashRedirect(href);

      if (guide.source.startsWith("guides/")) {
        const mirrorHref = pageHref(`guides/${guide.path}`, slug);
        publishPage(sourceFile, join(dist, "guides", guide.path, slug), page.file);
        addTrailingSlashRedirect(mirrorHref);
      }

      guideLinks.push({ href, label: page.title });
    }

    if (guide.pages.length > 1) {
      const guideIndexHref = pageHref(guide.path, "");
      addTrailingSlashRedirect(guideIndexHref);
      writeFileSync(
        join(dist, guide.path, "index.html"),
        renderIndexPage(`${guide.path.replaceAll("-", " ")} guides`, guideLinks)
      );
      siteLinks.push({
        href: `/${guide.path}/`,
        label: guide.path.replaceAll("-", " "),
      });
      (groups[guide.group] ??= []).push({ href: `/${guide.path}/`, label: "Dowdy Travel guides" });
    } else {
      siteLinks.push({ href: guideLinks[0].href, label: guideLinks[0].label });
      (groups[guide.group] ??= []).push(guideLinks[0]);
    }
  }

  writeFileSync(join(dist, "index.html"), renderHomePage(groups));

  writeFileSync(join(dist, "_redirects"), `${redirects.join("\n")}\n`);

  console.log("Built dist/ with the following paths:");
  for (const link of siteLinks) {
    console.log(`  ${link.href}`);
    if (link.href.startsWith("/royal-caribbean")) {
      console.log(`  /guides${link.href}`);
    }
  }
}

build();

if (process.argv.includes("--watch")) {
  console.log("\nWatching guides/, dowdy-travel/, and scripts/build.mjs for changes…");

  let rebuildTimer;
  const scheduleRebuild = () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      console.log("\nSource changed — rebuilding dist/ …");
      try {
        build();
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
      }
    }, 150);
  };

  for (const dir of ["guides", "dowdy-travel"]) {
    watch(join(repoRoot, dir), { recursive: true }, scheduleRebuild);
  }
  watch(join(repoRoot, "scripts", "build.mjs"), scheduleRebuild);
}
