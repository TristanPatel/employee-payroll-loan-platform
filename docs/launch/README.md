# Launch / rollout documents

Markdown sources for the staff-facing rollout pack. Each runs through
`scripts/build-docs.mjs` to produce Richmond-branded HTML (always) and PDF
(when Playwright's Chromium is installed) in `docs/launch/dist/`.

## Files

| Source | Purpose |
|---|---|
| `staff-introduction-email.md` | Project sponsor's announcement email to all staff. Send the day before kick-off. |
| `staff-handbook-v1.md` | Standing reference for every role. Distribute as PDF. |
| `_template/document.css` | Brand stylesheet (Richmond crimson #8b1e24, Lato body, page footer). |

## Build

```sh
pnpm install            # once
pnpm exec playwright install chromium   # once — pulls Chromium for PDF rendering
pnpm run build:docs     # writes HTML + PDF to docs/launch/dist/
```

If Chromium is not installed, the build still produces `.html` (open in a
browser and use **Print → Save as PDF** for a one-click branded PDF).

`dist/` is `.gitignore`d — each build is reproducible from the Markdown
sources; no binaries are committed.

## Tweaking the brand

All brand styling lives in `_template/document.css`. Logo is read from
`apps/web/public/richmond-logo.png` and embedded as base64 in the cover.
Footer rule (page number + confidential strap) is set in
`scripts/build-docs.mjs` via Playwright's `footerTemplate`.
