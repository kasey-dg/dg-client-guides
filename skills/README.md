# Agent skills (dg-client-guides)

Two-role system for producing and maintaining Dazzling Getaways client cruise guides. Skills live here so any tool (Claude Code, Cursor, claude.ai, etc.) can load them directly.

**Repo:** https://github.com/kasey-dg/dg-client-guides  
**Production:** https://dg-guides.netlify.app/

## How to load a skill

Point your tool at the relevant `SKILL.md` as a system prompt or persona file. No special integration required.

## Hierarchy

```
Studio Director  (L0 — human-facing)
      │
Product Owner    (L1 — orchestrator)
      │
   ┌──┴──┐
content  engineering
 (L2)     (L2)
```

## Skills

| Role | File | Use when |
|------|------|----------|
| **studio-director** | [studio-director/SKILL.md](studio-director/SKILL.md) | Starting any new guide, checking status, scoping work |
| **product-owner** | [product-owner/SKILL.md](product-owner/SKILL.md) | Internal routing, story writing, acceptance validation |

## Disciplines (L2)

| Discipline | Owns |
|---|---|
| **content** | PDF extraction, HTML guide copy, structure, packing lists, accuracy |
| **engineering** | `scripts/build.mjs`, guide registration, Netlify config, deployment |

## Backlog

Stories live in [`backlog/stories.json`](../backlog/stories.json).

Story ID prefix: `DG-NNN`

## Adding a new guide — quick path

1. Studio Director takes the brief (PDF or verbal description).
2. Product Owner writes stories and routes: content first, then engineering to register in `build.mjs`.
3. Content produces the HTML file in `guides/<folder>/`.
4. Engineering adds the entry to `scripts/build.mjs` and verifies `npm run build` passes.
5. Push to `main` → Netlify deploys.
