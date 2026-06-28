# dg-client-guides

Dazzling Getaways client cruise guides, deployed as static HTML on Netlify.

## Site paths

| Source folder | URL path |
|---|---|
| `guides/Royal Caribbean Generic Guide/` | `/royal-caribbean-generic/` |
| `guides/Royal Caribbean Icon Of The Seas Guide/` | `/royal-caribbean-icon-of-the-seas/` |
| `dowdy-travel/` | `/dowdy-travel/royal-caribbean/` and `/dowdy-travel/icon-of-the-seas/` |

The root `/` lists all guides. The `dowdy-travel` folder also has its own index at `/dowdy-travel/` because it contains two guides.

## Local preview

```bash
npm run build
npx serve dist
```

## Deploy on push to GitHub (one-time setup)

The repo is at [kasey-dg/dg-client-guides](https://github.com/kasey-dg/dg-client-guides). After you link it to Netlify once, every push to `main` triggers a new deploy automatically.

### 1. Push the Netlify config

Commit and push `netlify.toml`, `package.json`, `scripts/build.mjs`, and `.gitignore` (along with your guide files):

```bash
git add .
git commit -m "Add Netlify build config for multi-path guide deploy"
git push origin main
```

### 2. Connect Netlify to GitHub

1. Open [app.netlify.com](https://app.netlify.com) and sign in.
2. **Add new site → Import an existing project → GitHub**.
3. Authorize Netlify for GitHub if prompted.
4. Select **kasey-dg/dg-client-guides**.
5. Confirm build settings (auto-detected from `netlify.toml`):
   - **Base directory:** leave blank (repo root — not `guides`)
   - **Branch to deploy:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **Deploy site**.

> **Important:** If you previously set **Base directory** to `guides` in the Netlify UI, clear it under **Site configuration → Build & deploy → Build settings → Edit settings**. The build script and `dowdy-travel/` folder live at the repo root; a `guides` base breaks the build and publish paths.

Netlify installs nothing extra — the build uses Node (bundled on Netlify) to run `scripts/build.mjs`. No environment variables are required.

### 3. Done — deploys are automatic

After the first deploy succeeds, Netlify watches `main`. Each `git push` starts a new build and updates the live site when it finishes. Check progress under **Deploys** in the Netlify dashboard.

**Deploy previews:** Pull requests against `main` get their own preview URLs automatically.

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
