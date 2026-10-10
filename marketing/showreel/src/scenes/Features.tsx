import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, Cursor, FONT, LightBG, RiseWords, TL, cardRect, expoIn, spr, tw, useLayout, Mode } from '../lib';

const pad3 = (n: number) => String(n).padStart(3, '0');

const LABEL: Record<Mode, { left: number; top: number; width: number; title: number; sub: number; eyebrow: number }> = {
  v: { left: 90, top: 140, width: 900, title: 96, sub: 38, eyebrow: 32 },
  s: { left: 60, top: 300, width: 400, title: 66, sub: 28, eyebrow: 24 },
  w: { left: 130, top: 330, width: 760, title: 108, sub: 40, eyebrow: 30 },
};

/** Label block: index, kinetic title, sub-line. */
const Label: React.FC<{ n: number; title: string; sub: string; at: number; exitAt: number }> = ({ n, title, sub, at, exitAt }) => {
  const f = useCurrentFrame();
  const { mode, fps } = useLayout();
  const L = LABEL[mode];
  const line = tw(f, at, at + 12);
  const out = tw(f, exitAt - 2, exitAt + 6, 0, 1, expoIn);
  return (
    <div style={{ position: 'absolute', left: L.left, top: L.top, width: L.width, transform: `translateY(${-out * 60}px)`, opacity: 1 - out }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontFamily: FONT, fontWeight: 700, fontSize: L.eyebrow, letterSpacing: '0.18em', color: C.primary, marginBottom: L.eyebrow * 0.9 }}>
        <span style={{ opacity: line }}>{`0${n}`}</span>
        <span style={{ height: 3, width: 120 * line, background: C.primary }} />
        <span style={{ opacity: line, color: C.inkMuted }}>{'/ 03'}</span>
      </div>
      <RiseWords text={title} at={at + 2} size={L.title} stagger={2} accent={['quote', 'code', 'emailed']} />
      <div style={{ marginTop: L.sub * 0.8, fontFamily: FONT, fontSize: L.sub, fontWeight: 500, color: C.inkMuted, opacity: tw(f, at + 10, at + 20), transform: `translateY(${(1 - tw(f, at + 10, at + 22)) * 20}px)` }}>
        {sub}
      </div>
    </div>
  );
};

/** Card on stage: slides in from the right on a spring, out to the left with motion blur. */
const Card: React.FC<{
  cssW: number; cssH: number; enterAt: number | null; exitAt: number; radius?: number; push?: [number, number, number];
  children: (k: number) => React.ReactNode;
}> = ({ cssW, cssH, enterAt, exitAt, radius = 16, push, children }) => {
  const f = useCurrentFrame();
  const { W, H, fps, mode } = useLayout();
  const r = cardRect(mode, W, H, cssW, cssH);
  const sIn = enterAt === null ? 1 : spr(f, enterAt, fps, { damping: 16, stiffness: 200 });
  const out = tw(f, exitAt, exitAt + 7.5, 0, 1, expoIn);
  const x = (1 - sIn) * W * 0.75 - out * W * 0.85;
  const blur = Math.min(18, Math.abs((1 - sIn) * 30) + out * 24);
  const z = push ? 1 + tw(f, push[0], push[1], 0, push[2]) : 1;
  return (
    <div style={{
      position: 'absolute', left: r.x, top: r.y, width: r.w, height: cssH * r.k,
      transform: `translateX(${x}px) rotate(${(1 - sIn) * 5 - out * 4}deg) scale(${z})`, transformOrigin: '50% 60%',
      filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius * r.k, overflow: 'hidden', boxShadow: '0 40px 90px rgba(15,17,23,0.22), 0 6px 18px rgba(15,17,23,0.08)', background: '#fff' }}>
        {children(r.k)}
      </div>
    </div>
  );
};

