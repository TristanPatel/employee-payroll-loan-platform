"""Original 120 BPM synth-pop score + UI sound effects, synthesized from scratch in numpy.

Reads ../timeline.json so every hit lands on the same frame grid the video uses.
Writes music.wav, sfx.wav, sfx/*.wav (one-shots) and master.wav (48 kHz, 16-bit stereo).
"""
import json, wave, os
import numpy as np
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, '..', 'timeline.json')))
SR = 48000
FPS = TL['fps']
DUR = TL['durationInFrames'] / FPS            # 25.0 s
BEAT = 60.0 / TL['bpm']                       # 0.5 s
N = int(round(DUR * SR))
rng = np.random.default_rng(7)

def f2s(frame):  # frame -> seconds
    return frame / FPS

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)

def polyblep_saw(freq, n, phase0=0.0):
    t = np.arange(n)
    dt = freq / SR
    p = (phase0 + t * dt) % 1.0
    y = 2 * p - 1
    m = p < dt
    tt = p[m] / dt
    y[m] -= tt + tt - tt * tt - 1
    m = p > 1 - dt
    tt = (p[m] - 1) / dt
    y[m] -= tt * tt + tt + tt + 1
    return y

def env_adsr(n, a, d, s, r, hold):
    """attack/decay/release in seconds; hold = note length in seconds."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 0.0)
    dec = (t >= a) & (t < a + d)
    e[dec] = 1 - (1 - s) * (t[dec] - a) / max(d, 1e-6)
    sus = (t >= a + d) & (t < hold)
    e[sus] = s
    rel = t >= hold
    e[rel] = s * np.exp(-(t[rel] - hold) / max(r, 1e-6))
    return e

class Bus:
    def __init__(self):
        self.L = np.zeros(N)
        self.R = np.zeros(N)

    def add(self, x, at, gain=1.0, pan=0.0):
        i = int(round(at * SR))
        if i >= N or i + len(x) <= 0:
            return
        if i < 0:
            x = x[-i:]
            i = 0
        x = x[: N - i]
        gl = gain * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
        gr = gain * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        self.L[i:i + len(x)] += x * gl
        self.R[i:i + len(x)] += x * gr

    def add_st(self, l, r, at, gain=1.0):
        i = int(round(at * SR))
        l = l[: max(0, N - i)]
        r = r[: max(0, N - i)]
        self.L[i:i + len(l)] += l * gain
        self.R[i:i + len(r)] += r * gain

# ───────────────────────────── instruments ─────────────────────────────
def kick(big=False):
    n = int(SR * (0.9 if big else 0.42))
    t = np.arange(n) / SR
    f = 44 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (3.2 if big else 7.5))
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * 1.6) * 0.95

def clap():
    n = int(SR * 0.32)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 3200)
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        m = t >= off
        e[m] += np.exp(-(t[m] - off) * 180) * (0.8 if k < 2 else 1.0)
    e += np.exp(-t * 16) * 0.55 * (t > 0.022)
    return noise * e * 0.9

def hat(open_=False):
    n = int(SR * (0.22 if open_ else 0.06))
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7500, 4)
    return x * np.exp(-t * (14 if open_ else 70)) * 0.5

def crash():
    n = int(SR * 2.2)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 4200, 2) + 0.3 * bp(rng.standard_normal(n), 2500, 9000)
    return lp(x, 9500) * np.exp(-t * 2.2) * 0.45

def sub_boom():
    n = int(SR * 1.8)
    t = np.arange(n) / SR
    f = 32 + 60 * np.exp(-t * 6)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.8) * 2.0) * 0.9

def riser(length):
    n = int(SR * length)
    t = np.arange(n) / SR
    u = t / length
    x = rng.standard_normal(n)
    # sweep the band upward in chunks
    out = np.zeros(n)
    chunks = 40
    for c in range(chunks):
        a, b = c * n // chunks, (c + 1) * n // chunks
        fc = 300 * (40 ** (c / chunks))
        out[a:b] = bp(x[max(0, a - 2000):b], fc * 0.7, fc * 1.4)[-(b - a):]
    tone = polyblep_saw(1, n) * 0  # placeholder for clarity
    f = 110 * (8 ** u)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.08
    return (out * 0.6 + lp(tone, 3000)) * (u ** 2.2)

def saw_voice(m, length, detune=(-0.07, 0.0, 0.07), cutoff=2500, a=0.005, d=0.15, s=0.6, r=0.12):
    n = int(SR * (length + r * 5))
    y = np.zeros(n)
    for dc in detune:
        y += polyblep_saw(mtof(m + dc), n, rng.random())
    y /= len(detune)
    y = lp(y, cutoff)
    return y * env_adsr(n, a, d, s, r, length)

def pluck(m, length, cutoff):
    n = int(SR * (length + 0.25))
    t = np.arange(n) / SR
    y = 0.6 * polyblep_saw(mtof(m), n) + 0.4 * np.sign(np.sin(2 * np.pi * mtof(m + 12.04) * t))
    # filter envelope: bright transient, closing quickly
    bright = lp(y, cutoff)
    dark = lp(y, cutoff * 0.25)
    fe = np.exp(-t * 18)
    y = bright * fe + dark * (1 - fe)
    return y * np.exp(-t * 7.5) * (t < length + 0.2)

def bass_note(m, length):
    n = int(SR * (length + 0.06))
    t = np.arange(n) / SR
    y = polyblep_saw(mtof(m), n) * 0.7 + np.sin(2 * np.pi * mtof(m - 12) * t) * 0.6
    fe = np.exp(-t * 14)
    y = lp(y, 300 + 1500 * fe.mean()) * 0.6 + lp(y, 2200) * 0.4 * fe
    return np.tanh(y * 1.4) * env_adsr(n, 0.003, 0.08, 0.75, 0.03, length)

def bell(f0, length=1.2):
    n = int(SR * length)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t * dcy)
            for a, r, dcy in [(1, 1, 3.2), (0.5, 2.01, 5), (0.3, 3.0, 7), (0.18, 4.17, 9)])
    return y * 0.35

# ───────────────────────────── arrangement ─────────────────────────────
music = Bus()
bars = int(np.ceil(DUR / (4 * BEAT)))
# Am  F  C  G — classic driving minor-pop loop (one chord per bar)
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]

def section_of(beat):
    for s in TL['sections']:
        if s['from'] <= beat * TL['framesPerBeat'] < s['to']:
            return s['id']
    return 'end'

FINAL_BEAT = 46   # frame 690: last chord hit, then ring out
total_beats = int(DUR / BEAT)
kick_times = []

for b in range(total_beats):
    t0 = b * BEAT
    sec = section_of(b)
    chord_root, chord = CHORDS[(b // 4) % 4]
    groove = sec in ('assemble', 'calc', 'join', 'signin') or (sec == 'lockup' and b < FINAL_BEAT)
    if sec == 'hook':
        if b in (0, 1, 2, 3):
            music.add(kick(), t0, 0.9); kick_times.append(t0)
            music.add(bass_note(chord_root - 24, 0.22), t0, 0.55)
        if b == 2:
            music.add(kick() * 0.6, t0 + BEAT / 2, 0.8); kick_times.append(t0 + BEAT / 2)
    if groove:
        music.add(kick(), t0, 0.95); kick_times.append(t0)
        if b % 2 == 1:
            music.add(clap(), t0, 0.7, pan=0.05)
        for s16 in range(4):
            music.add(hat(open_=(s16 == 2)), t0 + s16 * BEAT / 4, 0.17 if s16 % 2 else 0.11,
                      pan=0.35 if s16 % 2 else -0.25)
        # bass: driving 8ths, octave hop on the off-beat
        for e8 in range(2):
            music.add(bass_note(chord_root - 24 + (12 if e8 == 1 else 0), BEAT / 2 * 0.85), t0 + e8 * BEAT / 2, 0.5)
    if sec in ('assemble', 'calc', 'join', 'signin', 'number') or (sec == 'lockup' and b < FINAL_BEAT):
        # 16th arp up through the chord, ping-ponged
        tones = chord + [chord[0] + 12]
        cutoff = 900 if sec == 'number' else (4200 if sec in ('calc', 'join', 'signin', 'lockup') else 2800)
        for s16 in range(4):
            note = tones[(b * 4 + s16) % 4] + 12
            music.add(pluck(note, BEAT / 4, cutoff), t0 + s16 * BEAT / 4, 0.16 if sec != 'number' else 0.2,
                      pan=-0.55 if s16 % 2 == 0 else 0.55)
    if sec == 'number' and b % 2 == 0:
        music.add(kick() * 0.35, t0, 0.6)  # heartbeat thump under the count

# pads: one per bar, whole progression, swells in the breakdown
for bar in range(bars):
    t0 = bar * 4 * BEAT
    root, chord = CHORDS[bar % 4]
    for m in chord:
        l = saw_voice(m - 12, 4 * BEAT, detune=(-0.11, 0.0, 0.09), cutoff=1600, a=0.25, d=0.4, s=0.8, r=0.35)
        r = saw_voice(m - 12, 4 * BEAT, detune=(-0.08, 0.02, 0.12), cutoff=1600, a=0.25, d=0.4, s=0.8, r=0.35)
        music.add_st(l, r, t0, 0.075)

# breakdown swell under the number beat: wide pad that opens up into the drop
nb0, nb1 = f2s(TL['number']['countFrom']), f2s(TL['lockup']['impact'])
for k, (root, chord) in enumerate([CHORDS[0], CHORDS[1]]):
    for m in chord + [chord[0] + 12]:
        ln = (nb1 - nb0) / 2
        l = saw_voice(m - 12, ln, detune=(-0.14, -0.04, 0.06, 0.15), cutoff=900 + 1400 * k, a=0.35, d=0.5, s=0.9, r=0.3)
        r = saw_voice(m - 12, ln, detune=(-0.12, 0.03, 0.08, 0.13), cutoff=900 + 1400 * k, a=0.35, d=0.5, s=0.9, r=0.3)
        music.add_st(l, r, nb0 + k * ln, 0.11)

# final chord: big Am stab ringing out
fin = f2s(FINAL_BEAT * TL['framesPerBeat'])
for m in [45, 57, 60, 64, 69]:
    l = saw_voice(m, 3.0, cutoff=2600, a=0.003, d=1.2, s=0.35, r=0.9)
    r = saw_voice(m + 0.05, 3.0, cutoff=2600, a=0.003, d=1.2, s=0.35, r=0.9)
    music.add_st(l, r, fin, 0.09)
music.add(kick(big=True), fin, 0.9); kick_times.append(fin)
music.add(crash(), fin, 0.28)
music.add(sub_boom(), fin, 0.6)

# hook slam + risers + impacts
music.add(sub_boom(), f2s(TL['hook']['slam']), 0.9)
music.add(crash(), f2s(TL['hook']['slam']), 0.18)
music.add(riser(1.0), f2s(TL['assemble']['pieces'][0]['at']) - 1.0, 0.7)
music.add(riser(1.0), f2s(TL['lockup']['impact']) - 1.0, 0.9)
# snare roll into the lockup drop
for k in range(16):
    tt = f2s(TL['lockup']['impact']) - 2 * BEAT + k * BEAT / 8
    music.add(clap(), tt, 0.15 + 0.5 * k / 16, pan=0.1 * ((-1) ** k))
for at in (TL['assemble']['pieces'][0]['at'], TL['lockup']['impact']):
    music.add(crash(), f2s(at), 0.3)
    music.add(sub_boom(), f2s(at), 0.75)
    music.add(kick(big=True), f2s(at), 0.6)

# sidechain pump on pads/bass/arp (applied to the whole music bus minus kicks is overkill;
# a gentle global pump keyed to kick times gives the synth-pop breathing)
tt = np.arange(N) / SR
duck = np.ones(N)
for k in kick_times:
    m = (tt >= k) & (tt < k + BEAT)
    duck[m] = np.minimum(duck[m], 1 - 0.35 * np.exp(-(tt[m] - k) / 0.09))
# don't duck the transient itself: re-add a fraction of the dry kick energy via the pre-duck sum
music.L *= duck
music.R *= duck

# ───────────────────────────── UI sound effects ─────────────────────────────
def sfx_click():
    n = int(SR * 0.05); t = np.arange(n) / SR
    blip = np.sin(2 * np.pi * 2000 * t) * np.exp(-t * 120)
    tick = hp(rng.standard_normal(n), 3000) * np.exp(-t * 900)
    return (blip * 0.6 + tick * 0.5) * 0.9

def sfx_tick():
    n = int(SR * 0.02); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 3600 * t) * np.exp(-t * 300) * 0.5 + hp(rng.standard_normal(n), 5000) * np.exp(-t * 1200) * 0.3)

def sfx_pop():
    n = int(SR * 0.09); t = np.arange(n) / SR
    f = 520 + 520 * (t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 40) * 0.6

def sfx_whoosh(length=0.4):
    n = int(SR * length); t = np.arange(n) / SR; u = t / length
    x = rng.standard_normal(n)
    out = np.zeros(n)
    for c in range(24):
        a, b = c * n // 24, (c + 1) * n // 24
        fc = 350 * (12 ** (c / 24))
        out[a:b] = bp(x[max(0, a - 1500):b], fc * 0.6, fc * 1.6)[-(b - a):]
    return out * np.sin(np.pi * u) ** 1.5 * 0.9

def sfx_ding():
    return bell(1318.5, 1.0) * 0.7

ONE_SHOTS = {'click': sfx_click(), 'tick': sfx_tick(), 'pop': sfx_pop(), 'whoosh': sfx_whoosh(), 'ding': sfx_ding()}

events = []  # (frame, kind, gain, pan)
h, a, c, j, s, nb, lk = (TL[k] for k in ('hook', 'assemble', 'calc', 'join', 'signin', 'number', 'lockup'))
events += [(h['exit'] - 6, 'whoosh', 0.8, -0.3)]
events += [(p['at'], 'pop', 0.45, -0.4 + 0.1 * i) for i, p in enumerate(a['pieces'])]
events += [(a['exit'] - 6, 'whoosh', 0.7, 0.3)]
events += [(c['press'], 'click', 0.9, 0.0), (c['release'], 'click', 0.5, 0.0)]
events += [(c['dragFrom'] + k * 3.75, 'tick', 0.25, 0.2) for k in range(1, 15)]
events += [(c['exit'] - 6, 'whoosh', 0.7, -0.3)]
events += [(j['press'], 'click', 0.9, 0.0)]
events += [(j['typeFrom'] + (k + 1) * j['typeStep'], 'tick', 0.45, 0.15 * ((-1) ** k)) for k in range(j['chars'])]
events += [(j['continueAt'], 'click', 0.95, 0.0), (j['exit'] - 6, 'whoosh', 0.7, 0.3)]
events += [(s['emailPress'], 'click', 0.8, 0.0)]
events += [(s['typeFrom'] + k * 3.75, 'tick', 0.35, 0.1 * ((-1) ** k)) for k in range(6)]
events += [(s['buttonPress'], 'click', 1.0, 0.0), (s['codeScreen'], 'pop', 0.5, 0.0)]
events += [(s['otpFrom'] + k * 3.75, 'tick', 0.4, 0.1 * ((-1) ** k)) for k in range(4)]
events += [(s['verifyPress'], 'click', 0.9, 0.0)]
events += [(nb['countFrom'] + (k + 1) * nb['countStep'], 'tick', 0.55, 0.0) for k in range(nb['count'])]
events += [(nb['minutes'], 'ding', 0.6, 0.0), (nb['noBranch'], 'pop', 0.5, 0.0), (nb['strike'], 'whoosh', 0.35, 0.4)]
events += [(lk['url'], 'pop', 0.4, 0.0), (lk['cta'], 'pop', 0.5, 0.0), (lk['tap'], 'click', 0.9, 0.0), (lk['tap'], 'ding', 0.35, 0.0)]

sfx = Bus()
for fr, kind, g, pan in events:
    assert abs((fr / TL['framesPerBeat']) * 4 - round((fr / TL['framesPerBeat']) * 4)) < 1e-6 \
        or kind in ('whoosh', 'pop'), f'{kind}@{fr} is off the 16th grid'
    x = ONE_SHOTS[kind]
    # whooshes peak on the transition: start them so the bell-curve centre lands 6 frames later
    at = f2s(fr) - (len(x) / SR / 2 - f2s(6) if kind == 'whoosh' else 0)
    sfx.add(x, at, g, pan)

# ───────────────────────────── mix + write ─────────────────────────────
def write(path, L, R):
    st = np.stack([L, R], axis=1)
    pk = np.max(np.abs(st)) or 1.0
    st = st / pk * (10 ** (-1 / 20))  # peak −1 dBFS
    data = (st * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)

fade = np.ones(N)
fl = int(SR * 0.5)
fade[-fl:] = np.linspace(1, 0, fl) ** 2
mL = np.tanh(music.L * 0.9) * fade
mR = np.tanh(music.R * 0.9) * fade
write(os.path.join(HERE, 'music.wav'), mL, mR)
write(os.path.join(HERE, 'sfx.wav'), sfx.L, sfx.R)
os.makedirs(os.path.join(HERE, 'sfx'), exist_ok=True)
for k, x in ONE_SHOTS.items():
    write(os.path.join(HERE, 'sfx', f'{k}.wav'), x, x)
master_L = np.tanh((mL * 0.85 + sfx.L * 0.8) * 1.1) * fade
master_R = np.tanh((mR * 0.85 + sfx.R * 0.8) * 1.1) * fade
write(os.path.join(HERE, 'master.wav'), master_L, master_R)

with wave.open(os.path.join(HERE, 'master.wav')) as w:
    print(f"master.wav  {w.getnframes() / w.getframerate():.3f}s  {w.getframerate()} Hz  {w.getnchannels()}ch")
print(f"stems: music.wav sfx.wav  one-shots: {', '.join(ONE_SHOTS)}  sfx events: {len(events)}  kicks: {len(kick_times)}")
