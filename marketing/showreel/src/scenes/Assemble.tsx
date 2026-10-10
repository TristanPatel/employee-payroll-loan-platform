import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { BOX, C, Crop, FONT, LightBG, TL, cardRect, inOut, spr, tw, useLayout } from '../lib';

const FULL = 'screens/phone-home-full.png';
const FOLD = 'screens/phone-home-fold.png';
const SCREEN = { w: 390, h: 844 };
const CALC = { w: 358, h: 586 };

// fly-in vectors (in screen widths) and spin per piece, deterministic
const FROM: Record<string, [number, number, number]> = {
  header: [0, -1.2, 0], eyebrow: [-1.4, -0.2, -14], h1: [1.5, -0.3, 10], lede: [-1.5, 0.3, -8],
  applyBtn: [1.6, 0.4, 14], waBtn: [-1.6, 0.5, -12], trust: [1.4, 0.8, 9], calculator: [0, 1.6, 0],
};

/** Beat 2 — the real landing page assembles itself piece by piece, then the camera pushes into the calculator. */
export const Assemble: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, fps, mode } = useLayout();
  const A = TL.assemble;
  const k0 = mode === 'v' ? 2.0 : 1.1;
  const P0 = { x: W / 2 - (SCREEN.w * k0) / 2, y: H / 2 - (SCREEN.h * k0) / 2 + (mode === 'v' ? 20 : 0) };
  const target = cardRect(mode, W, H, CALC.w, CALC.h);
  const fb = BOX.phoneFold;

  const e = tw(f, A.push, A.exit, 0, 1, inOut);
  const k = k0 + (target.k - k0) * e;
  const tl = {
    x: P0.x + (target.x - fb.calculator.x * target.k - P0.x) * e,
    y: P0.y + (target.y - fb.calculator.y * target.k - P0.y) * e,
  };
  const pop = spr(f, A.pieces[0].at - 4, fps, { damping: 16, stiffness: 120 });
  const tiltX = (1 - tw(f, 90, A.settle + 8, 0, 1)) * 16;
  const tiltY = (1 - tw(f, 90, A.settle + 8, 0, 1)) * -22;
  const restFade = 1 - tw(f, A.push + 6, A.exit, 0, 1, inOut);
  const clipH = SCREEN.h + (fb.calculator.y + CALC.h - SCREEN.h) * e;
  const foldIn = tw(f, A.settle - 6, A.settle + 4);

  const pieces = (A.pieces as { id: string; at: number }[]).map(({ id, at }) => {
    const b = fb[id];
    const s = spr(f, at, fps, { damping: 13, stiffness: 160 });
    const [dx, dy, rot] = FROM[id];
    const isCalc = id === 'calculator';
    return (
      <div key={id} style={{
        position: 'absolute', left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k,
        transform: `translate(${dx * (1 - s) * SCREEN.w * k}px, ${dy * (1 - s) * SCREEN.h * k * 0.6}px) rotate(${rot * (1 - s)}deg) scale(${0.7 + 0.3 * s})`,
        opacity: Math.min(1, s * 3) * (isCalc ? 1 : restFade),
        filter: s < 0.98 ? `drop-shadow(0 ${30 * (1 - s)}px ${40 * (1 - s)}px rgba(15,17,23,${0.35 * (1 - s)}))` : undefined,
        borderRadius: isCalc ? 16 * k * e : 0,
        overflow: 'hidden',
        boxShadow: isCalc ? `0 ${40 * e}px ${90 * e}px rgba(15,17,23,${0.22 * e})` : undefined,
      }}>
        <Crop src={FULL} imgCssW={390} sx={b.x} sy={b.y} sw={b.w} sh={b.h} k={k} />
      </div>
    );
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>

      {/* oversized outline type behind the screen */}
      <div style={{
        position: 'absolute', top: H * (mode === 'v' ? 0.04 : 0.1), left: 0, width: '100%', textAlign: 'center', whiteSpace: 'nowrap',
        fontFamily: FONT, fontWeight: 900, fontSize: mode === 'v' ? 300 : 330, letterSpacing: '-0.05em', lineHeight: 0.9,
        color: 'transparent', WebkitTextStroke: `3px rgba(139,30,36,${0.13 * restFade})`,
        transform: `translateX(${(f - 150) * -2.2}px)`,
      }}>
        {mode === 'v' ? <>STAFF<br />LOANS<br />ONLINE</> : <>STAFF LOANS<br />ONLINE</>}
      </div>
      <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
        <div style={{
          position: 'absolute', left: tl.x, top: tl.y, width: SCREEN.w * k, height: clipH * k,
          transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${0.85 + 0.15 * pop})`,
          transformOrigin: '50% 40%', opacity: Math.min(1, pop * 2),
        }}>
          {/* device ground: the page background, rounded like a phone screen */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 44 * k0, overflow: 'hidden',
            background: `linear-gradient(180deg, ${C.base}, ${C.muted})`, opacity: restFade,
            boxShadow: `0 60px 140px rgba(15,17,23,${0.28 * restFade}), 0 0 0 ${10 * k0 / 2}px ${C.accent}`,
          }}>
            <Img src={staticFile(FOLD)} style={{ position: 'absolute', left: 0, top: 0, width: SCREEN.w * k, opacity: foldIn }} />
          </div>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 44 * k0 * (1 - e), overflow: e > 0.02 ? 'visible' : 'hidden' }}>
            {pieces}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
