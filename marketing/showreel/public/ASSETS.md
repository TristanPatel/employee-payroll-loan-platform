# Richmond Loan Platform showreel: asset inventory

Everything here was captured from the real app, which was built from source and run locally.
The branch was `claude/employer-confidential-entry` at commit 666b090, served by `next start` on localhost:3000.
The live host and Supabase could not be reached from the capture environment, so the app ran locally.
Captures used headless Chromium driven by Playwright.
None of the product UI has been redrawn.

## Brand
| Item | Value | Source |
| --- | --- | --- |
| Primary crimson | #8b1e24 | packages/ui/src/tokens.ts |
| Primary dark / light | #701820 / #a8252c | tokens.ts |
| Accent (near-black) | #0f1117 | tokens.ts |
| Surfaces | #faf9f7 base, #ffffff raised, #f3f1ed muted | tokens.ts |
| Ink | #0f172a base, #64748b muted | tokens.ts |
| Dove, measured from the logo | #972326 | logo PNG pixels |
| Wordmark grey, measured from the logo | #646563 | logo PNG pixels |
| Font | Inter variable 100–900, latin subset | `fonts/Inter-latin-variable.woff2`, taken from the Next build |

## Logo (`logo/`)
- **The official mark** is `richmond-logo.png` at 2048×1447, from apps/web/public, originally from richmond-afri.com.
- **A tight crop** of it is `richmond-logo-tight.png`.
- **The dove alone** is `richmond-dove.png`, split from the real PNG by colour so it can animate separately.
- **The wordmark alone** is `richmond-wordmark.png`, the RICHMOND serif letters split the same way.

## Screens (`screens/`)
Phone captures are 390×844 at 3× scale. Desktop captures are 1440×900 at 2× scale.
- **Landing page:** the above-the-fold view, the full page, the header, the hero headline, the calculator card, the trust strip and the desktop Apply button.
- **Join page:** the full page and the access-code card.
- **Sign-in page:** the full page and the form card.

## Real-action sequences (`sequences/`)
Each frame is a fresh screenshot after a real input event. Every frame is checked by hash to be different from the others.
- **calculator, 18 frames.** The amount slider moves from K1,000 to K9,500 in K500 steps. The app recomputes the monthly payment, cash received, total and affordability in every frame. The range stops at the app's own affordability edge, because K10,000 on a K8,000 salary shows "Too high".
- **join, 11 frames.** The sample code 7K2P9QR4TX is typed one character per frame into the real access-code field.
- **signin, 4 frames.** The sequence switches to the emailed-code option, types an email, taps "Email me a code", then types a 6-digit code into the code screen that appears.
  - Supabase is unreachable here. Playwright answered only the single send-code request with a success response. The app's own code then switched to its real code-entry screen.
  - The sample email and code are illustrative. No real person's data is used.

## Geometry
- `boxes.json` and the `brand.json` file record the real bounding boxes in CSS pixels. These include the sliders, the code input, the Continue button, the email field and the "Email me a code" button. The cursor path follows them.

## Out of scope
- Signed-in admin and portal screens need the live database, so they are not used.