/* ───────────── 01 · live loan calculator (real slider drag, 18 recomputed frames) ───────────── */
const CALC = { w: 358, h: 586, thumb: (v: number) => 21 + 8 + 300 * ((v - 500) / 49500), thumbY: 134 };
export const CalcScene: React.FC = () => {
  const f = useCurrentFrame();
  const c = TL.calc;
  // value path: start K5,000 (as on the landing page) → K1,000 → K9,500
  const v = f < c.dragFrom ? 5000
    : f < c.dragFrom + 10 ? interpolate(f, [c.dragFrom, c.dragFrom + 10], [5000, 1000])
    : interpolate(f, [c.dragFrom + 10, c.dragTo], [1000, 9500], { extrapolateRight: 'clamp' });
  const idx = Math.round((Math.min(9500, Math.max(1000, v)) - 1000) / 500);
  const frameIdx = f < c.dragFrom ? 8 : idx;
  const hand = { x: CALC.thumb(v), y: CALC.thumbY };
  return (
    <AbsoluteFill>

      <Label n={1} title="Live loan quote" sub="Slide it. The real numbers move." at={c.cursorIn - 10} exitAt={c.exit} />
      <Card cssW={CALC.w} cssH={CALC.h} enterAt={null} exitAt={c.exit} push={[c.dragFrom, c.release, 0.05]}>
        {(k) => (
          <>
            <Img src={staticFile(`sequences/calculator/${pad3(frameIdx)}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: CALC.w * k }} />
            <Cursor k={k} presses={[c.press]} visibleFrom={c.cursorIn - 4}
              keys={[{ f: c.cursorIn - 4, x: CALC.w + 40, y: CALC.h * 0.7 }, { f: c.press - 3, x: CALC.thumb(5000), y: CALC.thumbY },
                ...(f >= c.press - 3 ? [{ f: f, x: hand.x, y: hand.y }, { f: f + 1, x: hand.x, y: hand.y }] : [])]} />
          </>
        )}
      </Card>
    </AbsoluteFill>
  );
};

/* ───────────── 02 · access code (typed one character per 16th note) ───────────── */
const JOIN = { w: 342, h: 305, input: { x: 25 + 70, y: 134 + 24 }, cont: { x: 25 + 146, y: 247 + 24 } };
const CODE = '7K2P9QR4TX';
export const JoinScene: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, mode } = useLayout();
  const j = TL.join;
  const typed = Math.max(0, Math.min(j.chars, Math.floor((f - j.typeFrom + 1e-6) / j.typeStep)));
  const lastAt = j.typeFrom + typed * j.typeStep;
  const ghost = typed > 0 ? tw(f, lastAt, lastAt + 8) : 1;
  return (
    <AbsoluteFill>

      {/* each keystroke echoes as big kinetic type next to the card */}
      {typed > 0 && (
        <div style={{
          position: 'absolute', left: mode === 'v' ? 0 : LABEL[mode].left, width: mode === 'v' ? W : LABEL[mode].width,
          top: mode === 'v' ? 1640 : mode === 's' ? 700 : 760, textAlign: mode === 'v' ? 'center' : 'left', whiteSpace: 'nowrap',
          fontFamily: FONT, fontWeight: 900, fontSize: mode === 'v' ? 104 : mode === 's' ? 46 : 84, letterSpacing: '0.06em', lineHeight: 1,
          opacity: 1 - tw(f, j.exit - 2, j.exit + 6),
        }}>
          {CODE.split('').map((ch, i) => {
            const at = j.typeFrom + (i + 1) * j.typeStep;
            const a = tw(f, at, at + 6);
            return (
              <span key={i} style={{
                display: 'inline-block', opacity: f >= at ? 1 : 0.12, color: f >= at ? (i === typed - 1 ? C.primary : C.ink) : 'transparent',
                WebkitTextStroke: f >= at ? undefined : `2px ${C.inkMuted}`,
                transform: `translateY(${f >= at ? (1 - a) * -40 : 0}px) scale(${f >= at ? 1.35 - 0.35 * a : 1})`,
              }}>{ch}</span>
            );
          })}
        </div>
      )}
      <Label n={2} title="Join with your HR code" sub="Your employer’s access code. That’s it." at={j.cursorIn - 2} exitAt={j.exit} />
      <Card cssW={JOIN.w} cssH={JOIN.h} enterAt={j.cursorIn - 7.5} exitAt={j.exit} radius={14}>
        {(k) => (
          <>
            <Img src={staticFile(`sequences/join/${pad3(typed)}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: JOIN.w * k }} />
            <Cursor k={k} presses={[j.press, j.continueAt]} visibleFrom={j.cursorIn}
              keys={[{ f: j.cursorIn, x: -40, y: JOIN.h + 30 }, { f: j.press - 3, ...JOIN.input }, { f: j.typeFrom + j.chars * j.typeStep + 3, ...JOIN.input }, { f: j.continueAt - 3, ...JOIN.cont }]} />
          </>
        )}
      </Card>
    </AbsoluteFill>
  );
};

