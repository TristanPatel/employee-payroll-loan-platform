# Richmond Loan Platform showreel

A 25-second motion-graphics promo for the Employee Payroll Loan Platform. It's built with
[Remotion](https://www.remotion.dev) and renders in three formats from a single timeline:

| Composition | Size | Output |
| --- | --- | --- |
| `Vertical` | 1080×1920 (9:16) | `renders/showreel-9x16.mp4` |
| `Square` | 1080×1080 (1:1) | `renders/showreel-1x1.mp4` |
| `Wide` | 1920×1080 (16:9) | `renders/showreel-16x9.mp4` |

This folder is **not** part of the pnpm workspace. It has its own npm lockfile and is listed in the
root `.dockerignore`, so it never touches CI or the Fly image.

## The one rule: real UI only

Every product pixel in the video is a crop or frame of a real Playwright screenshot of the app.
Nothing is redrawn. The cursor, captions, kinetic type, the clock ring and transitions are motion
graphics laid over the real captures. `public/ASSETS.md` lists every captured file and where it came from.

One network response is stubbed. The capture answers the sign-in "send code" request with a success
response, so the app's own code moves to its real code-entry screen without a live Supabase. The
email address and code shown are made up.

## Story (30 fps, 750 frames, 120 BPM, so one beat is 15 frames)

`public/timeline.json` is the single source of truth. The audio generator and the video both read it,
so every cut, click and tick lands on the same frame grid.

| Time | Beat |
| --- | --- |
| 0–3 s | Hook: "Why queue for a loan?", one word per beat |
| 3–7 s | The real landing page assembles piece by piece, then the camera pushes into the calculator |
| 7–10 s | Live loan quote: a real slider drag, with 18 frames the app recalculated |
| 10–13 s | The access code is typed one character per 16th note |
| 13–16 s | Sign-in with an emailed code: request, code screen, verify |
| 16–20 s | "10 minutes to apply, without visiting a branch" |
| 20–25 s | Logo lockup, staffloans.richmond-afri.com, "Apply in 10 minutes" |

## Requirements

- Node 22.
- Python 3 with `numpy`, `scipy` and `pillow`, for the audio and the contact sheet.
- To recapture only: a production build of `apps/web` running locally, plus the repo's
  Playwright install, which the web app's e2e tests already use.

## Commands

Run these from `marketing/showreel/`.

```bash
npm ci
npm run audio          # synthesize public/audio/master.wav (music + UI sfx, deterministic)
npm run studio         # preview in Remotion Studio
npm run contact-sheet  # one frame per beat → renders/contact-sheet-*.png
npm run render:all     # 9:16, then 1:1, then 16:9 → renders/*.mp4
```

The audio WAVs and everything in `renders/` are gitignored. Run `npm run audio` before the first
render, because the video's soundtrack is `public/audio/master.wav`.

### Recapturing the UI

The captures in `public/screens`, `public/sequences` and `public/boxes.json` came from the
`claude/employer-confidential-entry` branch at commit 666b090. To refresh them after UI changes:

```bash
# from the repo root: build and start the web app (public pages need no database)
NEXT_PUBLIC_SUPABASE_URL=https://slmrpvlhttgrhoinpfwa.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder pnpm -C apps/web build
NEXT_PUBLIC_SUPABASE_URL=https://slmrpvlhttgrhoinpfwa.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder pnpm -C apps/web start

# then, from marketing/showreel/
npm run capture
```

Environment overrides:

| Variable | Purpose |
| --- | --- |
| `CAPTURE_BASE_URL` | The app's origin. Defaults to `http://localhost:3000`. |
| `PW_CHROMIUM` | Path to a Chromium for capture. Defaults to Playwright's own browser. |
| `REMOTION_BROWSER_EXECUTABLE` | Path to Chrome or chrome-headless-shell for rendering. Defaults to Remotion's download. |

The logo crops in `public/logo/` were split from `apps/web/public/richmond-logo.png`, cutting the
crimson dove from the grey wordmark. The font is the Inter variable woff2 from the Next.js build output.

After a recapture, check that the cursor targets in `src/scenes/Features.tsx` still line up. The
calculator, join and sign-in positions come from `public/boxes.json` plus a few measured offsets.
