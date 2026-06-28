import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(repoRoot, "dist");

/** @type {{ source: string, path: string, pages: { file: string, slug?: string, title: string }[] }[]} */
const guides = [
  {
    source: "guides/Royal Caribbean Generic Guide",
    path: "royal-caribbean-generic",
    pages: [
      {
        file: "RC_Know_Before_You_Go_DG.html",
        title: "Royal Caribbean — Know Before You Go (Dazzling Getaways)",
      },
    ],
  },
  {
    source: "guides/Royal Caribbean Icon Of The Seas Guide",
    path: "royal-caribbean-icon-of-the-seas",
    pages: [
      {
        file: "Icon_of_the_Seas_Know_Before_You_Go_DG.html",
        title: "Icon of the Seas — Know Before You Go (Dazzling Getaways)",
      },
    ],
  },
  {
    source: "dowdy-travel",
    path: "dowdy-travel",
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

function renderIndexPage(title, links) {
  const items = links
    .map(
      ({ href, label }) =>
        `    <li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`
    )
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

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const siteLinks = [];

for (const guide of guides) {
  const guideLinks = [];

  for (const page of guide.pages) {
    const slug = page.slug ?? "";
    const targetDir = join(dist, guide.path, slug);
    const sourceFile = join(repoRoot, guide.source, page.file);
    const href = `/${guide.path}/${slug ? `${slug}/` : ""}`;

    if (!existsSync(sourceFile)) {
      throw new Error(`Missing source file: ${sourceFile}`);
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(sourceFile, join(targetDir, "index.html"));
    guideLinks.push({ href, label: page.title });
  }

  if (guide.pages.length > 1) {
    const guideIndex = join(dist, guide.path, "index.html");
    writeFileSync(
      guideIndex,
      renderIndexPage(`${guide.path.replaceAll("-", " ")} guides`, guideLinks)
    );
    siteLinks.push({
      href: `/${guide.path}/`,
      label: guide.path.replaceAll("-", " "),
    });
  } else {
    siteLinks.push({ href: guideLinks[0].href, label: guideLinks[0].label });
  }
}

writeFileSync(
  join(dist, "index.html"),
  renderIndexPage("Dazzling Getaways — Client Cruise Guides", siteLinks)
);

console.log("Built dist/ with the following paths:");
for (const link of siteLinks) {
  console.log(`  ${link.href}`);
}