/* ───────────── 03 · sign in with an emailed code (real request → real code screen) ───────────── */
const SIGN = { w: 340, h: 282, email: { x: 24, y: 40, w: 292, h: 40 }, btn: { x: 24 + 146, y: 165 + 22 }, otp: { x: 24, y: 40, w: 292, h: 40 }, verify: { x: 24 + 146, y: 169 + 22 } };
export const SigninScene: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, mode } = useLayout();
  const s = TL.signin;
  const emailReveal = tw(f, s.typeFrom, s.typeTo, 0, 1, (t) => t);
  const otpReveal = tw(f, s.otpFrom, s.otpTo, 0, 1, (t) => t);
  const swap = tw(f, s.buttonPress + 1, s.codeScreen + 3);
  const onCode = f >= s.codeScreen;
  const r = cardRect(mode, W, H, SIGN.w, SIGN.h);
  // iris out of the Verify button into the dark number scene
  const iris = tw(f, s.verifyPress + 0.5, TL.number.countFrom, 0, 1, expoIn);
  const vx = r.x + SIGN.verify.x * r.k, vy = r.y + SIGN.verify.y * r.k;
  const R = Math.hypot(W, H) * 1.05 * iris;
  const Mask: React.FC<{ k: number; box: typeof SIGN.email; p: number }> = ({ k, box, p }) => (
    // white veil over the field's text area that slides off: a reveal of the real captured text
    <div style={{ position: 'absolute', left: (box.x + 10 + (box.w - 14) * p) * k, top: (box.y + 4) * k, width: (box.w - 14) * (1 - p) * k, height: (box.h - 8) * k, background: '#fff' }} />
  );
  return (
    <AbsoluteFill>

      <Label n={3} title="Sign in with an emailed code" sub="No password to remember." at={s.cursorIn - 2} exitAt={s.verifyPress + 3} />
      <Card cssW={SIGN.w} cssH={SIGN.h} enterAt={s.cursorIn - 7.5} exitAt={1e9} radius={14}>
        {(k) => (
          <>
            {!onCode && (
              <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-swap * 40}px)`, opacity: 1 - swap }}>
                <Img src={staticFile(`sequences/signin/${f < s.emailPress ? '000' : '001'}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: SIGN.w * k }} />
                {f >= s.emailPress && <Mask k={k} box={SIGN.email} p={emailReveal} />}
              </div>
            )}
            {f >= s.buttonPress + 1 && (
              <div style={{ position: 'absolute', inset: 0, transform: `translateY(${(1 - swap) * 60}px)`, opacity: swap }}>
                <Img src={staticFile(`sequences/signin/${f < s.otpFrom ? '002' : '003'}.png`)} style={{ position: 'absolute', left: 0, top: 0, width: SIGN.w * k }} />
                {f >= s.otpFrom && <Mask k={k} box={SIGN.otp} p={otpReveal} />}
                {/* keep the real disabled button state until all six digits are in */}
                {f >= s.otpFrom && f < s.otpTo && (
                  <div style={{ position: 'absolute', left: 0, top: 160 * k, width: SIGN.w * k, height: 60 * k, overflow: 'hidden' }}>
                    <Img src={staticFile('sequences/signin/002.png')} style={{ position: 'absolute', left: 0, top: -160 * k, width: SIGN.w * k }} />
                  </div>
                )}
              </div>
            )}
            <Cursor k={k} presses={[s.emailPress, s.buttonPress, s.verifyPress]} visibleFrom={s.cursorIn}
              keys={[{ f: s.cursorIn, x: SIGN.w + 40, y: -30 }, { f: s.emailPress - 3, x: 24 + 60, y: 40 + 22 }, { f: s.typeTo, x: 24 + 60, y: 40 + 22 },
                { f: s.buttonPress - 3, ...SIGN.btn }, { f: s.otpFrom - 2, x: 24 + 200, y: 40 + 28 }, { f: s.otpTo, x: 24 + 200, y: 40 + 28 }, { f: s.verifyPress - 3, ...SIGN.verify }]} />
          </>
        )}
      </Card>
      {iris > 0 && (
        <div style={{ position: 'absolute', left: vx - R, top: vy - R, width: R * 2, height: R * 2, borderRadius: '50%', background: C.accent, boxShadow: `0 0 0 ${40 * iris}px ${C.primary}` }} />
      )}
    </AbsoluteFill>
  );
};
