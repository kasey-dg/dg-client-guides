# dg-client-guides

Dazzling Getaways client cruise guides, deployed as static HTML on Netlify.

## Site paths

| Source folder | URL path |
|---|---|
| `guides/Royal Caribbean Generic Guide/` | `/royal-caribbean-generic/` |
| `guides/Royal Caribbean Icon Of The Seas Guide/` | `/royal-caribbean-icon-of-the-seas/` |
| `dowdy-travel/` | `/dowdy-travel/royal-caribbean/` and `/dowdy-travel/icon-of-the-seas/` |

The root `/` lists all guides. The `dowdy-travel` folder also has its own index at `/dowdy-travel/` because it contains two guides.

## Direct share links (Dazzling Getaways)

Send clients straight to a guide — no need to visit the site home page first:

| Guide | Direct URL |
|---|---|
| Royal Caribbean (generic) | `https://dg-guides.netlify.app/royal-caribbean-generic/` |
| Icon of the Seas | `https://dg-guides.netlify.app/royal-caribbean-icon-of-the-seas/` |

These paths also work without a trailing slash (Netlify redirects automatically). Each guide is also available by filename, e.g. `/royal-caribbean-generic/RC_Know_Before_You_Go_DG.html`.

Repo-aligned mirrors live under `/guides/royal-caribbean-generic/` and `/guides/royal-caribbean-icon-of-the-seas/`.

## Local preview

Rebuild and serve in one step — `dist/` updates automatically when you edit files in `guides/` or `dowdy-travel/`:

```bash
npm install
npm run dev
```

One-off build (also what Netlify runs on deploy):

```bash
npm run build
```

Watch only (if you already have a static server running):

```bash
npm run watch
```

## Deploy on push to GitHub (one-time setup)

The repo is at [kasey-dg/dg-client-guides](https://github.com/kasey-dg/dg-client-guides). Production deploys go to [dg-guides.netlify.app](https://dg-guides.netlify.app/).

### How deploy works

1. Push to `main` triggers `.github/workflows/deploy-netlify.yml`.
2. GitHub Actions runs `node scripts/build.mjs` to generate a fresh `dist/` from the HTML in `guides/` and `dowdy-travel/`.
3. The workflow uploads that built `dist/` to Netlify.

`dist/` is gitignored and never committed — only the built output from CI goes live.

> **Do not rely on GitHub Pages for this site.** The repo also has GitHub Pages enabled, which runs Jekyll on the raw repo and does not run our build script. Disable it under **Settings → Pages → Build and deployment → Source: None** if you only want Netlify.

### 1. Add Netlify secrets to GitHub (one time)

In [Netlify user settings → Applications → Personal access tokens](https://app.netlify.com/user/applications#personal-access-tokens), create a token.

Find the site ID under **Site configuration → General → Site details → Site ID** for `dg-guides`.

In GitHub: **kasey-dg/dg-client-guides → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
| `NETLIFY_SITE_ID` | Site ID for `dg-guides` |

### 2. Connect Netlify to GitHub (optional fallback)

Netlify can also build on push if linked to the repo. If you use this, confirm:

1. Open [app.netlify.com](https://app.netlify.com) and sign in.
2. Select the **dg-guides** site.
3. Under **Site configuration → Build & deploy → Build settings**:
   - **Base directory:** leave blank (repo root — **not** `guides`)
   - **Branch to deploy:** `main`
   - **Build command:** `node scripts/build.mjs`
   - **Publish directory:** `dist`

> **Important:** If **Base directory** is set to `guides`, Netlify builds fail (no `package.json` or `scripts/` there) and the live site stays on the last successful deploy — which is why changes can look missing after you push.

The GitHub Actions workflow above is the reliable path: it builds `dist/` in CI and uploads it directly.

### 3. Push to deploy

```bash
git push origin main
```

Check **Actions** in GitHub for the deploy workflow, then verify the live site.

## Adding a new guide

Edit `scripts/build.mjs` and add an entry to the `guides` array:

```js
{
  source: "guides/My New Guide Folder",
  path: "my-new-guide",           // URL path (use lowercase and hyphens)
  pages: [
    {
      file: "guide.html",         // HTML file inside the source folder
      slug: "optional-subpath",   // omit for single-page folders
      title: "Human-readable title",
    },
  ],
},
```

Then run `npm run build` locally to verify before pushing.

## Area explorer (tap a place, see what's nearby on a map)

City and dining guides let clients tap a place name to see the other picks nearby on a map. The shared code and each guide's pin locations live in `scripts/area-explorer/` (`area.js`, `area.css`, `places/<guide>.json`). After editing any of those, re-inline them into the guides with:

```
node scripts/add-area-explorer.mjs
```

To add the feature to a new guide, create `places/<guide>.json` and add the guide to the list at the top of `scripts/add-area-explorer.mjs`.

### Ratings & reviews (free setup)

- **Every located card** gets free "Read reviews on Tripadvisor / Google Maps" links (search links, no API or cost). Set `city` per guide (or per place) in `places/<guide>.json` to steer the search; add `gid` (Google place id) or `taUrl` (exact Tripadvisor page) to a place to link straight to its listing.
- **"Ratings & reviews" drawer:** accolades (`accolades`: `label`, `year`, `source`, `url`) and client quotes (`quotes`: `text`, `who`, `when`) from the places file, plus live Google rating and up to 5 reviews when `GOOGLE_PLACES_API_KEY` is set in Netlify.
- **Staying free:** Google gives 1,000 free lookups a month. `netlify/functions/reviews.mjs` counts lookups in Netlify Blobs and stops at 30 a day / 950 a month (override with `GOOGLE_DAILY_CAP` / `GOOGLE_MONTHLY_CAP`). Past the cap, or if the counter can't be read, the drawer shows the free links instead. Google results are never cached (Google's terms).
- **Paid options, off by default:** `TRIPADVISOR_API_KEY` enables Tripadvisor in the drawer (Tripadvisor's Terra plan bills per place). `INLINE_SOURCES` (e.g. `google`) adds a star line to every card, which uses a lookup per card viewed.
