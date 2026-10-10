"""One-frame-per-beat contact sheets from renders/stills (run `npm run stills:all` first).

Writes renders/contact-sheet-9x16.png and renders/contact-sheet-1x1-16x9.png.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, 'public', 'timeline.json')))
STILLS = os.path.join(ROOT, 'renders', 'stills')
OUT = os.path.join(ROOT, 'renders')

BEATS = [
    ('1 · Hook', '"Why queue for a loan?"', 'hook'),
    ('2 · UI assembles', 'real crops fly in, push to calculator', 'assemble'),
    ('3a · Feature', 'live loan quote, real slider drag', 'calc'),
    ('3b · Feature', 'access code typed on 16ths', 'join'),
    ('3c · Feature', 'emailed code sign-in', 'signin'),
    ('4 · Number', '10 minutes, no branch', 'number'),
    ('5 · Lockup + CTA', 'staffloans.richmond-afri.com', 'lockup'),
]


def font(size, bold=False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:
        return ImageFont.truetype(f'/usr/share/fonts/truetype/dejavu/{name}', size)
    except OSError:
        return ImageFont.load_default()


def still(comp, frame):
    return Image.open(os.path.join(STILLS, f'{comp}-{frame:03d}.png')).convert('RGB')


gap, top, w, h = 24, 120, 420, 747
sheet = Image.new('RGB', (gap + len(BEATS) * (w + gap), top + h + 110), (15, 17, 23))
d = ImageDraw.Draw(sheet)
d.text((gap, 30), 'Richmond Loan Platform · 25 s showreel · 9:16 contact sheet (one frame per beat)', font=font(40, True), fill='white')
for i, (title, sub, key) in enumerate(BEATS):
    fr = TL['contactFrames'][key]
    x = gap + i * (w + gap)
    sheet.paste(still('Vertical', fr).resize((w, h), Image.LANCZOS), (x, top))
    d.text((x, top + h + 16), title, font=font(26, True), fill=(168, 37, 44))
    d.text((x, top + h + 50), f'{fr / TL["fps"]:.1f}s · frame {fr}', font=font(20), fill=(200, 200, 200))
    d.text((x, top + h + 76), sub, font=font(20), fill=(150, 150, 150))
sheet.save(os.path.join(OUT, 'contact-sheet-9x16.png'))

rows = []
for comp, (cw, ch), label in [('Square', (300, 300), '1:1'), ('Wide', (400, 225), '16:9')]:
    row = Image.new('RGB', (gap + len(BEATS) * (cw + gap), ch + 60), (15, 17, 23))
    ImageDraw.Draw(row).text((gap, 10), f'{comp} ({label}) · same frames', font=font(26, True), fill='white')
    for i, (_, _, key) in enumerate(BEATS):
        row.paste(still(comp, TL['contactFrames'][key]).resize((cw, ch), Image.LANCZOS), (gap + i * (cw + gap), 48))
    rows.append(row)
both = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows) + 20), (15, 17, 23))
y = 10
for r in rows:
    both.paste(r, (0, y))
    y += r.height
both.save(os.path.join(OUT, 'contact-sheet-1x1-16x9.png'))
print('wrote', os.path.join(OUT, 'contact-sheet-9x16.png'), 'and contact-sheet-1x1-16x9.png')
